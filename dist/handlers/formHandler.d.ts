import { MembershipAdapter } from '../adapters/membershipAdapter.js';
import { DiscordService } from '../services/discordService.js';
import { VoteTracker } from '../services/voteTracker.js';
import { AdminNotifier } from '../services/adminNotifier.js';
import { AuditLogger } from '../services/auditLogger.js';
export interface HandlerDependencies {
    membershipAdapter: MembershipAdapter;
    discordService: DiscordService;
    voteTracker: VoteTracker;
    adminNotifier: AdminNotifier;
    auditLogger: AuditLogger;
}
export type HandlerResult = {
    outcome: 'accepted';
    submissionId: string;
    messageId: string;
} | {
    outcome: 'validation_failed';
    errors: {
        field: string;
        message: string;
    }[];
} | {
    outcome: 'membership_denied';
    status: string;
    submissionId: string;
} | {
    outcome: 'error';
    message: string;
    submissionId?: string;
};
export declare function handleFormSubmission(rawPayload: unknown, webhookHeader: string | undefined, deps: HandlerDependencies): Promise<HandlerResult>;
//# sourceMappingURL=formHandler.d.ts.map