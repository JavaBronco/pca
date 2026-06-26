import { AdminAlertPayload } from '../types.js';
/**
 * Sends admin alerts via Discord DM to admin channel and/or email.
 * Includes enough internal detail for debugging but never exposes PII publicly.
 */
export declare class AdminNotifier {
    private rest;
    constructor();
    notify(payload: AdminAlertPayload): Promise<void>;
    private notifyDiscord;
    private formatDiscordAlert;
    private notifyEmail;
    /** Never include email addresses or member numbers in alert detail text. */
    private sanitizeDetail;
}
export declare const adminNotifier: AdminNotifier;
//# sourceMappingURL=adminNotifier.d.ts.map