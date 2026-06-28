import { Client, GatewayIntentBits, Events, MessageReaction, User, PartialMessageReaction, PartialUser, Partials } from 'discord.js';
import { VoteTracker } from '../services/voteTracker.js';
import { DiscordService } from '../services/discordService.js';
import { AuditLogger } from '../services/auditLogger.js';
import { getConfig } from '../config.js';

const VOTE_EMOJIS = new Set(['👍', '👎', '🤔']);

export function createDiscordBot(
  voteTracker: VoteTracker,
  discordService: DiscordService,
  auditLogger: AuditLogger,
): Client {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMessageReactions,
      GatewayIntentBits.MessageContent,
    ],
    // Fetch partial reactions so we have full data
    partials: [Partials.Message, Partials.Channel, Partials.Reaction],
  });

  client.once(Events.ClientReady, (c) => {
    console.log(`[Bot] Logged in as ${c.user.tag}`);
  });

  client.on(Events.MessageReactionAdd, async (reaction, user) => {
    await handleReactionAdd(reaction, user, voteTracker, discordService, auditLogger);
  });

  client.on(Events.MessageReactionRemove, async (reaction, user) => {
    await handleReactionRemove(reaction, user, voteTracker);
  });

  client.on(Events.Error, (err) => {
    console.error('[Bot] Discord client error:', err.message);
  });

  return client;
}

async function handleReactionAdd(
  reaction: MessageReaction | PartialMessageReaction,
  user: User | PartialUser,
  voteTracker: VoteTracker,
  discordService: DiscordService,
  auditLogger: AuditLogger,
): Promise<void> {
  if (user.bot) return;

  const cfg = getConfig();

  // Support both standard text channels and forum channel threads.
  // In a forum channel, reactions happen inside the thread (a child channel),
  // so we check the thread's parentId against the forum channel ID.
  const channel = reaction.message.channel;
  const parentId = channel && 'parentId' in channel ? (channel as { parentId?: string }).parentId : null;
  const isInVotingArea =
    reaction.message.channelId === cfg.DISCORD_VOTING_CHANNEL_ID ||
    parentId === cfg.DISCORD_VOTING_CHANNEL_ID;

  if (!isInVotingArea) return;

  // Fetch partial data if needed
  try {
    if (reaction.partial) await reaction.fetch();
    if (user.partial) await user.fetch();
  } catch (err) {
    console.error('[Bot] Failed to fetch partial reaction:', (err as Error).message);
    return;
  }

  const emoji = reaction.emoji.name ?? '';
  if (!VOTE_EMOJIS.has(emoji)) return;

  const voteType = voteTracker.emojiToVoteType(emoji);
  if (!voteType) return;

  const result = await voteTracker.recordVote({
    messageId: reaction.message.id,
    discordUserId: user.id,
    voteType,
    recordedAt: new Date(),
  });

  if (!result.accepted) {
    // Remove the duplicate reaction silently
    try {
      await reaction.users.remove(user.id);
    } catch {
      // Best-effort; bot needs Manage Messages permission
    }
  }
}

async function handleReactionRemove(
  reaction: MessageReaction | PartialMessageReaction,
  user: User | PartialUser,
  voteTracker: VoteTracker,
): Promise<void> {
  if (user.bot) return;

  const cfg = getConfig();
  const channel = reaction.message.channel;
  const parentId = channel && 'parentId' in channel ? (channel as { parentId?: string }).parentId : null;
  const isInVotingArea =
    reaction.message.channelId === cfg.DISCORD_VOTING_CHANNEL_ID ||
    parentId === cfg.DISCORD_VOTING_CHANNEL_ID;

  if (!isInVotingArea) return;

  try {
    if (reaction.partial) await reaction.fetch();
  } catch (err) {
    console.error('[Bot] Failed to fetch partial on remove:', (err as Error).message);
    return;
  }

  const emoji = reaction.emoji.name ?? '';
  if (!VOTE_EMOJIS.has(emoji)) return;

  await voteTracker.removeVote(reaction.message.id, user.id, emoji);
}

/**
 * Checks for proposals whose voting window has expired, posts results,
 * and marks them closed. Run this on a periodic schedule (e.g., every hour).
 */
export async function closeExpiredVoting(
  voteTracker: VoteTracker,
  discordService: DiscordService,
  auditLogger: AuditLogger,
): Promise<void> {
  const cfg = getConfig();
  const proposals = await voteTracker.getProposalsReadyToClose();

  for (const proposal of proposals) {
    try {
      const totals = await voteTracker.getTotals(proposal.messageId);
      await discordService.closeVotingMessage(proposal.threadId, proposal.messageId, totals);
      await voteTracker.markClosed(proposal.messageId);
      await auditLogger.log({
        submissionId: proposal.submissionId,
        timestamp: new Date(),
        event: 'voting_closed',
        discordMessageId: proposal.messageId,
      });
    } catch (err) {
      console.error(`[Bot] Failed to close voting for ${proposal.messageId}:`, (err as Error).message);
    }
  }
}
