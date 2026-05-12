import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';
import { Role, UserStatus } from '../../domain/enums';

export interface JwtPayload {
  sub: string;
  email: string;
  name?: string;
  roles: Role[];
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    const secret = configService.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('JWT_SECRET is not defined in environment variables');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  /**
   * Re-fetch the user on every request so role/status changes take effect
   * within the access-token lifetime. A SUSPENDED account is rejected here
   * with a 401 carrying a `accountSuspended` code so the frontend can show
   * a friendlier "contact support" message instead of the generic
   * invalid-token copy.
   */
  async validate(payload: JwtPayload) {
    let user;
    try {
      user = await this.authService.validateUser(payload.sub);
    } catch {
      throw new UnauthorizedException('Invalid token');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException({
        message: 'Account suspended',
        code: 'accountSuspended',
      });
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      roles: user.roles,
    };
  }
}
