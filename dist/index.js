"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const express_1 = __importDefault(require("express"));
const config_js_1 = require("./config.js");
const formHandler_js_1 = require("./handlers/formHandler.js");
const adapterFactory_js_1 = require("./adapters/adapterFactory.js");
const discordService_js_1 = require("./services/discordService.js");
const voteTracker_js_1 = require("./services/voteTracker.js");
const adminNotifier_js_1 = require("./services/adminNotifier.js");
const auditLogger_js_1 = require("./services/auditLogger.js");
const reactionHandler_js_1 = require("./bot/reactionHandler.js");
const app = (0, express_1.default)();
exports.app = app;
app.use(express_1.default.json({ limit: '100kb' }));
// Reject oversized bodies early
app.use((err, _req, res, _next) => {
    res.status(400).json({ error: 'Request too large' });
});
const membershipAdapter = (0, adapterFactory_js_1.createMembershipAdapter)();
const deps = {
    membershipAdapter,
    discordService: discordService_js_1.discordService,
    voteTracker: voteTracker_js_1.voteTracker,
    adminNotifier: adminNotifier_js_1.adminNotifier,
    auditLogger: auditLogger_js_1.auditLogger,
};
// Health check
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
// Google Apps Script webhook
app.post('/webhook/form-submission', async (req, res) => {
    const secret = req.headers['x-webhook-secret'];
    let result;
    try {
        result = await (0, formHandler_js_1.handleFormSubmission)(req.body, secret, deps);
    }
    catch (err) {
        console.error('[Server] Unhandled error in form handler:', err.message);
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
// Manual trigger to close expired voting (can also be called by a cron)
app.post('/admin/close-voting', async (req, res) => {
    const cfg = (0, config_js_1.getConfig)();
    const auth = req.headers['x-admin-secret'];
    if (auth !== cfg.WEBHOOK_SECRET) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }
    await (0, reactionHandler_js_1.closeExpiredVoting)(voteTracker_js_1.voteTracker, discordService_js_1.discordService, auditLogger_js_1.auditLogger);
    res.json({ ok: true });
});
async function start() {
    const cfg = (0, config_js_1.getConfig)();
    // Start Discord bot
    const botClient = (0, reactionHandler_js_1.createDiscordBot)(voteTracker_js_1.voteTracker, discordService_js_1.discordService, auditLogger_js_1.auditLogger);
    await botClient.login(cfg.DISCORD_BOT_TOKEN);
    // Schedule periodic voting closer (every 30 minutes)
    setInterval(() => (0, reactionHandler_js_1.closeExpiredVoting)(voteTracker_js_1.voteTracker, discordService_js_1.discordService, auditLogger_js_1.auditLogger), 30 * 60 * 1000);
    const port = parseInt(cfg.PORT, 10);
    app.listen(port, () => {
        console.log(`[Server] Listening on port ${port} (${cfg.NODE_ENV})`);
    });
}
start().catch((err) => {
    console.error('[Server] Fatal startup error:', err.message);
    process.exit(1);
});
//# sourceMappingURL=index.js.map