import { MembershipAdapter } from './membershipAdapter.js';
import { MembershipValidationResult } from '../types.js';

interface PcaApiResponse {
  status: 'ACTIVE' | 'INACTIVE' | 'EXPIRED' | 'NOT_FOUND';
  expiresAt?: string;
  message?: string;
}

/**
 * Validates membership against an HTTP API.
 *
 * Expected GET /members/{membershipNumber}
 * Authorization: Bearer <PCA_API_KEY>
 * Response: { status, expiresAt?, message? }
 */
export class ApiMembershipAdapter implements MembershipAdapter {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly timeoutMs: number = 8000,
  ) {}

  async validate(membershipNumber: string): Promise<MembershipValidationResult> {
    const now = new Date();
    const url = `${this.baseUrl}/members/${encodeURIComponent(membershipNumber)}`;

    let res: Response;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          Accept: 'application/json',
        },
        signal: controller.signal,
      });
      clearTimeout(timer);
    } catch (err) {
      return {
        status: 'error',
        message: `API request failed: ${(err as Error).message}`,
        validatedAt: now,
      };
    }

    if (res.status === 404) {
      return { status: 'not_found', message: 'Member not found', validatedAt: now };
    }

    if (!res.ok) {
      return {
        status: 'error',
        message: `API returned HTTP ${res.status}`,
        validatedAt: now,
      };
    }

    let body: PcaApiResponse;
    try {
      body = (await res.json()) as PcaApiResponse;
    } catch {
      return { status: 'error', message: 'Invalid API response body', validatedAt: now };
    }

    if (body.status === 'ACTIVE') {
      if (body.expiresAt) {
        const expires = new Date(body.expiresAt);
        if (!isNaN(expires.getTime()) && expires < now) {
          return { status: 'expired', message: `Expired on ${body.expiresAt}`, validatedAt: now };
        }
      }
      return { status: 'valid', validatedAt: now };
    }

    if (body.status === 'EXPIRED') {
      return { status: 'expired', message: body.message ?? 'Membership expired', validatedAt: now };
    }

    if (body.status === 'NOT_FOUND') {
      return { status: 'not_found', validatedAt: now };
    }

    return { status: 'invalid', message: body.message ?? 'Inactive membership', validatedAt: now };
  }
}
