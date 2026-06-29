import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';

interface JwtPayload {
  sub:   number;
  email: string;
  role:  string;
  iat:   number; // seconds since epoch — set automatically by JwtService.sign()
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest:   ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:      process.env.JWT_SECRET!,
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) throw new UnauthorizedException();

    // Reject tokens issued before the last logout (server-side invalidation).
    // Compare in whole seconds: iat is already seconds; loggedOutAt is truncated to seconds.
    // This avoids a race where login + logout happen in the same second and the new token
    // gets incorrectly rejected because iat*1000 < loggedOutAt (milliseconds).
    if (user.loggedOutAt && payload.iat < Math.floor(user.loggedOutAt.getTime() / 1000)) {
      throw new UnauthorizedException('Session expired — please log in again');
    }

    return { userId: user.id, email: user.email, role: user.role };
  }
}
