import { FormSubmission } from '../types.js';
export interface ValidationError {
    field: string;
    message: string;
}
export interface FieldValidationResult {
    valid: boolean;
    errors: ValidationError[];
    submission?: FormSubmission;
}
export declare function normalizeMembershipNumber(raw: string): string;
export declare function validateFields(payload: unknown): FieldValidationResult;
export declare function validateWebhookSecret(header: string | undefined, expectedSecret: string): boolean;
//# sourceMappingURL=fieldValidator.d.ts.map