import { DiscordPostResult, FormSubmission } from '../types.js';
export declare class DiscordService {
    private rest;
    constructor();
    postProposal(submission: FormSubmission): Promise<DiscordPostResult>;
    private buildVotingContent;
    /**
     * Posts a supporting reason as a reply inside an existing proposal's thread.
     * Called when a second member submits the same proposed name.
     */
    addSupportingReason(threadId: string, whyItFits: string): Promise<void>;
    closeVotingMessage(threadId: string, messageId: string, totals: {
        approve: number;
        reject: number;
        discuss: number;
    }): Promise<void>;
    postLeaderboard(ranked: Array<{
        proposal: {
            proposedName: string;
            threadId: string;
        };
        supportCount: number;
    }>): Promise<void>;
}
export declare const discordService: DiscordService;
//# sourceMappingURL=discordService.d.ts.map