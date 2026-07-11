"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.discordService = exports.DiscordService = void 0;
const rest_1 = require("@discordjs/rest");
const v10_1 = require("discord-api-types/v10");
const config_js_1 = require("../config.js");
const VOTE_EMOJIS = ['👍'];
function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}
async function withRetry(fn, maxAttempts, baseDelayMs) {
    let attempt = 0;
    while (true) {
        try {
            return await fn();
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
        const maxAttempts = parseInt(cfg.RATE_LIMIT_RETRY_ATTEMPTS, 10);
        const baseDelay = parseInt(cfg.RATE_LIMIT_BASE_DELAY_MS, 10);
        // Create a forum post (thread) directly in the forum channel
        const forumPost = await withRetry(() => this.rest.post(v10_1.Routes.threads(cfg.DISCORD_VOTING_CHANNEL_ID), {
            body: {
                name: `🗳️ ${submission.proposedName}`,
                message: {
                    content: this.buildVotingContent(submission),
                },
                auto_archive_duration: 10080, // 7 days
            },
        }), maxAttempts, baseDelay);
        const threadId = forumPost.id;
        // The starter message ID is returned in forumPost.message.id
        const starterMsgId = forumPost.message?.id ?? forumPost.id;
        // Add voting reactions to the starter message inside the thread
        for (const emoji of VOTE_EMOJIS) {
            try {
                await this.rest.put(v10_1.Routes.channelMessageOwnReaction(threadId, starterMsgId, encodeURIComponent(emoji)));
                await sleep(300); // Stay within reaction rate limits
            }
            catch (err) {
                console.warn(`[Discord] Failed to seed reaction ${emoji}:`, err.message);
            }
        }
        return {
            messageId: starterMsgId, // track reactions against this
            threadId, // post results into this thread
            channelId: cfg.DISCORD_VOTING_CHANNEL_ID,
            postedAt: new Date(),
        };
    }
    buildVotingContent(submission) {
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
    async addSupportingReason(threadId, whyItFits) {
        const cfg = (0, config_js_1.getConfig)();
        const maxAttempts = parseInt(cfg.RATE_LIMIT_RETRY_ATTEMPTS, 10);
        const baseDelay = parseInt(cfg.RATE_LIMIT_BASE_DELAY_MS, 10);
        await withRetry(() => this.rest.post(v10_1.Routes.channelMessages(threadId), {
            body: {
                content: [
                    '**💬 Another member supports this name!**',
                    '',
                    '**Their reason:**',
                    whyItFits,
                ].join('\n'),
            },
        }), maxAttempts, baseDelay);
    }
    async closeVotingMessage(threadId, messageId, totals) {
        // Post the result inside the thread
        await this.rest.post(v10_1.Routes.channelMessages(threadId), {
            body: {
                content: [
                    '**🔒 Voting has closed.**',
                    `👍 Support: ${totals.approve}`,
                ].join('\n'),
                message_reference: { message_id: messageId },
            },
        });
    }
    async postLeaderboard(ranked) {
        const cfg = (0, config_js_1.getConfig)();
        const lines = ranked.length === 0
            ? ['No open proposals yet.']
            : ranked.map((entry, i) => {
                const link = `https://discord.com/channels/${cfg.DISCORD_GUILD_ID}/${entry.proposal.threadId}`;
                const votes = entry.supportCount === 1 ? '1 support' : `${entry.supportCount} supports`;
                return `**${i + 1}.** [${entry.proposal.proposedName}](${link}) — ${votes}`;
            });
        const date = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        const content = [
            `📊 **Leaderboard Update — ${date}**`,
            '',
            ...lines,
            '',
            '_Voting closes midnight August 31 (Pacific)._',
        ].join('\n');
        // Find existing leaderboard thread or create one
        const threads = await this.rest.get(v10_1.Routes.guildActiveThreads(cfg.DISCORD_GUILD_ID));
        const existing = threads.threads.find((t) => t.name === '📊 Leaderboard' && t.parent_id === cfg.DISCORD_VOTING_CHANNEL_ID);
        if (existing) {
            await this.rest.post(v10_1.Routes.channelMessages(existing.id), {
                body: { content },
            });
        }
        else {
            await this.rest.post(v10_1.Routes.threads(cfg.DISCORD_VOTING_CHANNEL_ID), {
                body: {
                    name: '📊 Leaderboard',
                    message: { content },
                    auto_archive_duration: 10080,
                },
            });
        }
    }
}
exports.DiscordService = DiscordService;
exports.discordService = new DiscordService();
//# sourceMappingURL=discordService.js.map