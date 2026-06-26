"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeMembershipNumber = normalizeMembershipNumber;
exports.validateFields = validateFields;
exports.validateWebhookSecret = validateWebhookSecret;
const zod_1 = require("zod");
const uuid_1 = require("uuid");
const EMAIL_RE = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
// PCA membership numbers: letters/digits, 4-12 chars after normalization
const MEMBERSHIP_RE = /^[A-Z0-9\-]{4,20}$/;
const payloadSchema = zod_1.z.object({
    firstName: zod_1.z.string().trim().min(1, 'First name is required'),
    lastName: zod_1.z.string().trim().min(1, 'Last name is required'),
    email: zod_1.z.string().trim().min(1, 'Email is required'),
    membershipNumber: zod_1.z.string().trim().min(1, 'Membership number is required'),
    proposedName: zod_1.z.string().trim().min(1, 'Proposed region name is required'),
    whyItFits: zod_1.z.string().trim().min(1, 'Why this name fits is required'),
    submittedAt: zod_1.z.string().optional(),
});
function normalizeMembershipNumber(raw) {
    return raw.trim().toUpperCase().replace(/\s+/g, '');
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
    const submission = {
        submissionId: (0, uuid_1.v4)(),
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