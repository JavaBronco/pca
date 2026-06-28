"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.voteTracker = exports.VoteTracker = void 0;
const sheetsClient_js_1 = require("./sheetsClient.js");
const config_js_1 = require("../config.js");
const EMOJI_MAP = {
    '👍': 'approve',
    '👎': 'reject',
    '🤔': 'discuss',
};
/**
 * All Discord user IDs are stored as-is; they are not PII under GDPR since
 * they are pseudonymous platform identifiers. No mapping to real identities
 * is stored.
 */
class VoteTracker {
    async recordProposal(record) {
        const cfg = (0, config_js_1.getConfig)();
        if (!cfg.SUBMISSIONS_SHEET_ID)
            return;
        await (0, sheetsClient_js_1.appendRow)(cfg.SUBMISSIONS_SHEET_ID, cfg.PROPOSALS_SHEET_NAME, [
            record.submissionId,
            record.messageId,
            record.proposedName,
            record.postedAt.toISOString(),
            record.votingClosesAt?.toISOString() ?? '',
            record.closed ? 'TRUE' : 'FALSE',
            record.threadId,
        ]);
    }
    async recordVote(vote) {
        const cfg = (0, config_js_1.getConfig)();
        if (!cfg.SUBMISSIONS_SHEET_ID) {
            return { accepted: true };
        }
        const existing = await this.getExistingVote(vote.messageId, vote.discordUserId);
        if (existing) {
            return { accepted: false, reason: 'duplicate_vote' };
        }
        await (0, sheetsClient_js_1.appendRow)(cfg.SUBMISSIONS_SHEET_ID, cfg.VOTES_SHEET_NAME, [
            vote.messageId,
            vote.discordUserId,
            vote.voteType,
            vote.recordedAt.toISOString(),
        ]);
        return { accepted: true };
    }
    async removeVote(messageId, discordUserId, emoji) {
        const cfg = (0, config_js_1.getConfig)();
        if (!cfg.SUBMISSIONS_SHEET_ID)
            return;
        const voteType = EMOJI_MAP[emoji];
        if (!voteType)
            return;
        const rows = await (0, sheetsClient_js_1.getRows)(cfg.SUBMISSIONS_SHEET_ID, cfg.VOTES_SHEET_NAME);
        for (let i = 0; i < rows.length; i++) {
            if (rows[i][0] === messageId && rows[i][1] === discordUserId && rows[i][2] === voteType) {
                // Mark removed in column E (index 4)
                await (0, sheetsClient_js_1.updateCell)(cfg.SUBMISSIONS_SHEET_ID, cfg.VOTES_SHEET_NAME, i + 2, 5, 'REMOVED');
                break;
            }
        }
    }
    async getTotals(messageId) {
        const cfg = (0, config_js_1.getConfig)();
        const totals = { messageId, approve: 0, reject: 0, discuss: 0 };
        if (!cfg.SUBMISSIONS_SHEET_ID)
            return totals;
        const rows = await (0, sheetsClient_js_1.getRows)(cfg.SUBMISSIONS_SHEET_ID, cfg.VOTES_SHEET_NAME);
        for (const row of rows) {
            if (row[0] !== messageId)
                continue;
            if (row[4] === 'REMOVED')
                continue;
            const voteType = row[2];
            if (voteType === 'approve')
                totals.approve++;
            else if (voteType === 'reject')
                totals.reject++;
            else if (voteType === 'discuss')
                totals.discuss++;
        }
        return totals;
    }
    async getProposalsReadyToClose() {
        const cfg = (0, config_js_1.getConfig)();
        if (!cfg.SUBMISSIONS_SHEET_ID)
            return [];
        const rows = await (0, sheetsClient_js_1.getRows)(cfg.SUBMISSIONS_SHEET_ID, cfg.PROPOSALS_SHEET_NAME);
        const now = new Date();
        const ready = [];
        for (const row of rows) {
            const closed = row[5] === 'TRUE';
            if (closed)
                continue;
            const closesAt = row[4] ? new Date(row[4]) : null;
            if (closesAt && closesAt <= now) {
                ready.push({
                    submissionId: row[0],
                    messageId: row[1],
                    proposedName: row[2],
                    postedAt: new Date(row[3]),
                    votingClosesAt: closesAt,
                    closed: false,
                    threadId: row[6] ?? row[1], // fallback to messageId for backwards compat
                });
            }
        }
        return ready;
    }
    async markClosed(messageId) {
        const cfg = (0, config_js_1.getConfig)();
        if (!cfg.SUBMISSIONS_SHEET_ID)
            return;
        const rows = await (0, sheetsClient_js_1.getRows)(cfg.SUBMISSIONS_SHEET_ID, cfg.PROPOSALS_SHEET_NAME);
        for (let i = 0; i < rows.length; i++) {
            if (rows[i][1] === messageId) {
                await (0, sheetsClient_js_1.updateCell)(cfg.SUBMISSIONS_SHEET_ID, cfg.PROPOSALS_SHEET_NAME, i + 2, 6, 'TRUE');
                break;
            }
        }
    }
    async getExistingVote(messageId, discordUserId) {
        const cfg = (0, config_js_1.getConfig)();
        if (!cfg.SUBMISSIONS_SHEET_ID)
            return false;
        const rows = await (0, sheetsClient_js_1.getRows)(cfg.SUBMISSIONS_SHEET_ID, cfg.VOTES_SHEET_NAME);
        return rows.some((row) => row[0] === messageId && row[1] === discordUserId && row[4] !== 'REMOVED');
    }
    /**
     * Finds an open (not yet closed) proposal matching the proposed name.
     * Comparison is case-insensitive and trims whitespace.
     */
    async findOpenProposalByName(proposedName) {
        const cfg = (0, config_js_1.getConfig)();
        if (!cfg.SUBMISSIONS_SHEET_ID)
            return null;
        const rows = await (0, sheetsClient_js_1.getRows)(cfg.SUBMISSIONS_SHEET_ID, cfg.PROPOSALS_SHEET_NAME);
        const normalized = proposedName.trim().toLowerCase();
        for (const row of rows) {
            if (row[5] === 'TRUE')
                continue; // already closed
            if ((row[2] ?? '').trim().toLowerCase() === normalized) {
                return {
                    submissionId: row[0],
                    messageId: row[1],
                    proposedName: row[2],
                    postedAt: new Date(row[3]),
                    votingClosesAt: row[4] ? new Date(row[4]) : undefined,
                    closed: false,
                    threadId: row[6] ?? row[1],
                };
            }
        }
        return null;
    }
    emojiToVoteType(emoji) {
        return EMOJI_MAP[emoji] ?? null;
    }
}
exports.VoteTracker = VoteTracker;
exports.voteTracker = new VoteTracker();
//# sourceMappingURL=voteTracker.js.map