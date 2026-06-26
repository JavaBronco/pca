import nodemailer from 'nodemailer';
import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v10';
import { AdminAlertPayload } from '../types.js';
import { getConfig } from '../config.js';

/**
 * Sends admin alerts via Discord DM to admin channel and/or email.
 * Includes enough internal detail for debugging but never exposes PII publicly.
 */
export class AdminNotifier {
  private rest: REST;

  constructor() {
    const cfg = getConfig();
    this.rest = new REST({ version: '10' }).setToken(cfg.DISCORD_BOT_TOKEN);
  }

  async notify(payload: AdminAlertPayload): Promise<void> {
    await Promise.allSettled([
      this.notifyDiscord(payload),
      this.notifyEmail(payload),
    ]);
  }

  private async notifyDiscord(payload: AdminAlertPayload): Promise<void> {
    const cfg = getConfig();
    const message = this.formatDiscordAlert(payload);
    try {
      await (this.rest as REST).post(Routes.channelMessages(cfg.DISCORD_ADMIN_CHANNEL_ID), {
        body: { content: message },
      });
    } catch (err) {
      console.error('[ADMIN] Discord notify failed:', (err as Error).message);
    }
  }

  private formatDiscordAlert(payload: AdminAlertPayload): string {
    return [
      `**Admin Alert — ${payload.event}**`,
      `Submission ID: \`${payload.submissionId}\``,
      `Proposed Name: ${payload.proposedName}`,
      `Time: ${payload.timestamp.toISOString()}`,
      `Detail: ${this.sanitizeDetail(payload.detail)}`,
    ].join('\n');
  }

  private async notifyEmail(payload: AdminAlertPayload): Promise<void> {
    const cfg = getConfig();
    if (!cfg.SMTP_HOST || !cfg.ADMIN_EMAIL) return;

    const transporter = nodemailer.createTransport({
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
    } catch (err) {
      console.error('[ADMIN] Email notify failed:', (err as Error).message);
    }
  }

  /** Never include email addresses or member numbers in alert detail text. */
  private sanitizeDetail(detail: string): string {
    return detail
      .replace(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, '[EMAIL REDACTED]')
      .replace(/\b[A-Z0-9\-]{4,20}\b/g, '[ID REDACTED]');
  }
}

export const adminNotifier = new AdminNotifier();
