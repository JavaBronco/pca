export interface FormSubmission {
  submissionId: string;
  receivedAt: Date;
  firstName: string;
  lastName: string;
  email: string;
  membershipNumber: string;
  proposedName: string;
  whyItFits: string;
}

export interface ValidatedSubmission extends FormSubmission {
  normalizedMembershipNumber: string;
}

export type MembershipStatus = 'valid' | 'invalid' | 'expired' | 'not_found' | 'error';

export interface MembershipValidationResult {
  status: MembershipStatus;
  message?: string;
  validatedAt: Date;
}

export interface DiscordPostResult {
  messageId: string;
  channelId: string;
  postedAt: Date;
}

export interface VoteRecord {
  messageId: string;
  discordUserId: string;
  voteType: 'approve' | 'reject' | 'discuss';
  recordedAt: Date;
}

export interface VoteTotals {
  messageId: string;
  approve: number;
  reject: number;
  discuss: number;
  closedAt?: Date;
}

export interface ProposalRecord {
  submissionId: string;
  messageId: string;
  proposedName: string;
  postedAt: Date;
  votingClosesAt?: Date;
  closed: boolean;
}

export interface AuditEntry {
  submissionId: string;
  timestamp: Date;
  event: string;
  membershipStatus?: MembershipStatus;
  discordMessageId?: string;
  error?: string;
}

export interface AdminAlertPayload {
  submissionId: string;
  event: 'validation_failed' | 'membership_invalid' | 'discord_error' | 'system_error';
  detail: string;
  proposedName: string;
  timestamp: Date;
}

export interface WebhookPayload {
  firstName: string;
  lastName: string;
  email: string;
  membershipNumber: string;
  proposedName: string;
  whyItFits: string;
  submittedAt: string;
}
