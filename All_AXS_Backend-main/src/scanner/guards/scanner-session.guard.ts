import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Request } from 'express';
import { ScannerSession } from '../entities/scanner-session.entity';

export interface ScannerSessionContext {
  sessionId: string;
  eventId: string;
}

/** Augment Express Request so downstream code can read req.scannerSession. */
export interface ScannerRequest extends Request {
  scannerSession: ScannerSessionContext;
}

@Injectable()
export class ScannerSessionGuard implements CanActivate {
  constructor(
    @InjectRepository(ScannerSession)
    private readonly sessionRepo: Repository<ScannerSession>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<ScannerRequest>();
    const token = req.headers['x-scanner-token'];

    if (!token || typeof token !== 'string') {
      throw new UnauthorizedException({ reason: 'EXPIRED_SESSION' });
    }

    const session = await this.sessionRepo.findOne({ where: { token } });

    if (!session) {
      throw new UnauthorizedException({ reason: 'EXPIRED_SESSION' });
    }

    if (session.revokedAt) {
      throw new UnauthorizedException({ reason: 'EXPIRED_SESSION' });
    }

    if (session.expiresAt < new Date()) {
      throw new UnauthorizedException({ reason: 'EXPIRED_SESSION' });
    }

    req.scannerSession = { sessionId: session.id, eventId: session.eventId };
    return true;
  }
}
