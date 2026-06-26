import { VoteTracker } from '../src/services/voteTracker';
import { VoteRecord, ProposalRecord } from '../src/types';

jest.mock('../src/config', () => ({
  getConfig: () => ({
    SUBMISSIONS_SHEET_ID: null, // Disable Sheets I/O in unit tests
    VOTES_SHEET_NAME: 'Votes',
    PROPOSALS_SHEET_NAME: 'Proposals',
  }),
}));

jest.mock('../src/services/sheetsClient', () => ({
  appendRow: jest.fn().mockResolvedValue(undefined),
  getRows: jest.fn().mockResolvedValue([]),
  updateCell: jest.fn().mockResolvedValue(undefined),
}));

describe('VoteTracker', () => {
  let tracker: VoteTracker;

  const makeVote = (overrides: Partial<VoteRecord> = {}): VoteRecord => ({
    messageId: 'msg-001',
    discordUserId: 'user-001',
    voteType: 'approve',
    recordedAt: new Date(),
    ...overrides,
  });

  const makeProposal = (): ProposalRecord => ({
    submissionId: 'sub-001',
    messageId: 'msg-001',
    proposedName: 'Blue Ridge Region',
    postedAt: new Date(),
    votingClosesAt: new Date(Date.now() + 7 * 86_400_000),
    closed: false,
  });

  beforeEach(() => {
    tracker = new VoteTracker();
  });

  describe('emojiToVoteType', () => {
    it('maps 👍 → approve', () => {
      expect(tracker.emojiToVoteType('👍')).toBe('approve');
    });

    it('maps 👎 → reject', () => {
      expect(tracker.emojiToVoteType('👎')).toBe('reject');
    });

    it('maps 🤔 → discuss', () => {
      expect(tracker.emojiToVoteType('🤔')).toBe('discuss');
    });

    it('returns null for unknown emoji', () => {
      expect(tracker.emojiToVoteType('❤️')).toBeNull();
    });
  });

  describe('recordVote (in-memory, no sheets)', () => {
    it('accepts a valid vote and returns accepted: true', async () => {
      const result = await tracker.recordVote(makeVote());
      expect(result.accepted).toBe(true);
    });

    it('accepts different vote types from the same user on different messages', async () => {
      const r1 = await tracker.recordVote(makeVote({ messageId: 'msg-A' }));
      const r2 = await tracker.recordVote(makeVote({ messageId: 'msg-B' }));
      expect(r1.accepted).toBe(true);
      expect(r2.accepted).toBe(true);
    });
  });

  describe('getTotals (no sheets)', () => {
    it('returns zeroed totals when SUBMISSIONS_SHEET_ID is null', async () => {
      const totals = await tracker.getTotals('msg-001');
      expect(totals).toEqual({ messageId: 'msg-001', approve: 0, reject: 0, discuss: 0 });
    });
  });

  describe('recordProposal', () => {
    it('resolves without error when SUBMISSIONS_SHEET_ID is null', async () => {
      await expect(tracker.recordProposal(makeProposal())).resolves.toBeUndefined();
    });
  });
});

describe('VoteTracker with mocked Sheets', () => {
  const sheetsModule = require('../src/services/sheetsClient');
  const configModule = require('../src/config');
  let appendRow: jest.Mock;
  let getRows: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    appendRow = sheetsModule.appendRow as jest.Mock;
    getRows = sheetsModule.getRows as jest.Mock;
    jest.spyOn(configModule, 'getConfig').mockReturnValue({
      SUBMISSIONS_SHEET_ID: 'sheet-id-123',
      VOTES_SHEET_NAME: 'Votes',
      PROPOSALS_SHEET_NAME: 'Proposals',
      AUDIT_SHEET_NAME: 'Audit',
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('rejects a duplicate vote from the same user on the same message', async () => {
    // First call to getRows returns an existing vote row for user-001 / msg-001
    getRows.mockResolvedValue([
      ['msg-001', 'user-001', 'approve', '2024-01-01T00:00:00Z', ''],
    ]);

    const tracker = new VoteTracker();
    const result = await tracker.recordVote({
      messageId: 'msg-001',
      discordUserId: 'user-001',
      voteType: 'reject',
      recordedAt: new Date(),
    });

    expect(result.accepted).toBe(false);
    expect(result.reason).toBe('duplicate_vote');
    expect(appendRow).not.toHaveBeenCalled();
  });

  it('allows a vote after the previous one was REMOVED', async () => {
    getRows.mockResolvedValue([
      ['msg-001', 'user-001', 'approve', '2024-01-01T00:00:00Z', 'REMOVED'],
    ]);

    const tracker = new VoteTracker();
    const result = await tracker.recordVote({
      messageId: 'msg-001',
      discordUserId: 'user-001',
      voteType: 'reject',
      recordedAt: new Date(),
    });

    expect(result.accepted).toBe(true);
    expect(appendRow).toHaveBeenCalledTimes(1);
  });

  it('computes totals correctly from sheet rows', async () => {
    getRows.mockResolvedValue([
      ['msg-001', 'user-A', 'approve', '2024-01-01T00:00:00Z', ''],
      ['msg-001', 'user-B', 'approve', '2024-01-01T00:00:00Z', ''],
      ['msg-001', 'user-C', 'reject', '2024-01-01T00:00:00Z', ''],
      ['msg-001', 'user-D', 'discuss', '2024-01-01T00:00:00Z', ''],
      ['msg-001', 'user-E', 'approve', '2024-01-01T00:00:00Z', 'REMOVED'],
      ['msg-002', 'user-F', 'approve', '2024-01-01T00:00:00Z', ''], // different message
    ]);

    const tracker = new VoteTracker();
    const totals = await tracker.getTotals('msg-001');

    expect(totals.approve).toBe(2);
    expect(totals.reject).toBe(1);
    expect(totals.discuss).toBe(1);
  });
});
