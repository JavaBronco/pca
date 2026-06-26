import { MembershipAdapter } from './membershipAdapter.js';
import { SheetsMembershipAdapter } from './sheetsMembershipAdapter.js';
import { ApiMembershipAdapter } from './apiMembershipAdapter.js';
import { MockMembershipAdapter } from './mockMembershipAdapter.js';
import { getConfig } from '../config.js';

export function createMembershipAdapter(): MembershipAdapter {
  const cfg = getConfig();

  switch (cfg.MEMBERSHIP_ADAPTER) {
    case 'sheets': {
      if (!cfg.GOOGLE_SERVICE_ACCOUNT_EMAIL || !cfg.GOOGLE_PRIVATE_KEY || !cfg.MEMBERS_SHEET_ID) {
        throw new Error(
          'Sheets adapter requires GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, MEMBERS_SHEET_ID',
        );
      }
      return new SheetsMembershipAdapter(
        cfg.MEMBERS_SHEET_ID,
        cfg.MEMBERS_SHEET_NAME,
        cfg.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        cfg.GOOGLE_PRIVATE_KEY,
      );
    }
    case 'api': {
      if (!cfg.PCA_API_BASE_URL || !cfg.PCA_API_KEY) {
        throw new Error('API adapter requires PCA_API_BASE_URL and PCA_API_KEY');
      }
      return new ApiMembershipAdapter(cfg.PCA_API_BASE_URL, cfg.PCA_API_KEY);
    }
    case 'mock':
      return new MockMembershipAdapter({
        'TESTVALID001': 'valid',
        'TESTEXPIRED001': 'expired',
        'TESTINVALID001': 'invalid',
      });
    default:
      throw new Error(`Unknown MEMBERSHIP_ADAPTER: ${cfg.MEMBERSHIP_ADAPTER}`);
  }
}
