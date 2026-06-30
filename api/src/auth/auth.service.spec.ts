// argon2 is a native module whose exports are non-configurable, so jest.spyOn
// cannot redefine them.  Use jest.mock() to replace the whole module before any
// import executes, then drive return values per-test via jest.mocked().
jest.mock('argon2');

import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { Role } from '@prisma/client';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

const mockedArgon2 = jest.mocked(argon2);

// ---------------------------------------------------------------------------
// Shared fixture
// ---------------------------------------------------------------------------

const EXISTING_USER = {
  id: 1,
  email: 'alice@example.com',
  passwordHash: '$argon2id$hashed',
  role: Role.CUSTOMER,
  createdAt: new Date(),
};

// ---------------------------------------------------------------------------

describe('AuthService', () => {
  let service: AuthService;
  let prisma: { user: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock } };

  beforeEach(async () => {
    prisma = { user: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() } };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: { sign: jest.fn().mockReturnValue('signed-token'), verify: jest.fn() } },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── signup ──────────────────────────────────────────────────────────────

  describe('signup', () => {
    it('returns an accessToken for a new email and hashes the password', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(EXISTING_USER);
      mockedArgon2.hash.mockResolvedValue('hashed' as never);

      const result = await service.signup({ email: 'new@example.com', password: 'password123' });

      expect(result).toMatchObject({ accessToken: 'signed-token', refreshToken: 'signed-token' });
      // hash was derived and stored — never the raw password
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ passwordHash: 'hashed' }) }),
      );
    });

    it('throws ConflictException (409) when the email is already registered', async () => {
      prisma.user.findUnique.mockResolvedValue(EXISTING_USER); // duplicate

      await expect(
        service.signup({ email: EXISTING_USER.email, password: 'password123' }),
      ).rejects.toThrow(ConflictException);
    });

    it('never passes the raw password to user.create', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(EXISTING_USER);
      mockedArgon2.hash.mockResolvedValue('hashed' as never);

      await service.signup({ email: 'new@example.com', password: 'supersecret' });

      expect(mockedArgon2.hash).toHaveBeenCalledWith('supersecret');
      const createArg = JSON.stringify(prisma.user.create.mock.calls[0][0]);
      expect(createArg).not.toContain('supersecret');
    });
  });

  // ── login ───────────────────────────────────────────────────────────────

  describe('login', () => {
    it('returns an accessToken when credentials are correct', async () => {
      prisma.user.findUnique.mockResolvedValue(EXISTING_USER);
      mockedArgon2.verify.mockResolvedValue(true as never);

      const result = await service.login({ email: EXISTING_USER.email, password: 'correct' });

      expect(result).toMatchObject({ accessToken: 'signed-token', refreshToken: 'signed-token' });
    });

    it('throws UnauthorizedException for a wrong password', async () => {
      prisma.user.findUnique.mockResolvedValue(EXISTING_USER);
      mockedArgon2.verify.mockResolvedValue(false as never);

      await expect(
        service.login({ email: EXISTING_USER.email, password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for an unknown email with the same message — no user enumeration', async () => {
      // Unknown email path
      prisma.user.findUnique.mockResolvedValue(null);
      let unknownErr: UnauthorizedException | undefined;
      try {
        await service.login({ email: 'ghost@example.com', password: 'any' });
      } catch (e) {
        unknownErr = e as UnauthorizedException;
      }

      // Wrong password path
      prisma.user.findUnique.mockResolvedValue(EXISTING_USER);
      mockedArgon2.verify.mockResolvedValue(false as never);
      let badPwErr: UnauthorizedException | undefined;
      try {
        await service.login({ email: EXISTING_USER.email, password: 'wrong' });
      } catch (e) {
        badPwErr = e as UnauthorizedException;
      }

      expect(unknownErr).toBeInstanceOf(UnauthorizedException);
      expect(badPwErr).toBeInstanceOf(UnauthorizedException);
      // Identical message prevents an attacker from discovering registered emails
      expect(unknownErr!.message).toBe(badPwErr!.message);
    });
  });
});
