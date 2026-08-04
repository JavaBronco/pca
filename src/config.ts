import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const configSchema = z.object({
  PORT: z.string().default('3000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  WEBHOOK_SECRET: z.string().min(32),

  DISCORD_BOT_TOKEN: z.string().min(1),
  DISCORD_VOTING_CHANNEL_ID: z.string().min(1),
  DISCORD_ADMIN_CHANNEL_ID: z.string().min(1),
  DISCORD_GUILD_ID: z.string().min(1),

  MEMBERSHIP_ADAPTER: z.enum(['sheets', 'api', 'mock']).default('sheets'),

  GOOGLE_SERVICE_ACCOUNT_EMAIL: z.string().email().optional(),
  GOOGLE_PRIVATE_KEY: z.string().optional(),
  SUBMISSIONS_SHEET_ID: z.string().optional(),
  MEMBERS_SHEET_ID: z.string().optional(),
  MEMBERS_SHEET_NAME: z.string().default('Members'),
  SUBMISSIONS_SHEET_NAME: z.string().default('Submissions'),
  AUDIT_SHEET_NAME: z.string().default('Audit'),
  VOTES_SHEET_NAME: z.string().default('Votes'),
  PROPOSALS_SHEET_NAME: z.string().default('Proposals'),
  LEADERBOARD_THREAD_ID: z.string().optional(),

  PCA_API_BASE_URL: z.string().url().optional(),
  PCA_API_KEY: z.string().optional(),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().default('587'),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  ADMIN_EMAIL: z.string().email().optional(),

  VOTING_DURATION_DAYS: z.string().default('7'),

  RATE_LIMIT_RETRY_ATTEMPTS: z.string().default('3'),
  RATE_LIMIT_BASE_DELAY_MS: z.string().default('1000'),
});

export type Config = z.infer<typeof configSchema>;

function loadConfig(): Config {
  const result = configSchema.safeParse(process.env);
  if (!result.success) {
    const missing = result.error.issues
      .map((i) => i.path.join('.'))
      .join(', ');
    throw new Error(`Missing or invalid config: ${missing}`);
  }
  return result.data;
}

let _config: Config | null = null;

export function getConfig(): Config {
  if (!_config) {
    _config = loadConfig();
  }
  return _config;
}

export function resetConfig(): void {
  _config = null;
}
