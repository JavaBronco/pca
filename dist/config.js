"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getConfig = getConfig;
exports.resetConfig = resetConfig;
const dotenv_1 = __importDefault(require("dotenv"));
const zod_1 = require("zod");
dotenv_1.default.config();
const configSchema = zod_1.z.object({
    PORT: zod_1.z.string().default('3000'),
    NODE_ENV: zod_1.z.enum(['development', 'production', 'test']).default('development'),
    WEBHOOK_SECRET: zod_1.z.string().min(32),
    DISCORD_BOT_TOKEN: zod_1.z.string().min(1),
    DISCORD_VOTING_CHANNEL_ID: zod_1.z.string().min(1),
    DISCORD_ADMIN_CHANNEL_ID: zod_1.z.string().min(1),
    DISCORD_GUILD_ID: zod_1.z.string().min(1),
    MEMBERSHIP_ADAPTER: zod_1.z.enum(['sheets', 'api', 'mock']).default('sheets'),
    GOOGLE_SERVICE_ACCOUNT_EMAIL: zod_1.z.string().email().optional(),
    GOOGLE_PRIVATE_KEY: zod_1.z.string().optional(),
    SUBMISSIONS_SHEET_ID: zod_1.z.string().optional(),
    MEMBERS_SHEET_ID: zod_1.z.string().optional(),
    MEMBERS_SHEET_NAME: zod_1.z.string().default('Members'),
    SUBMISSIONS_SHEET_NAME: zod_1.z.string().default('Submissions'),
    AUDIT_SHEET_NAME: zod_1.z.string().default('Audit'),
    VOTES_SHEET_NAME: zod_1.z.string().default('Votes'),
    PROPOSALS_SHEET_NAME: zod_1.z.string().default('Proposals'),
    LEADERBOARD_THREAD_ID: zod_1.z.string().optional(),
    PCA_API_BASE_URL: zod_1.z.string().url().optional(),
    PCA_API_KEY: zod_1.z.string().optional(),
    SMTP_HOST: zod_1.z.string().optional(),
    SMTP_PORT: zod_1.z.string().default('587'),
    SMTP_USER: zod_1.z.string().optional(),
    SMTP_PASS: zod_1.z.string().optional(),
    ADMIN_EMAIL: zod_1.z.string().email().optional(),
    VOTING_DURATION_DAYS: zod_1.z.string().default('7'),
    RATE_LIMIT_RETRY_ATTEMPTS: zod_1.z.string().default('3'),
    RATE_LIMIT_BASE_DELAY_MS: zod_1.z.string().default('1000'),
});
function loadConfig() {
    const result = configSchema.safeParse(process.env);
    if (!result.success) {
        const missing = result.error.issues
            .map((i) => i.path.join('.'))
            .join(', ');
        throw new Error(`Missing or invalid config: ${missing}`);
    }
    return result.data;
}
let _config = null;
function getConfig() {
    if (!_config) {
        _config = loadConfig();
    }
    return _config;
}
function resetConfig() {
    _config = null;
}
//# sourceMappingURL=config.js.map