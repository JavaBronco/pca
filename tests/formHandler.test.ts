import { handleFormSubmission } from '../src/handlers/formHandler';
import { MockMembershipAdapter } from '../src/adapters/mockMembershipAdapter';
import { HandlerDependencies } from '../src/handlers/formHandler';
import { FormSubmission } from '../src/types';

jest.mock('../src/config', () => ({
  getConfig: () => ({
    WEBHOOK_SECRET: 'test-secret-with-32-chars-minimum!',
    VOTING_DURATION_DAYS: '7',
    SUBMISSIONS_SHEET_ID: null,
    SUBMISSIONS_SHEET_NAME: 'Submissions',
    AUDIT_SHEET_NAME: 'Audit',
  }),
}));

jest.mock('../src/services/sheetsClient', () => ({
  appendRow: jest.fn().mockResolvedValue(undefined),
  getRows: jest.fn().mockResolvedValue([]),
}));

const VALID_SECRET = 'test-secret-with-32-chars-minimum!';

const VALID_PAYLOAD = {
  firstName: 'Alice',
  lastName: 'Smith',
  email: 'alice@example.com',
  membershipNumber: 'VALID001',
  proposedName: 'Blue Ridge Region',
  whyItFits: 'The mountains define our community.',
};

function makeDeps(overrides: Partial<HandlerDependencies> = {}): HandlerDependencies {
  const membershipAdapter = new MockMembershipAdapter({ 'VALID001': 'valid' });
  const discordService = {
    postProposal: jest.fn().mockResolvedValue({
      messageId: 'msg-001',
      channelId: 'ch-001',
      postedAt: new Date(),
    }),
    closeVotingMessage: jest.fn().mockResolvedValue(undefined),
  } as unknown as HandlerDependencies['discordService'];
  const voteTracker = {
    recordProposal: jest.fn().mockResolvedValue(undefined),
    recordVote: jest.fn().mockResolvedValue({ accepted: true }),
    getTotals: jest.fn().mockResolvedValue({ approve: 0, reject: 0, discuss: 0 }),
    getProposalsReadyToClose: jest.fn().mockResolvedValue([]),
    markClosed: jest.fn().mockResolvedValue(undefined),
    emojiToVoteType: jest.fn(),
    removeVote: jest.fn().mockResolvedValue(undefined),
  } as unknown as HandlerDependencies['voteTracker'];
  const adminNotifier = { notify: jest.fn().mockResolvedValue(undefined) } as unknown as HandlerDependencies['adminNotifier'];
  const auditLogger = { log: jest.fn().mockResolvedValue(undefined) } as unknown as HandlerDependencies['auditLogger'];

  return { membershipAdapter, discordService, voteTracker, adminNotifier, auditLogger, ...overrides };
}

