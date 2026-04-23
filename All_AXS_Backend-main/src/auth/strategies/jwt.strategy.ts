import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';
import { Role } from '../../domain/enums';

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

  async validate(payload: JwtPayload) {
    try {
      const user = await this.authService.validateUser(payload.sub);
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        roles: user.roles,
      };
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
