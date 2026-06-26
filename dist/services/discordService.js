"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.discordService = exports.DiscordService = void 0;
const rest_1 = require("@discordjs/rest");
const v10_1 = require("discord-api-types/v10");
const config_js_1 = require("../config.js");
const VOTE_EMOJIS = ['👍', '👎', '🤔'];
function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}
/**
 * Posts with exponential backoff + jitter on 429 (rate-limit) and 5xx responses.
 */
async function postWithRetry(rest, channelId, body, maxAttempts, baseDelayMs) {
    let attempt = 0;
    while (true) {
        try {
            const result = await rest.post(v10_1.Routes.channelMessages(channelId), { body });
            return result;
        }
        catch (err) {
            attempt++;
            const httpStatus = err.status;
            const isRetryable = httpStatus === 429 || (httpStatus !== undefined && httpStatus >= 500);
            if (!isRetryable || attempt >= maxAttempts)
                throw err;
            const delay = baseDelayMs * 2 ** (attempt - 1) + Math.random() * 200;
            console.warn(`[Discord] HTTP ${httpStatus}, retrying in ${Math.round(delay)}ms (attempt ${attempt}/${maxAttempts})`);
            await sleep(delay);
        }
    }
}
class DiscordService {
    rest;
    constructor() {
        const cfg = (0, config_js_1.getConfig)();
        this.rest = new rest_1.REST({ version: '10' }).setToken(cfg.DISCORD_BOT_TOKEN);
    }
    async postProposal(submission) {
        const cfg = (0, config_js_1.getConfig)();
        const message = this.buildMessage(submission);
        const posted = await postWithRetry(this.rest, cfg.DISCORD_VOTING_CHANNEL_ID, message, parseInt(cfg.RATE_LIMIT_RETRY_ATTEMPTS, 10), parseInt(cfg.RATE_LIMIT_BASE_DELAY_MS, 10));
        // Add default reaction emojis so users can react without finding them
        for (const emoji of VOTE_EMOJIS) {
            try {
                await this.rest.put(v10_1.Routes.channelMessageOwnReaction(cfg.DISCORD_VOTING_CHANNEL_ID, posted.id, encodeURIComponent(emoji)));
                await sleep(300); // Avoid hitting reaction rate limits
            }
            catch (err) {
                console.warn(`[Discord] Failed to seed reaction ${emoji}:`, err.message);
            }
        }
        return {
            messageId: posted.id,
            channelId: cfg.DISCORD_VOTING_CHANNEL_ID,
            postedAt: new Date(),
        };
    }
    buildMessage(submission) {
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
    async closeVotingMessage(channelId, messageId, totals) {
        const resultLine = totals.approve > totals.reject
            ? '✅ Result: **APPROVED**'
            : totals.approve < totals.reject
                ? '❌ Result: **REJECTED**'
                : '🤝 Result: **TIE — Needs Committee Review**';
        await this.rest.post(v10_1.Routes.channelMessages(channelId), {
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
exports.DiscordService = DiscordService;
exports.discordService = new DiscordService();
//# sourceMappingURL=discordService.js.map