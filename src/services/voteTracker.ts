import { VoteRecord, VoteTotals, ProposalRecord } from '../types.js';
import { appendRow, getRows, updateCell } from './sheetsClient.js';
import { getConfig } from '../config.js';

const EMOJI_MAP: Record<string, VoteRecord['voteType']> = {
  '👍': 'approve',
  '👎': 'reject',
  '🤔': 'discuss',
};

/**
 * All Discord user IDs are stored as-is; they are not PII under GDPR since
 * they are pseudonymous platform identifiers. No mapping to real identities
 * is stored.
 */
export class VoteTracker {
  async recordProposal(record: ProposalRecord): Promise<void> {
    const cfg = getConfig();
    if (!cfg.SUBMISSIONS_SHEET_ID) return;
    await appendRow(cfg.SUBMISSIONS_SHEET_ID, cfg.PROPOSALS_SHEET_NAME, [
      record.submissionId,
      record.messageId,
      record.proposedName,
      record.postedAt.toISOString(),
      record.votingClosesAt?.toISOString() ?? '',
      record.closed ? 'TRUE' : 'FALSE',
      record.threadId,
    ]);
  }

  async recordVote(vote: VoteRecord): Promise<{ accepted: boolean; reason?: string }> {
    const cfg = getConfig();
    if (!cfg.SUBMISSIONS_SHEET_ID) {
      return { accepted: true };
    }

    const existing = await this.getExistingVote(vote.messageId, vote.discordUserId);
    if (existing) {
      return { accepted: false, reason: 'duplicate_vote' };
    }

    await appendRow(cfg.SUBMISSIONS_SHEET_ID, cfg.VOTES_SHEET_NAME, [
      vote.messageId,
      vote.discordUserId,
      vote.voteType,
      vote.recordedAt.toISOString(),
    ]);

    return { accepted: true };
  }

  async removeVote(messageId: string, discordUserId: string, emoji: string): Promise<void> {
    const cfg = getConfig();
    if (!cfg.SUBMISSIONS_SHEET_ID) return;

    const voteType = EMOJI_MAP[emoji];
    if (!voteType) return;

    const rows = await getRows(cfg.SUBMISSIONS_SHEET_ID, cfg.VOTES_SHEET_NAME);
    for (let i = 0; i < rows.length; i++) {
      if (rows[i][0] === messageId && rows[i][1] === discordUserId && rows[i][2] === voteType) {
        // Mark removed in column E (index 4)
        await updateCell(cfg.SUBMISSIONS_SHEET_ID, cfg.VOTES_SHEET_NAME, i + 2, 5, 'REMOVED');
        break;
      }
    }
  }

  async getTotals(messageId: string): Promise<VoteTotals> {
    const cfg = getConfig();
    const totals: VoteTotals = { messageId, approve: 0, reject: 0, discuss: 0 };
    if (!cfg.SUBMISSIONS_SHEET_ID) return totals;

    const rows = await getRows(cfg.SUBMISSIONS_SHEET_ID, cfg.VOTES_SHEET_NAME);
    for (const row of rows) {
      if (row[0] !== messageId) continue;
      if (row[4] === 'REMOVED') continue;

      const voteType = row[2] as VoteRecord['voteType'];
      if (voteType === 'approve') totals.approve++;
      else if (voteType === 'reject') totals.reject++;
      else if (voteType === 'discuss') totals.discuss++;
    }
    return totals;
  }

  async getProposalsReadyToClose(): Promise<ProposalRecord[]> {
    const cfg = getConfig();
    if (!cfg.SUBMISSIONS_SHEET_ID) return [];

    const rows = await getRows(cfg.SUBMISSIONS_SHEET_ID, cfg.PROPOSALS_SHEET_NAME);
    const now = new Date();
    const ready: ProposalRecord[] = [];

    for (const row of rows) {
      const closed = row[5] === 'TRUE';
      if (closed) continue;
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

  async markClosed(messageId: string): Promise<void> {
    const cfg = getConfig();
    if (!cfg.SUBMISSIONS_SHEET_ID) return;

    const rows = await getRows(cfg.SUBMISSIONS_SHEET_ID, cfg.PROPOSALS_SHEET_NAME);
    for (let i = 0; i < rows.length; i++) {
      if (rows[i][1] === messageId) {
        await updateCell(cfg.SUBMISSIONS_SHEET_ID, cfg.PROPOSALS_SHEET_NAME, i + 2, 6, 'TRUE');
        break;
      }
    }
  }

  private async getExistingVote(
    messageId: string,
    discordUserId: string,
  ): Promise<boolean> {
    const cfg = getConfig();
    if (!cfg.SUBMISSIONS_SHEET_ID) return false;

    const rows = await getRows(cfg.SUBMISSIONS_SHEET_ID, cfg.VOTES_SHEET_NAME);
    return rows.some(
      (row) => row[0] === messageId && row[1] === discordUserId && row[4] !== 'REMOVED',
    );
  }

  emojiToVoteType(emoji: string): VoteRecord['voteType'] | null {
    return EMOJI_MAP[emoji] ?? null;
  }
}

export const voteTracker = new VoteTracker();
