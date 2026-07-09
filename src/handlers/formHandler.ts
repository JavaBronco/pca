import { MembershipAdapter } from '../adapters/membershipAdapter.js';
import { DiscordService } from '../services/discordService.js';
import { VoteTracker } from '../services/voteTracker.js';
import { AdminNotifier } from '../services/adminNotifier.js';
import { AuditLogger } from '../services/auditLogger.js';
import { validateFields, validateWebhookSecret } from '../validators/fieldValidator.js';
import { appendRow } from '../services/sheetsClient.js';
import { getConfig } from '../config.js';
import { WebhookPayload } from '../types.js';

export interface HandlerDependencies {
  membershipAdapter: MembershipAdapter;
  discordService: DiscordService;
  voteTracker: VoteTracker;
  adminNotifier: AdminNotifier;
  auditLogger: AuditLogger;
}

export type HandlerResult =
  | { outcome: 'accepted'; submissionId: string; messageId: string }
  | { outcome: 'validation_failed'; errors: { field: string; message: string }[] }
  | { outcome: 'membership_denied'; status: string; submissionId: string }
  | { outcome: 'error'; message: string; submissionId?: string };

export async function handleFormSubmission(
  rawPayload: unknown,
  webhookHeader: string | undefined,
  deps: HandlerDependencies,
): Promise<HandlerResult> {
  const cfg = getConfig();

  if (!validateWebhookSecret(webhookHeader, cfg.WEBHOOK_SECRET)) {
    return { outcome: 'error', message: 'Invalid webhook secret' };
  }

  // Field validation
  const fieldResult = validateFields(rawPayload);
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
      await appendRow(cfg.SUBMISSIONS_SHEET_ID, cfg.SUBMISSIONS_SHEET_NAME, [
        submission.submissionId,
        submission.receivedAt.toISOString(),
        submission.membershipNumber,
        submission.proposedName,
        'pending',
      ]);
    } catch (err) {
      console.error('[Handler] Failed to log submission to sheet:', (err as Error).message);
    }
  }

  // Check if this name was already proposed — if so, add as a supporting comment
  let existingProposal = null;
  try {
    existingProposal = await deps.voteTracker.findOpenProposalByName(submission.proposedName);
  } catch (err) {
    console.warn('[Handler] Could not check for duplicate proposal:', (err as Error).message);
  }

  if (existingProposal) {
    try {
      await deps.discordService.addSupportingReason(existingProposal.threadId, submission.whyItFits);
    } catch (err) {
      const errMsg = (err as Error).message;
      await deps.adminNotifier.notify({
        submissionId: submission.submissionId,
        event: 'discord_error',
        detail: `Failed to add supporting reason to thread: ${errMsg}`,
        proposedName: submission.proposedName,
        timestamp: new Date(),
      });
      return { outcome: 'error', message: 'Discord post failed', submissionId: submission.submissionId };
    }

    await deps.auditLogger.log({
      submissionId: submission.submissionId,
      timestamp: new Date(),
      event: 'supporting_submission',
      discordMessageId: existingProposal.messageId,
    });

    return {
      outcome: 'accepted',
      submissionId: submission.submissionId,
      messageId: existingProposal.messageId,
    };
  }

  // No existing proposal — create a new forum post
  let postResult;
  try {
    postResult = await deps.discordService.postProposal(submission);
  } catch (err) {
    const errMsg = (err as Error).message;
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

  // Voting closes at midnight (end of day) August 31, 2026 UTC
  const votingClosesAt = new Date('2026-09-01T07:00:00.000Z'); // midnight Aug 31 Pacific (PDT, UTC-7)

  await deps.voteTracker.recordProposal({
    submissionId: submission.submissionId,
    messageId: postResult.messageId,
    threadId: postResult.threadId,
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
