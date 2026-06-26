import { FormSubmission } from '../src/types';

// Mock the config and REST client before importing DiscordService
jest.mock('../src/config', () => ({
  getConfig: () => ({
    DISCORD_BOT_TOKEN: 'Bot test-token',
    DISCORD_VOTING_CHANNEL_ID: '111111111111111111',
    DISCORD_ADMIN_CHANNEL_ID: '222222222222222222',
    RATE_LIMIT_RETRY_ATTEMPTS: '3',
    RATE_LIMIT_BASE_DELAY_MS: '100',
  }),
}));

const mockPost = jest.fn();
const mockPut = jest.fn();

jest.mock('@discordjs/rest', () => ({
  REST: jest.fn().mockImplementation(() => ({
    setToken: jest.fn().mockReturnThis(),
    post: mockPost,
    put: mockPut,
  })),
}));

import { DiscordService } from '../src/services/discordService';

const SAMPLE_SUBMISSION: FormSubmission = {
  submissionId: 'sub-001',
  receivedAt: new Date('2024-01-01T00:00:00Z'),
  firstName: 'Alice',
  lastName: 'Smith',
  email: 'alice@example.com',
  membershipNumber: 'PCA-12345',
  proposedName: 'Blue Ridge Region',
  whyItFits: 'The mountains define our community.',
};

describe('DiscordService.postProposal', () => {
  let service: DiscordService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DiscordService();
  });

  it('posts a message and returns messageId', async () => {
    mockPost.mockResolvedValueOnce({ id: 'msg-001' });
    mockPut.mockResolvedValue({});

    const result = await service.postProposal(SAMPLE_SUBMISSION);
    expect(result.messageId).toBe('msg-001');
    expect(result.channelId).toBe('111111111111111111');
    expect(result.postedAt).toBeInstanceOf(Date);
  });

  it('includes proposedName and whyItFits in the message body', async () => {
    mockPost.mockResolvedValueOnce({ id: 'msg-002' });
    mockPut.mockResolvedValue({});

    await service.postProposal(SAMPLE_SUBMISSION);

    const postBody = mockPost.mock.calls[0][1].body;
    const content: string = postBody.content ?? '';
    expect(content).toContain('Blue Ridge Region');
    expect(content).toContain('The mountains define our community.');
  });

  it('does NOT include email in the message body', async () => {
    mockPost.mockResolvedValueOnce({ id: 'msg-003' });
    mockPut.mockResolvedValue({});

    await service.postProposal(SAMPLE_SUBMISSION);

    const postBody = mockPost.mock.calls[0][1].body;
    expect(JSON.stringify(postBody)).not.toContain('alice@example.com');
  });

  it('does NOT include membershipNumber in the message body', async () => {
    mockPost.mockResolvedValueOnce({ id: 'msg-004' });
    mockPut.mockResolvedValue({});

    await service.postProposal(SAMPLE_SUBMISSION);

    const postBody = mockPost.mock.calls[0][1].body;
    expect(JSON.stringify(postBody)).not.toContain('PCA-12345');
  });

  it('seeds 👍, 👎, 🤔 reactions after posting', async () => {
    mockPost.mockResolvedValueOnce({ id: 'msg-005' });
    mockPut.mockResolvedValue({});

    await service.postProposal(SAMPLE_SUBMISSION);

    const putCalls = mockPut.mock.calls.map((c) => c[0] as string);
    expect(putCalls.some((u) => u.includes(encodeURIComponent('👍')))).toBe(true);
    expect(putCalls.some((u) => u.includes(encodeURIComponent('👎')))).toBe(true);
    expect(putCalls.some((u) => u.includes(encodeURIComponent('🤔')))).toBe(true);
  });

  it('retries on HTTP 429 and succeeds on second attempt', async () => {
    mockPost
      .mockRejectedValueOnce({ status: 429, message: 'Rate limited' })
      .mockResolvedValueOnce({ id: 'msg-retry' });
    mockPut.mockResolvedValue({});

    const result = await service.postProposal(SAMPLE_SUBMISSION);
    expect(result.messageId).toBe('msg-retry');
    expect(mockPost).toHaveBeenCalledTimes(2);
  });

  it('throws after exhausting retries on persistent 429', async () => {
    mockPost.mockRejectedValue({ status: 429, message: 'Rate limited' });

    await expect(service.postProposal(SAMPLE_SUBMISSION)).rejects.toMatchObject({ status: 429 });
    expect(mockPost).toHaveBeenCalledTimes(3);
  });

  it('does not retry on 400 (non-retryable)', async () => {
    mockPost.mockRejectedValueOnce({ status: 400, message: 'Bad request' });

    await expect(service.postProposal(SAMPLE_SUBMISSION)).rejects.toMatchObject({ status: 400 });
    expect(mockPost).toHaveBeenCalledTimes(1);
  });
});
