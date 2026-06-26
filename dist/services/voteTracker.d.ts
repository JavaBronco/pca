import { VoteRecord, VoteTotals, ProposalRecord } from '../types.js';
/**
 * All Discord user IDs are stored as-is; they are not PII under GDPR since
 * they are pseudonymous platform identifiers. No mapping to real identities
 * is stored.
 */
export declare class VoteTracker {
    recordProposal(record: ProposalRecord): Promise<void>;
    recordVote(vote: VoteRecord): Promise<{
        accepted: boolean;
        reason?: string;
    }>;
    removeVote(messageId: string, discordUserId: string, emoji: string): Promise<void>;
    getTotals(messageId: string): Promise<VoteTotals>;
    getProposalsReadyToClose(): Promise<ProposalRecord[]>;
    markClosed(messageId: string): Promise<void>;
    private getExistingVote;
    emojiToVoteType(emoji: string): VoteRecord['voteType'] | null;
}
export declare const voteTracker: VoteTracker;
//# sourceMappingURL=voteTracker.d.ts.map