import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { resolveJwtSecret } from '../jwt-secret';
import type { JwtTyp } from '../types/jwt-payload';

type Payload = {
  sub: string;
  typ: JwtTyp;
  renterId?: string;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: resolveJwtSecret(config),
    });
  }

  validate(payload: Payload) {
    return {
      userId: payload.sub,
      typ: payload.typ,
      renterId: payload.renterId,
    };
  }
}
