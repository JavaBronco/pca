import { DiscordPostResult, FormSubmission } from '../types.js';
export declare class DiscordService {
    private rest;
    constructor();
    postProposal(submission: FormSubmission): Promise<DiscordPostResult>;
    private buildMessage;
    closeVotingMessage(channelId: string, messageId: string, totals: {
        approve: number;
        reject: number;
        discuss: number;
    }): Promise<void>;
}
export declare const discordService: DiscordService;
//# sourceMappingURL=discordService.d.ts.map