"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockMembershipAdapter = void 0;
/**
 * In-memory adapter for tests and local development.
 * Seed it with known numbers and their expected statuses.
 */
class MockMembershipAdapter {
    members;
    constructor(seed = {}) {
        this.members = new Map(Object.entries(seed));
    }
    setMember(number, status) {
        this.members.set(number.toUpperCase(), status);
    }
    async validate(membershipNumber) {
        const status = this.members.get(membershipNumber) ?? 'not_found';
        return { status, validatedAt: new Date() };
    }
}
exports.MockMembershipAdapter = MockMembershipAdapter;
//# sourceMappingURL=mockMembershipAdapter.js.map