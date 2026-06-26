import { Client } from 'discord.js';
import { VoteTracker } from '../services/voteTracker.js';
import { DiscordService } from '../services/discordService.js';
import { AuditLogger } from '../services/auditLogger.js';
export declare function createDiscordBot(voteTracker: VoteTracker, discordService: DiscordService, auditLogger: AuditLogger): Client;
/**
 * Checks for proposals whose voting window has expired, posts results,
 * and marks them closed. Run this on a periodic schedule (e.g., every hour).
 */
export declare function closeExpiredVoting(voteTracker: VoteTracker, discordService: DiscordService, auditLogger: AuditLogger): Promise<void>;
//# sourceMappingURL=reactionHandler.d.ts.map