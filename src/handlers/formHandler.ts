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
        submission.firstName,
        submission.lastName,
        submission.email,
        submission.membershipNumber,
        submission.proposedName,
        'pending',
      ]);
    } catch (err) {
      console.error('[Handler] Failed to log submission to sheet:', (err as Error).message);
    }
  }

  // Membership validation
  let membershipResult;
  try {
    membershipResult = await deps.membershipAdapter.validate(submission.membershipNumber);
  } catch (err) {
    const errMsg = (err as Error).message;
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

  // Track proposal for vote closing
  const votingDays = parseInt(cfg.VOTING_DURATION_DAYS, 10);
  const votingClosesAt = new Date(postResult.postedAt.getTime() + votingDays * 86_400_000);

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
