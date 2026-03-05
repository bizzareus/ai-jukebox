import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';

export interface InviteTokenPayload {
  email: string;
  venueName: string;
  address?: string;
  createdByAdminId: string;
}

const INVITE_TOKEN_EXPIRY = '7d';

@Injectable()
export class InviteTokenService {
  private readonly logger = new Logger(InviteTokenService.name);

  constructor(private readonly configService: ConfigService) {}

  sign(payload: InviteTokenPayload): string {
    const secret = this.configService.get<string>('INVITE_TOKEN_SECRET');
    if (!secret) {
      this.logger.warn(
        'INVITE_TOKEN_SECRET not set — invite tokens will be unsigned',
      );
    }
    return jwt.sign(payload, secret || 'invite-fallback-secret', {
      expiresIn: INVITE_TOKEN_EXPIRY,
    });
  }

  verify(token: string): InviteTokenPayload | null {
    try {
      const secret = this.configService.get<string>('INVITE_TOKEN_SECRET');
      const decoded = jwt.verify(token, secret || 'invite-fallback-secret') as {
        email: string;
        venueName: string;
        address?: string;
        createdByAdminId: string;
      };
      return {
        email: decoded.email,
        venueName: decoded.venueName,
        address: decoded.address,
        createdByAdminId: decoded.createdByAdminId,
      };
    } catch (e) {
      this.logger.warn('Invite token verification failed', e);
      return null;
    }
  }
}
