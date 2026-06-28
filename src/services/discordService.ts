import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v10';
import { DiscordPostResult, FormSubmission } from '../types.js';
import { getConfig } from '../config.js';

const VOTE_EMOJIS = ['👍'] as const;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts: number,
  baseDelayMs: number,
): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err: unknown) {
      attempt++;
      const httpStatus = (err as { status?: number }).status;
      const isRetryable = httpStatus === 429 || (httpStatus !== undefined && httpStatus >= 500);
      if (!isRetryable || attempt >= maxAttempts) throw err;
      const delay = baseDelayMs * 2 ** (attempt - 1) + Math.random() * 200;
      console.warn(`[Discord] HTTP ${httpStatus}, retrying in ${Math.round(delay)}ms (attempt ${attempt}/${maxAttempts})`);
      await sleep(delay);
    }
  }
}

export class DiscordService {
  private rest: REST;

  constructor() {
    const cfg = getConfig();
    this.rest = new REST({ version: '10' }).setToken(cfg.DISCORD_BOT_TOKEN);
  }

  async postProposal(submission: FormSubmission): Promise<DiscordPostResult> {
    const cfg = getConfig();
    const maxAttempts = parseInt(cfg.RATE_LIMIT_RETRY_ATTEMPTS, 10);
    const baseDelay = parseInt(cfg.RATE_LIMIT_BASE_DELAY_MS, 10);

    // Create a forum post (thread) directly in the forum channel
    const forumPost = await withRetry(
      () => this.rest.post(Routes.threads(cfg.DISCORD_VOTING_CHANNEL_ID), {
        body: {
          name: `🗳️ ${submission.proposedName}`,
          message: {
            content: this.buildVotingContent(submission),
          },
          auto_archive_duration: 10080, // 7 days
        },
      }) as Promise<{ id: string; message?: { id: string } }>,
      maxAttempts,
      baseDelay,
    );

    const threadId = forumPost.id;
    // The starter message ID is returned in forumPost.message.id
    const starterMsgId = forumPost.message?.id ?? forumPost.id;

    // Add voting reactions to the starter message inside the thread
    for (const emoji of VOTE_EMOJIS) {
      try {
        await this.rest.put(
          Routes.channelMessageOwnReaction(threadId, starterMsgId, encodeURIComponent(emoji)),
        );
        await sleep(300); // Stay within reaction rate limits
      } catch (err) {
        console.warn(`[Discord] Failed to seed reaction ${emoji}:`, (err as Error).message);
      }
    }

    return {
      messageId: starterMsgId,  // track reactions against this
      threadId,                  // post results into this thread
      channelId: cfg.DISCORD_VOTING_CHANNEL_ID,
      postedAt: new Date(),
    };
  }

  private buildVotingContent(submission: FormSubmission): string {
    return [
      '**What Members Like About This Name:**',
      submission.whyItFits,
      '',
      '━━━━━━━━━━━━━━━━━━━━━━',
      'React with 👍 to support this new name proposal.\n',
      '_Use this thread to discuss the proposal._',
    ].join('\n');
  }

  /**
   * Posts a supporting reason as a reply inside an existing proposal's thread.
   * Called when a second member submits the same proposed name.
   */
  async addSupportingReason(threadId: string, whyItFits: string): Promise<void> {
    const cfg = getConfig();
    const maxAttempts = parseInt(cfg.RATE_LIMIT_RETRY_ATTEMPTS, 10);
    const baseDelay = parseInt(cfg.RATE_LIMIT_BASE_DELAY_MS, 10);

    await withRetry(
      () => this.rest.post(Routes.channelMessages(threadId), {
        body: {
          content: [
            '**💬 Another member supports this name!**',
            '',
            '**Their reason:**',
            whyItFits,
          ].join('\n'),
        },
      }) as Promise<unknown>,
      maxAttempts,
      baseDelay,
    );
  }

  async closeVotingMessage(
    threadId: string,
    messageId: string,
    totals: { approve: number; reject: number; discuss: number },
  ): Promise<void> {
    // Post the result inside the thread
    await this.rest.post(Routes.channelMessages(threadId), {
      body: {
        content: [
          '**🔒 Voting has closed.**',
          `👍 Support: ${totals.approve}`,
        ].join('\n'),
        message_reference: { message_id: messageId },
      },
    });
  }
}

export const discordService = new DiscordService();
