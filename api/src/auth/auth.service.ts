import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash } from 'crypto';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';

export interface TokenPair {
  accessToken:  string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt:    JwtService,
  ) {}

  async signup(dto: SignupDto): Promise<TokenPair> {
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (exists) throw new ConflictException('Email already in use');

    const passwordHash = await argon2.hash(dto.password);
    const user = await this.prisma.user.create({
      data: { email: dto.email, passwordHash },
    });

    const pair = this.signPair(user.id, user.email, user.role);
    await this.prisma.user.update({
      where: { id: user.id },
      data:  { refreshTokenHash: this.hashToken(pair.refreshToken) },
    });
    return pair;
  }

  async login(dto: LoginDto): Promise<TokenPair> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await argon2.verify(user.passwordHash, dto.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    const pair = this.signPair(user.id, user.email, user.role);
    // Clear loggedOutAt on fresh login so the new token is never rejected.
    await this.prisma.user.update({
      where: { id: user.id },
      data:  { loggedOutAt: null, refreshTokenHash: this.hashToken(pair.refreshToken) },
    });
    return pair;
  }

  async refresh(token: string): Promise<TokenPair> {
    let payload: { sub: number; email: string; role: string };
    try {
      payload = this.jwt.verify(token, {
        secret: process.env.JWT_REFRESH_SECRET!,
      }) as { sub: number; email: string; role: string };
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user?.refreshTokenHash) throw new UnauthorizedException('Invalid refresh token');

    if (user.refreshTokenHash !== this.hashToken(token)) {
      throw new UnauthorizedException('Refresh token revoked');
    }

    // Token rotation — issue a new pair and store the new hash.
    const pair = this.signPair(user.id, user.email, user.role);
    await this.prisma.user.update({
      where: { id: user.id },
      data:  { loggedOutAt: null, refreshTokenHash: this.hashToken(pair.refreshToken) },
    });
    return pair;
  }

  async logout(userId: number): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data:  { loggedOutAt: new Date(), refreshTokenHash: null },
    });
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private signPair(userId: number, email: string, role: string): TokenPair {
    const base = { sub: userId, email, role };
    const accessToken  = this.jwt.sign(base, { expiresIn: '1d' });
    const refreshToken = this.jwt.sign(base, {
      secret:    process.env.JWT_REFRESH_SECRET!,
      expiresIn: '7d',
    });
    return { accessToken, refreshToken };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
