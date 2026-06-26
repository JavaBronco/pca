"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMembershipAdapter = createMembershipAdapter;
const sheetsMembershipAdapter_js_1 = require("./sheetsMembershipAdapter.js");
const apiMembershipAdapter_js_1 = require("./apiMembershipAdapter.js");
const mockMembershipAdapter_js_1 = require("./mockMembershipAdapter.js");
const config_js_1 = require("../config.js");
function createMembershipAdapter() {
    const cfg = (0, config_js_1.getConfig)();
    switch (cfg.MEMBERSHIP_ADAPTER) {
        case 'sheets': {
            if (!cfg.GOOGLE_SERVICE_ACCOUNT_EMAIL || !cfg.GOOGLE_PRIVATE_KEY || !cfg.MEMBERS_SHEET_ID) {
                throw new Error('Sheets adapter requires GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, MEMBERS_SHEET_ID');
            }
            return new sheetsMembershipAdapter_js_1.SheetsMembershipAdapter(cfg.MEMBERS_SHEET_ID, cfg.MEMBERS_SHEET_NAME, cfg.GOOGLE_SERVICE_ACCOUNT_EMAIL, cfg.GOOGLE_PRIVATE_KEY);
        }
        case 'api': {
            if (!cfg.PCA_API_BASE_URL || !cfg.PCA_API_KEY) {
                throw new Error('API adapter requires PCA_API_BASE_URL and PCA_API_KEY');
            }
            return new apiMembershipAdapter_js_1.ApiMembershipAdapter(cfg.PCA_API_BASE_URL, cfg.PCA_API_KEY);
        }
        case 'mock':
            return new mockMembershipAdapter_js_1.MockMembershipAdapter({
                'TESTVALID001': 'valid',
                'TESTEXPIRED001': 'expired',
                'TESTINVALID001': 'invalid',
            });
        default:
            throw new Error(`Unknown MEMBERSHIP_ADAPTER: ${cfg.MEMBERSHIP_ADAPTER}`);
    }
}
//# sourceMappingURL=adapterFactory.js.map