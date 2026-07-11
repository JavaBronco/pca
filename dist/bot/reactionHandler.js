"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDiscordBot = createDiscordBot;
exports.closeExpiredVoting = closeExpiredVoting;
const discord_js_1 = require("discord.js");
const config_js_1 = require("../config.js");
const VOTE_EMOJIS = new Set(['👍']);
function createDiscordBot(voteTracker, discordService, auditLogger) {
    const client = new discord_js_1.Client({
        intents: [
            discord_js_1.GatewayIntentBits.Guilds,
            discord_js_1.GatewayIntentBits.GuildMessages,
            discord_js_1.GatewayIntentBits.GuildMessageReactions,
            discord_js_1.GatewayIntentBits.MessageContent,
        ],
        // Fetch partial reactions so we have full data
        partials: [discord_js_1.Partials.Message, discord_js_1.Partials.Channel, discord_js_1.Partials.Reaction],
    });
    client.once(discord_js_1.Events.ClientReady, (c) => {
        console.log(`[Bot] Logged in as ${c.user.tag}`);
    });
    client.on(discord_js_1.Events.MessageReactionAdd, async (reaction, user) => {
        await handleReactionAdd(reaction, user, voteTracker, discordService, auditLogger);
    });
    client.on(discord_js_1.Events.MessageReactionRemove, async (reaction, user) => {
        await handleReactionRemove(reaction, user, voteTracker);
    });
    client.on(discord_js_1.Events.Error, (err) => {
        console.error('[Bot] Discord client error:', err.message);
    });
    return client;
}
async function handleReactionAdd(reaction, user, voteTracker, discordService, auditLogger) {
    if (user.bot)
        return;
    const cfg = (0, config_js_1.getConfig)();
    // Support both standard text channels and forum channel threads.
    // In a forum channel, reactions happen inside the thread (a child channel),
    // so we check the thread's parentId against the forum channel ID.
    const channel = reaction.message.channel;
    const parentId = channel && 'parentId' in channel ? channel.parentId : null;
    const isInVotingArea = reaction.message.channelId === cfg.DISCORD_VOTING_CHANNEL_ID ||
        parentId === cfg.DISCORD_VOTING_CHANNEL_ID;
    if (!isInVotingArea)
        return;
    // Fetch partial data if needed
    try {
        if (reaction.partial)
            await reaction.fetch();
        if (user.partial)
            await user.fetch();
    }
    catch (err) {
        console.error('[Bot] Failed to fetch partial reaction:', err.message);
        return;
    }
    const emoji = reaction.emoji.name ?? '';
    if (!VOTE_EMOJIS.has(emoji))
        return;
    const voteType = voteTracker.emojiToVoteType(emoji);
    if (!voteType)
        return;
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
        }
        catch {
            // Best-effort; bot needs Manage Messages permission
        }
    }
}
async function handleReactionRemove(reaction, user, voteTracker) {
    if (user.bot)
        return;
    const cfg = (0, config_js_1.getConfig)();
    const channel = reaction.message.channel;
    const parentId = channel && 'parentId' in channel ? channel.parentId : null;
    const isInVotingArea = reaction.message.channelId === cfg.DISCORD_VOTING_CHANNEL_ID ||
        parentId === cfg.DISCORD_VOTING_CHANNEL_ID;
    if (!isInVotingArea)
        return;
    try {
        if (reaction.partial)
            await reaction.fetch();
    }
    catch (err) {
        console.error('[Bot] Failed to fetch partial on remove:', err.message);
        return;
    }
    const emoji = reaction.emoji.name ?? '';
    if (!VOTE_EMOJIS.has(emoji))
        return;
    await voteTracker.removeVote(reaction.message.id, user.id, emoji);
}
/**
 * Checks for proposals whose voting window has expired, posts results,
 * and marks them closed. Run this on a periodic schedule (e.g., every hour).
 */
async function closeExpiredVoting(voteTracker, discordService, auditLogger) {
    const cfg = (0, config_js_1.getConfig)();
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
        }
        catch (err) {
            console.error(`[Bot] Failed to close voting for ${proposal.messageId}:`, err.message);
        }
    }
}
//# sourceMappingURL=reactionHandler.js.map