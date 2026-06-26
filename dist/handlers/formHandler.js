"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleFormSubmission = handleFormSubmission;
const fieldValidator_js_1 = require("../validators/fieldValidator.js");
const sheetsClient_js_1 = require("../services/sheetsClient.js");
const config_js_1 = require("../config.js");
async function handleFormSubmission(rawPayload, webhookHeader, deps) {
    const cfg = (0, config_js_1.getConfig)();
    if (!(0, fieldValidator_js_1.validateWebhookSecret)(webhookHeader, cfg.WEBHOOK_SECRET)) {
        return { outcome: 'error', message: 'Invalid webhook secret' };
    }
    // Field validation
    const fieldResult = (0, fieldValidator_js_1.validateFields)(rawPayload);
    if (!fieldResult.valid || !fieldResult.submission) {
        return { outcome: 'validation_failed', errors: fieldResult.errors };
    }
    const submission = fieldResult.submission;
    await deps.auditLogger.log({
        submissionId: submission.submissionId,
        timestamp: new Date(),
        event: 'submission_received',
    });
    // Persist raw submission to private tracking sheet (contains PII — access-restricted)
    if (cfg.SUBMISSIONS_SHEET_ID) {
        try {
            await (0, sheetsClient_js_1.appendRow)(cfg.SUBMISSIONS_SHEET_ID, cfg.SUBMISSIONS_SHEET_NAME, [
                submission.submissionId,
                submission.receivedAt.toISOString(),
                submission.firstName,
                submission.lastName,
                submission.email,
                submission.membershipNumber,
                submission.proposedName,
                'pending',
            ]);
        }
        catch (err) {
            console.error('[Handler] Failed to log submission to sheet:', err.message);
        }
    }
    // Membership validation
    let membershipResult;
    try {
        membershipResult = await deps.membershipAdapter.validate(submission.membershipNumber);
    }
    catch (err) {
        const errMsg = err.message;
        await deps.auditLogger.log({
            submissionId: submission.submissionId,
            timestamp: new Date(),
            event: 'membership_check_error',
            membershipStatus: 'error',
            error: errMsg,
        });
        await deps.adminNotifier.notify({
            submissionId: submission.submissionId,
            event: 'system_error',
            detail: `Membership adapter threw: ${errMsg}`,
            proposedName: submission.proposedName,
            timestamp: new Date(),
        });
        return { outcome: 'error', message: 'Membership check failed', submissionId: submission.submissionId };
    }
    await deps.auditLogger.log({
        submissionId: submission.submissionId,
        timestamp: membershipResult.validatedAt,
        event: 'membership_validated',
        membershipStatus: membershipResult.status,
    });
    if (membershipResult.status !== 'valid') {
        await deps.adminNotifier.notify({
            submissionId: submission.submissionId,
            event: 'membership_invalid',
            detail: `Status: ${membershipResult.status}. ${membershipResult.message ?? ''}`,
            proposedName: submission.proposedName,
            timestamp: new Date(),
        });
        return {
            outcome: 'membership_denied',
            status: membershipResult.status,
            submissionId: submission.submissionId,
        };
    }
    // Post to Discord
    let postResult;
    try {
        postResult = await deps.discordService.postProposal(submission);
    }
    catch (err) {
        const errMsg = err.message;
        await deps.auditLogger.log({
            submissionId: submission.submissionId,
            timestamp: new Date(),
            event: 'discord_post_failed',
            error: errMsg,
        });
        await deps.adminNotifier.notify({
            submissionId: submission.submissionId,
            event: 'discord_error',
            detail: errMsg,
            proposedName: submission.proposedName,
            timestamp: new Date(),
        });
        return { outcome: 'error', message: 'Discord post failed', submissionId: submission.submissionId };
    }
    // Track proposal for vote closing
    const votingDays = parseInt(cfg.VOTING_DURATION_DAYS, 10);
    const votingClosesAt = new Date(postResult.postedAt.getTime() + votingDays * 86_400_000);
    await deps.voteTracker.recordProposal({
        submissionId: submission.submissionId,
        messageId: postResult.messageId,
        proposedName: submission.proposedName,
        postedAt: postResult.postedAt,
        votingClosesAt,
        closed: false,
    });
    await deps.auditLogger.log({
        submissionId: submission.submissionId,
        timestamp: postResult.postedAt,
        event: 'discord_posted',
        discordMessageId: postResult.messageId,
    });
    return {
        outcome: 'accepted',
        submissionId: submission.submissionId,
        messageId: postResult.messageId,
    };
}
//# sourceMappingURL=formHandler.js.map