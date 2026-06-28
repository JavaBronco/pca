"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeMembershipNumber = normalizeMembershipNumber;
exports.normalizeProposedName = normalizeProposedName;
exports.validateFields = validateFields;
exports.validateWebhookSecret = validateWebhookSecret;
const zod_1 = require("zod");
const uuid_1 = require("uuid");
const payloadSchema = zod_1.z.object({
    membershipNumber: zod_1.z.string().trim().min(1, 'Membership number is required'),
    proposedName: zod_1.z.string().trim().min(1, 'Proposed region name is required'),
    whyItFits: zod_1.z.string().trim().min(1, 'What you like about this name is required'),
    submittedAt: zod_1.z.string().optional(),
});
function normalizeMembershipNumber(raw) {
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
function toTitleCase(str) {
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
function normalizeProposedName(raw) {
    const titled = toTitleCase(raw.trim().toLowerCase());
    if (/\bRegion\s*$/i.test(titled))
        return titled;
    return `${titled} Region`;
}
function validateFields(payload) {
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
    const errors = [];
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
    const submission = {
        submissionId: (0, uuid_1.v4)(),
        receivedAt: new Date(),
        membershipNumber: normalizedMembership,
        proposedName: normalizeProposedName(data.proposedName),
        whyItFits: data.whyItFits.trim(),
    };
    return { valid: true, errors: [], submission };
}
function validateWebhookSecret(header, expectedSecret) {
    if (!header)
        return false;
    // Constant-time comparison to prevent timing attacks
    if (header.length !== expectedSecret.length)
        return false;
    let mismatch = 0;
    for (let i = 0; i < header.length; i++) {
        mismatch |= header.charCodeAt(i) ^ expectedSecret.charCodeAt(i);
    }
    return mismatch === 0;
}
//# sourceMappingURL=fieldValidator.js.map