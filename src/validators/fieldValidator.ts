import { z } from 'zod';
import { FormSubmission } from '../types.js';
import { v4 as uuidv4 } from 'uuid';


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
  membershipNumber: z.string().trim().min(1, 'Membership number is required'),
  proposedName: z.string().trim().min(1, 'Proposed region name is required'),
  whyItFits: z.string().trim().min(1, 'What you like about this name is required'),
  submittedAt: z.string().optional(),
});

export function normalizeMembershipNumber(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '');
}

/**
 * Ensures the proposed name ends with "Region".
 * "West Coast" → "West Coast Region"
 * "West Coast Region" → "West Coast Region" (unchanged)
 * "west coast region" → "west coast region" (unchanged, already has it)
 */
/**
 * Converts a string to title case: "west coast" → "West Coast"
 */
function toTitleCase(str: string): string {
  return str.replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * Normalizes a proposed region name:
 * 1. Title-cases every word
 * 2. Appends "Region" if not already present
 *
 * "west coast"        → "West Coast Region"
 * "WEST COAST REGION" → "West Coast Region"
 * "Blue Ridge"        → "Blue Ridge Region"
 */
export function normalizeProposedName(raw: string): string {
  const titled = toTitleCase(raw.trim().toLowerCase());
  if (/\bRegion\s*$/i.test(titled)) return titled;
  return `${titled} Region`;
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

  const normalizedMembership = normalizeMembershipNumber(data.membershipNumber);

  if (data.proposedName.length > 100) {
    errors.push({ field: 'proposedName', message: 'Proposed name exceeds 100 characters' });
  }

  if (data.whyItFits.length > 2000) {
    errors.push({ field: 'whyItFits', message: 'Response exceeds 2000 characters' });
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  const submission: FormSubmission = {
    submissionId: uuidv4(),
    receivedAt: new Date(),
    membershipNumber: normalizedMembership,
    proposedName: normalizeProposedName(data.proposedName),
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
