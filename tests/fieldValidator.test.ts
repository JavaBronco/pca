import { validateFields, normalizeMembershipNumber, validateWebhookSecret } from '../src/validators/fieldValidator';

const VALID_PAYLOAD = {
  firstName: 'Alice',
  lastName: 'Smith',
  email: 'alice@example.com',
  membershipNumber: 'PCA-12345',
  proposedName: 'Blue Ridge Region',
  whyItFits: 'The mountains define our community.',
};

describe('validateFields', () => {
  it('accepts a fully valid payload', () => {
    const result = validateFields(VALID_PAYLOAD);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.submission).toBeDefined();
    expect(result.submission!.email).toBe('alice@example.com');
    expect(result.submission!.membershipNumber).toBe('PCA-12345');
  });

  it('rejects missing first name', () => {
    const result = validateFields({ ...VALID_PAYLOAD, firstName: '' });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'firstName')).toBe(true);
  });

  it('rejects missing last name', () => {
    const result = validateFields({ ...VALID_PAYLOAD, lastName: '' });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'lastName')).toBe(true);
  });

  it('rejects missing email', () => {
    const result = validateFields({ ...VALID_PAYLOAD, email: '' });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'email')).toBe(true);
  });

  it('rejects invalid email format', () => {
    const result = validateFields({ ...VALID_PAYLOAD, email: 'not-an-email' });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'email')).toBe(true);
  });

  it('accepts emails with subdomains and plus-addressing', () => {
    const result = validateFields({ ...VALID_PAYLOAD, email: 'user+tag@mail.example.co.uk' });
    expect(result.valid).toBe(true);
  });

  it('rejects missing membership number', () => {
    const result = validateFields({ ...VALID_PAYLOAD, membershipNumber: '' });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'membershipNumber')).toBe(true);
  });

  it('rejects membership number with invalid characters', () => {
    const result = validateFields({ ...VALID_PAYLOAD, membershipNumber: 'PCA 123!!' });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'membershipNumber')).toBe(true);
  });

  it('rejects missing proposedName', () => {
    const result = validateFields({ ...VALID_PAYLOAD, proposedName: '' });
    expect(result.valid).toBe(false);
  });

  it('rejects missing whyItFits', () => {
    const result = validateFields({ ...VALID_PAYLOAD, whyItFits: '' });
    expect(result.valid).toBe(false);
  });

  it('rejects proposedName over 100 characters', () => {
    const result = validateFields({ ...VALID_PAYLOAD, proposedName: 'A'.repeat(101) });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'proposedName')).toBe(true);
  });

  it('rejects whyItFits over 2000 characters', () => {
    const result = validateFields({ ...VALID_PAYLOAD, whyItFits: 'W'.repeat(2001) });
    expect(result.valid).toBe(false);
  });

  it('trims whitespace from all string fields', () => {
    const result = validateFields({
      ...VALID_PAYLOAD,
      firstName: '  Alice  ',
      lastName: '  Smith  ',
      email: '  alice@example.com  ',
    });
    expect(result.valid).toBe(true);
    expect(result.submission!.firstName).toBe('Alice');
    expect(result.submission!.lastName).toBe('Smith');
    expect(result.submission!.email).toBe('alice@example.com');
  });

  it('lowercases the email address', () => {
    const result = validateFields({ ...VALID_PAYLOAD, email: 'ALICE@EXAMPLE.COM' });
    expect(result.valid).toBe(true);
    expect(result.submission!.email).toBe('alice@example.com');
  });

  it('assigns a unique submissionId', () => {
    const r1 = validateFields(VALID_PAYLOAD);
    const r2 = validateFields(VALID_PAYLOAD);
    expect(r1.submission!.submissionId).not.toBe(r2.submission!.submissionId);
  });

  it('rejects a completely empty object', () => {
    const result = validateFields({});
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('rejects null payload', () => {
    const result = validateFields(null);
    expect(result.valid).toBe(false);
  });
});

describe('normalizeMembershipNumber', () => {
  it('uppercases and trims', () => {
    expect(normalizeMembershipNumber('  pca-12345  ')).toBe('PCA-12345');
  });

  it('removes internal whitespace', () => {
    expect(normalizeMembershipNumber('PCA 12345')).toBe('PCA12345');
  });
});

describe('validateWebhookSecret', () => {
  const secret = 'super-secret-key-for-testing-1234';

  it('accepts matching secret', () => {
    expect(validateWebhookSecret(secret, secret)).toBe(true);
  });

  it('rejects mismatched secret', () => {
    expect(validateWebhookSecret('wrong-secret-xxxxxxxxxxxxxxxxxx', secret)).toBe(false);
  });

  it('rejects undefined header', () => {
    expect(validateWebhookSecret(undefined, secret)).toBe(false);
  });

  it('rejects empty string', () => {
    expect(validateWebhookSecret('', secret)).toBe(false);
  });
});