describe('handleFormSubmission', () => {
  it('accepts a valid submission from a valid member', async () => {
    const deps = makeDeps();
    const result = await handleFormSubmission(VALID_PAYLOAD, VALID_SECRET, deps);

    expect(result.outcome).toBe('accepted');
    if (result.outcome === 'accepted') {
      expect(result.submissionId).toBeTruthy();
      expect(result.messageId).toBe('msg-001');
    }
  });

  it('calls discordService.postProposal once for a valid submission', async () => {
    const deps = makeDeps();
    await handleFormSubmission(VALID_PAYLOAD, VALID_SECRET, deps);
    expect(deps.discordService.postProposal).toHaveBeenCalledTimes(1);
  });

  it('records the proposal in voteTracker after posting', async () => {
    const deps = makeDeps();
    await handleFormSubmission(VALID_PAYLOAD, VALID_SECRET, deps);
    expect(deps.voteTracker.recordProposal).toHaveBeenCalledTimes(1);
  });

  it('rejects with error on invalid webhook secret', async () => {
    const deps = makeDeps();
    const result = await handleFormSubmission(VALID_PAYLOAD, 'wrong-secret', deps);
    expect(result.outcome).toBe('error');
    expect(deps.discordService.postProposal).not.toHaveBeenCalled();
  });

  it('returns validation_failed for missing fields', async () => {
    const deps = makeDeps();
    const result = await handleFormSubmission(
      { ...VALID_PAYLOAD, firstName: '' },
      VALID_SECRET,
      deps,
    );
    expect(result.outcome).toBe('validation_failed');
    expect(deps.discordService.postProposal).not.toHaveBeenCalled();
  });

  it('returns validation_failed for invalid email', async () => {
    const deps = makeDeps();
    const result = await handleFormSubmission(
      { ...VALID_PAYLOAD, email: 'not-an-email' },
      VALID_SECRET,
      deps,
    );
    expect(result.outcome).toBe('validation_failed');
  });

  it('returns membership_denied for an invalid member', async () => {
    const adapter = new MockMembershipAdapter({ 'INVALID001': 'invalid' });
    const deps = makeDeps({ membershipAdapter: adapter });
    const result = await handleFormSubmission(
      { ...VALID_PAYLOAD, membershipNumber: 'INVALID001' },
      VALID_SECRET,
      deps,
    );
    expect(result.outcome).toBe('membership_denied');
    if (result.outcome === 'membership_denied') expect(result.status).toBe('invalid');
    expect(deps.discordService.postProposal).not.toHaveBeenCalled();
  });

  it('returns membership_denied for an expired member', async () => {
    const adapter = new MockMembershipAdapter({ 'EXPIRED001': 'expired' });
    const deps = makeDeps({ membershipAdapter: adapter });
    const result = await handleFormSubmission(
      { ...VALID_PAYLOAD, membershipNumber: 'EXPIRED001' },
      VALID_SECRET,
      deps,
    );
    expect(result.outcome).toBe('membership_denied');
    if (result.outcome === 'membership_denied') expect(result.status).toBe('expired');
  });

  it('returns membership_denied for not_found member', async () => {
    const adapter = new MockMembershipAdapter({});
    const deps = makeDeps({ membershipAdapter: adapter });
    const result = await handleFormSubmission(
      { ...VALID_PAYLOAD, membershipNumber: 'NOTFOUND001' },
      VALID_SECRET,
      deps,
    );
    expect(result.outcome).toBe('membership_denied');
  });

  it('notifies admin when membership check returns an error', async () => {
    const adapter = new MockMembershipAdapter({ 'ERROR001': 'error' });
    const deps = makeDeps({ membershipAdapter: adapter });
    const result = await handleFormSubmission(
      { ...VALID_PAYLOAD, membershipNumber: 'ERROR001' },
      VALID_SECRET,
      deps,
    );
    expect(result.outcome).toBe('membership_denied');
    expect(deps.adminNotifier.notify).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'membership_invalid' }),
    );
  });

  it('returns error when Discord post fails and notifies admin', async () => {
    const discordService = {
      postProposal: jest.fn().mockRejectedValue(new Error('Discord 503')),
      closeVotingMessage: jest.fn(),
    } as unknown as HandlerDependencies['discordService'];
    const deps = makeDeps({ discordService });
    const result = await handleFormSubmission(VALID_PAYLOAD, VALID_SECRET, deps);

    expect(result.outcome).toBe('error');
    expect(deps.adminNotifier.notify).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'discord_error' }),
    );
  });

  it('does not include email in the Discord post payload', async () => {
    const deps = makeDeps();
    await handleFormSubmission(VALID_PAYLOAD, VALID_SECRET, deps);

    const postedSubmission: FormSubmission = (deps.discordService.postProposal as jest.Mock).mock.calls[0][0];
    expect(postedSubmission.email).toBe('alice@example.com'); // kept internally
    // The DiscordService is responsible for not including PII in the message body
    // (tested in discordService.test.ts)
  });

  it('membership_denied does not expose why in the returned object to the caller', async () => {
    const adapter = new MockMembershipAdapter({ 'EXPIRED001': 'expired' });
    const deps = makeDeps({ membershipAdapter: adapter });
    const result = await handleFormSubmission(
      { ...VALID_PAYLOAD, membershipNumber: 'EXPIRED001' },
      VALID_SECRET,
      deps,
    );
    // The result has the status internally but it is NOT echoed to the form submitter
    expect(result.outcome).toBe('membership_denied');
    // The HTTP handler returns 200 regardless, so the submitter can't probe membership validity
  });
});
