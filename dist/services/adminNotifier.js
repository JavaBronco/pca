"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminNotifier = exports.AdminNotifier = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const rest_1 = require("@discordjs/rest");
const v10_1 = require("discord-api-types/v10");
const config_js_1 = require("../config.js");
/**
 * Sends admin alerts via Discord DM to admin channel and/or email.
 * Includes enough internal detail for debugging but never exposes PII publicly.
 */
class AdminNotifier {
    rest;
    constructor() {
        const cfg = (0, config_js_1.getConfig)();
        this.rest = new rest_1.REST({ version: '10' }).setToken(cfg.DISCORD_BOT_TOKEN);
    }
    async notify(payload) {
        await Promise.allSettled([
            this.notifyDiscord(payload),
            this.notifyEmail(payload),
        ]);
    }
    async notifyDiscord(payload) {
        const cfg = (0, config_js_1.getConfig)();
        const message = this.formatDiscordAlert(payload);
        try {
            await this.rest.post(v10_1.Routes.channelMessages(cfg.DISCORD_ADMIN_CHANNEL_ID), {
                body: { content: message },
            });
        }
        catch (err) {
            console.error('[ADMIN] Discord notify failed:', err.message);
        }
    }
    formatDiscordAlert(payload) {
        return [
            `**Admin Alert — ${payload.event}**`,
            `Submission ID: \`${payload.submissionId}\``,
            `Proposed Name: ${payload.proposedName}`,
            `Time: ${payload.timestamp.toISOString()}`,
            `Detail: ${this.sanitizeDetail(payload.detail)}`,
        ].join('\n');
    }
    async notifyEmail(payload) {
        const cfg = (0, config_js_1.getConfig)();
        if (!cfg.SMTP_HOST || !cfg.ADMIN_EMAIL)
            return;
        const transporter = nodemailer_1.default.createTransport({
            host: cfg.SMTP_HOST,
            port: parseInt(cfg.SMTP_PORT, 10),
            auth: cfg.SMTP_USER
                ? { user: cfg.SMTP_USER, pass: cfg.SMTP_PASS }
                : undefined,
        });
        try {
            await transporter.sendMail({
                from: cfg.SMTP_USER ?? 'noreply@pca-voting.local',
                to: cfg.ADMIN_EMAIL,
                subject: `[PCA Voting] Admin Alert: ${payload.event}`,
                text: [
                    `Event: ${payload.event}`,
                    `Submission ID: ${payload.submissionId}`,
                    `Proposed Name: ${payload.proposedName}`,
                    `Timestamp: ${payload.timestamp.toISOString()}`,
                    `Detail: ${this.sanitizeDetail(payload.detail)}`,
                ].join('\n'),
            });
        }
        catch (err) {
            console.error('[ADMIN] Email notify failed:', err.message);
        }
    }
    /** Never include email addresses or member numbers in alert detail text. */
    sanitizeDetail(detail) {
        return detail
            .replace(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, '[EMAIL REDACTED]')
            .replace(/\b[A-Z0-9\-]{4,20}\b/g, '[ID REDACTED]');
    }
}
exports.AdminNotifier = AdminNotifier;
exports.adminNotifier = new AdminNotifier();
//# sourceMappingURL=adminNotifier.js.map