import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v10';
import { DiscordPostResult, FormSubmission } from '../types.js';
import { getConfig } from '../config.js';

const VOTE_EMOJIS = ['👍', '👎', '🤔'] as const;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Posts with exponential backoff + jitter on 429 (rate-limit) and 5xx responses.
 */
async function postWithRetry(
  rest: REST,
  channelId: string,
  body: object,
  maxAttempts: number,
  baseDelayMs: number,
): Promise<{ id: string }> {
  let attempt = 0;
  while (true) {
    try {
      const result = await rest.post(Routes.channelMessages(channelId), { body });
      return result as { id: string };
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
    const message = this.buildMessage(submission);

    const posted = await postWithRetry(
      this.rest,
      cfg.DISCORD_VOTING_CHANNEL_ID,
      message,
      parseInt(cfg.RATE_LIMIT_RETRY_ATTEMPTS, 10),
      parseInt(cfg.RATE_LIMIT_BASE_DELAY_MS, 10),
    );

    // Add default reaction emojis so users can react without finding them
    for (const emoji of VOTE_EMOJIS) {
      try {
        await this.rest.put(
          Routes.channelMessageOwnReaction(cfg.DISCORD_VOTING_CHANNEL_ID, posted.id, encodeURIComponent(emoji)),
        );
        await sleep(300); // Avoid hitting reaction rate limits
      } catch (err) {
        console.warn(`[Discord] Failed to seed reaction ${emoji}:`, (err as Error).message);
      }
    }

    return {
      messageId: posted.id,
      channelId: cfg.DISCORD_VOTING_CHANNEL_ID,
      postedAt: new Date(),
    };
  }

  private buildMessage(submission: FormSubmission): object {
    return {
      embeds: [
        {
          title: '🗳️ New Region Name Proposal',
          color: 0x003087,
          fields: [
            {
              name: 'Proposed Name',
              value: submission.proposedName,
              inline: false,
            },
            {
              name: 'Why It Fits',
              value: submission.whyItFits,
              inline: false,
            },
          ],
          footer: {
            text: `Vote using reactions below • Submission ID: ${submission.submissionId}`,
          },
          timestamp: new Date().toISOString(),
        },
      ],
      content: [
        '**New Region Name Proposal**',
        '',
        `**Proposed Name:** ${submission.proposedName}`,
        '',
        `**Why It Fits:**`,
        submission.whyItFits,
        '',
        'Vote using reactions:',
        '👍 Approve',
        '👎 Reject',
        '🤔 Needs Discussion',
      ].join('\n'),
    };
  }

  async closeVotingMessage(channelId: string, messageId: string, totals: { approve: number; reject: number; discuss: number }): Promise<void> {
    const resultLine =
      totals.approve > totals.reject
        ? '✅ Result: **APPROVED**'
        : totals.approve < totals.reject
          ? '❌ Result: **REJECTED**'
          : '🤝 Result: **TIE — Needs Committee Review**';

    await this.rest.post(Routes.channelMessages(channelId), {
      body: {
        content: [
          '**Voting has closed for this proposal.**',
          `👍 Approve: ${totals.approve}`,
          `👎 Reject: ${totals.reject}`,
          `🤔 Needs Discussion: ${totals.discuss}`,
          '',
          resultLine,
        ].join('\n'),
        message_reference: { message_id: messageId },
      },
    });
  }
}

export const discordService = new DiscordService();
