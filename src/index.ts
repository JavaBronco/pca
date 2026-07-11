import express, { Request, Response, NextFunction } from 'express';
import { parseMemberFile, importMembersToSheet } from './services/memberImporter.js';
import { getConfig } from './config.js';
import { handleFormSubmission } from './handlers/formHandler.js';
import { createMembershipAdapter } from './adapters/adapterFactory.js';
import { DiscordService, discordService } from './services/discordService.js';
import { VoteTracker, voteTracker } from './services/voteTracker.js';
import { AdminNotifier, adminNotifier } from './services/adminNotifier.js';
import { AuditLogger, auditLogger } from './services/auditLogger.js';
import { createDiscordBot, closeExpiredVoting } from './bot/reactionHandler.js';

const app = express();
app.use(express.json({ limit: '100kb' }));

// Reject oversized bodies early
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  res.status(400).json({ error: 'Request too large' });
});

const membershipAdapter = createMembershipAdapter();
const deps = {
  membershipAdapter,
  discordService,
  voteTracker,
  adminNotifier,
  auditLogger,
};

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Google Apps Script webhook
app.post('/webhook/form-submission', async (req: Request, res: Response) => {
  const secret = req.headers['x-webhook-secret'] as string | undefined;

  let result;
  try {
    result = await handleFormSubmission(req.body, secret, deps);
  } catch (err) {
    console.error('[Server] Unhandled error in form handler:', (err as Error).message);
    res.status(500).json({ error: 'Internal error' });
    return;
  }

  switch (result.outcome) {
    case 'accepted':
      res.status(200).json({ received: true, submissionId: result.submissionId });
      break;
    case 'validation_failed':
      res.status(422).json({ error: 'Validation failed', details: result.errors });
      break;
    case 'membership_denied':
      // Return 200 to Apps Script (don't reveal why the submission was rejected)
      res.status(200).json({ received: true, submissionId: result.submissionId });
      break;
    case 'error':
      res.status(result.message === 'Invalid webhook secret' ? 401 : 500).json({ error: result.message });
      break;
  }
});

// Import a new member list from a CSV/text file body
// Usage: POST /admin/import-members  (body = raw CSV text, Content-Type: text/plain)
// Header: X-Admin-Secret: <WEBHOOK_SECRET>
app.post('/admin/import-members', express.text({ limit: '10mb', type: '*/*' }), async (req: Request, res: Response) => {
  const cfg = getConfig();
  if (req.headers['x-admin-secret'] !== cfg.WEBHOOK_SECRET) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const raw = typeof req.body === 'string' ? req.body : '';
  if (!raw.trim()) {
    res.status(400).json({ error: 'Empty body — send the CSV file contents as plain text' });
    return;
  }

  try {
    const members = parseMemberFile(raw);
    if (members.length === 0) {
      res.status(400).json({ error: 'No member numbers found in file' });
      return;
    }

    const count = await importMembersToSheet(members);
    console.log(`[Import] Updated member list: ${count} active members`);
    res.json({ ok: true, imported: count });
  } catch (err) {
    console.error('[Import] Failed:', (err as Error).message);
    res.status(500).json({ error: 'Import failed', detail: (err as Error).message });
  }
});

// Manual trigger to close expired voting (can also be called by a cron)
app.post('/admin/close-voting', async (req: Request, res: Response) => {
  const cfg = getConfig();
  const auth = req.headers['x-admin-secret'];
  if (auth !== cfg.WEBHOOK_SECRET) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  await closeExpiredVoting(voteTracker, discordService, auditLogger);
  res.json({ ok: true });
});

// Manual trigger for the weekly leaderboard (also fires automatically every Saturday)
app.post('/admin/post-leaderboard', async (req: Request, res: Response) => {
  const cfg = getConfig();
  if (req.headers['x-admin-secret'] !== cfg.WEBHOOK_SECRET) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  try {
    const ranked = await voteTracker.getRankedProposals();
    await discordService.postLeaderboard(ranked);
    res.json({ ok: true, proposalCount: ranked.length });
  } catch (err) {
    console.error('[Leaderboard] Failed:', (err as Error).message);
    res.status(500).json({ error: 'Failed to post leaderboard' });
  }
});

function scheduleWeeklyLeaderboard(): void {
  function msUntilNextSaturdayNoon(): number {
    const now = new Date();
    // Target: Saturday 15:00 UTC = 8 AM Pacific (PDT, UTC-7)
    const target = new Date(now);
    const day = now.getUTCDay(); // 0=Sun … 6=Sat
    const daysUntilSat = (6 - day + 7) % 7 || 7; // next Saturday (never today even if Saturday)
    target.setUTCDate(now.getUTCDate() + daysUntilSat);
    target.setUTCHours(15, 0, 0, 0);
    return target.getTime() - now.getTime();
  }

  function scheduleNext(): void {
    const delay = msUntilNextSaturdayNoon();
    console.log(`[Leaderboard] Next post in ${Math.round(delay / 3600000)}h`);
    setTimeout(async () => {
      try {
        const ranked = await voteTracker.getRankedProposals();
        await discordService.postLeaderboard(ranked);
        console.log('[Leaderboard] Posted successfully');
      } catch (err) {
        console.error('[Leaderboard] Failed to post:', (err as Error).message);
      }
      scheduleNext();
    }, delay);
  }

  scheduleNext();
}

async function start(): Promise<void> {
  const cfg = getConfig();

  // Start Discord bot
  const botClient = createDiscordBot(voteTracker, discordService, auditLogger);
  await botClient.login(cfg.DISCORD_BOT_TOKEN);

  // Schedule periodic voting closer (every 30 minutes)
  setInterval(
    () => closeExpiredVoting(voteTracker, discordService, auditLogger),
    30 * 60 * 1000,
  );

  // Post weekly leaderboard every Saturday at 8 AM Pacific (PDT, UTC-7 = 15:00 UTC)
  scheduleWeeklyLeaderboard();

  const port = parseInt(cfg.PORT, 10);
  app.listen(port, () => {
    console.log(`[Server] Listening on port ${port} (${cfg.NODE_ENV})`);
  });
}

start().catch((err) => {
  console.error('[Server] Fatal startup error:', err.message);
  process.exit(1);
});

export { app };
