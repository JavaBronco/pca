import { z } from 'zod';
import { FormSubmission, WebhookPayload } from '../types.js';
import { v4 as uuidv4 } from 'uuid';

const EMAIL_RE = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;

// PCA membership numbers: letters/digits, 4-12 chars after normalization
const MEMBERSHIP_RE = /^[A-Z0-9\-]{4,20}$/;

export interface ValidationError {
  field: string;
  message: string;
}

export interface FieldValidationResult {
  valid: boolean;
  errors: ValidationError[];
  submission?: FormSubmission;
}

const payloadSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required'),
  lastName: z.string().trim().min(1, 'Last name is required'),
  email: z.string().trim().min(1, 'Email is required'),
  membershipNumber: z.string().trim().min(1, 'Membership number is required'),
  proposedName: z.string().trim().min(1, 'Proposed region name is required'),
  whyItFits: z.string().trim().min(1, 'Why this name fits is required'),
  submittedAt: z.string().optional(),
});

export function normalizeMembershipNumber(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '');
}

export function validateFields(payload: unknown): FieldValidationResult {
  const parsed = payloadSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      valid: false,
      errors: parsed.error.issues.map((i) => ({
        field: String(i.path[0] ?? 'unknown'),
        message: i.message,
      })),
    };
  }

  const data = parsed.data;
  const errors: ValidationError[] = [];

  if (!EMAIL_RE.test(data.email)) {
    errors.push({ field: 'email', message: 'Invalid email format' });
  }

  const normalizedMembership = normalizeMembershipNumber(data.membershipNumber);
  if (!MEMBERSHIP_RE.test(normalizedMembership)) {
    errors.push({
      field: 'membershipNumber',
      message: 'Membership number contains invalid characters or wrong length',
    });
  }

  if (data.proposedName.length > 100) {
    errors.push({ field: 'proposedName', message: 'Proposed name exceeds 100 characters' });
  }

  if (data.whyItFits.length > 2000) {
    errors.push({ field: 'whyItFits', message: 'Explanation exceeds 2000 characters' });
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  const submission: FormSubmission = {
    submissionId: uuidv4(),
    receivedAt: new Date(),
    firstName: data.firstName.trim(),
    lastName: data.lastName.trim(),
    email: data.email.trim().toLowerCase(),
    membershipNumber: normalizedMembership,
    proposedName: data.proposedName.trim(),
    whyItFits: data.whyItFits.trim(),
  };

  return { valid: true, errors: [], submission };
}

export function validateWebhookSecret(
  header: string | undefined,
  expectedSecret: string,
): boolean {
  if (!header) return false;
  // Constant-time comparison to prevent timing attacks
  if (header.length !== expectedSecret.length) return false;
  let mismatch = 0;
  for (let i = 0; i < header.length; i++) {
    mismatch |= header.charCodeAt(i) ^ expectedSecret.charCodeAt(i);
  }
  return mismatch === 0;
}
