import { MockMembershipAdapter } from '../src/adapters/mockMembershipAdapter';
import { ApiMembershipAdapter } from '../src/adapters/apiMembershipAdapter';

describe('MockMembershipAdapter', () => {
  it('returns valid for a seeded valid member', async () => {
    const adapter = new MockMembershipAdapter({ 'MEMBER001': 'valid' });
    const result = await adapter.validate('MEMBER001');
    expect(result.status).toBe('valid');
    expect(result.validatedAt).toBeInstanceOf(Date);
  });

  it('returns expired for a seeded expired member', async () => {
    const adapter = new MockMembershipAdapter({ 'MEMBER002': 'expired' });
    const result = await adapter.validate('MEMBER002');
    expect(result.status).toBe('expired');
  });

  it('returns invalid for a seeded invalid member', async () => {
    const adapter = new MockMembershipAdapter({ 'MEMBER003': 'invalid' });
    const result = await adapter.validate('MEMBER003');
    expect(result.status).toBe('invalid');
  });

  it('returns not_found for unknown member', async () => {
    const adapter = new MockMembershipAdapter({});
    const result = await adapter.validate('UNKNOWN999');
    expect(result.status).toBe('not_found');
  });

  it('setMember overrides existing entry', async () => {
    const adapter = new MockMembershipAdapter({ 'MEMBER001': 'valid' });
    adapter.setMember('MEMBER001', 'expired');
    const result = await adapter.validate('MEMBER001');
    expect(result.status).toBe('expired');
  });

  it('is case-insensitive when setting member', async () => {
    const adapter = new MockMembershipAdapter();
    adapter.setMember('member001', 'valid');
    const result = await adapter.validate('MEMBER001');
    expect(result.status).toBe('valid');
  });
});

describe('ApiMembershipAdapter', () => {
  const baseUrl = 'https://api.pca.example.com';
  const apiKey = 'test-key';

  beforeEach(() => {
    jest.resetAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function mockFetch(status: number, body: object) {
    global.fetch = jest.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    } as Response);
  }

  it('returns valid for ACTIVE status', async () => {
    mockFetch(200, { status: 'ACTIVE' });
    const adapter = new ApiMembershipAdapter(baseUrl, apiKey);
    const result = await adapter.validate('MBR001');
    expect(result.status).toBe('valid');
  });

  it('returns expired for EXPIRED status', async () => {
    mockFetch(200, { status: 'EXPIRED' });
    const adapter = new ApiMembershipAdapter(baseUrl, apiKey);
    const result = await adapter.validate('MBR002');
    expect(result.status).toBe('expired');
  });

  it('returns expired when ACTIVE member has past expiresAt', async () => {
    mockFetch(200, { status: 'ACTIVE', expiresAt: '2020-01-01T00:00:00Z' });
    const adapter = new ApiMembershipAdapter(baseUrl, apiKey);
    const result = await adapter.validate('MBR003');
    expect(result.status).toBe('expired');
  });

  it('returns invalid for INACTIVE status', async () => {
    mockFetch(200, { status: 'INACTIVE' });
    const adapter = new ApiMembershipAdapter(baseUrl, apiKey);
    const result = await adapter.validate('MBR004');
    expect(result.status).toBe('invalid');
  });

  it('returns not_found on HTTP 404', async () => {
    mockFetch(404, {});
    const adapter = new ApiMembershipAdapter(baseUrl, apiKey);
    const result = await adapter.validate('MBR999');
    expect(result.status).toBe('not_found');
  });

  it('returns error on HTTP 500', async () => {
    mockFetch(500, {});
    const adapter = new ApiMembershipAdapter(baseUrl, apiKey);
    const result = await adapter.validate('MBR000');
    expect(result.status).toBe('error');
    expect(result.message).toContain('500');
  });

  it('returns error when fetch throws (network failure)', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    const adapter = new ApiMembershipAdapter(baseUrl, apiKey);
    const result = await adapter.validate('MBR000');
    expect(result.status).toBe('error');
    expect(result.message).toContain('ECONNREFUSED');
  });

  it('returns error on malformed JSON response', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => { throw new SyntaxError('Unexpected token'); },
    } as unknown as Response);
    const adapter = new ApiMembershipAdapter(baseUrl, apiKey);
    const result = await adapter.validate('MBR000');
    expect(result.status).toBe('error');
  });
});
