import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';

const LOGIN_LINK_EXPIRY = '1h';

@Injectable()
export class LoginLinkTokenService {
  private readonly logger = new Logger(LoginLinkTokenService.name);

  constructor(private readonly configService: ConfigService) {}

  sign(adminId: string): string {
    const secret = this.configService.get<string>('INVITE_TOKEN_SECRET');
    if (!secret) {
      this.logger.warn(
        'INVITE_TOKEN_SECRET not set — login link tokens will be unsigned',
      );
    }
    return jwt.sign(
      { sub: adminId, purpose: 'login_link' },
      secret || 'login-link-fallback-secret',
      { expiresIn: LOGIN_LINK_EXPIRY },
    );
  }

  verify(token: string): string | null {
    try {
      const secret = this.configService.get<string>('INVITE_TOKEN_SECRET');
      const decoded = jwt.verify(
        token,
        secret || 'login-link-fallback-secret',
      ) as {
        sub?: string;
        purpose?: string;
      };
      if (decoded.purpose !== 'login_link' || !decoded.sub) return null;
      return decoded.sub;
    } catch (e) {
      this.logger.warn('Login link token verification failed', e);
      return null;
    }
  }
}
