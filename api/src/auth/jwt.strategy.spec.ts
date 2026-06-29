import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtStrategy } from './jwt.strategy';
import { PrismaService } from '../prisma/prisma.service';

// JwtStrategy calls PassportStrategy(Strategy) super() in its constructor, which
// reads process.env.JWT_SECRET.  Set it before the module is created.
const TEST_JWT_SECRET = 'test-secret-for-unit-tests';
process.env.JWT_SECRET = TEST_JWT_SECRET;

const DB_USER = {
  id: 42,
  email: 'bob@example.com',
  passwordHash: '$argon2id$irrelevant',
  role: Role.ADMIN,
  createdAt: new Date(),
};

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let prisma: { user: { findUnique: jest.Mock } };

  beforeEach(async () => {
    prisma = { user: { findUnique: jest.fn() } };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  it('returns { userId, email, role } when the user still exists in the DB', async () => {
    prisma.user.findUnique.mockResolvedValue(DB_USER);

    const result = await strategy.validate({ sub: DB_USER.id, email: DB_USER.email, role: DB_USER.role });

    expect(result).toEqual({ userId: DB_USER.id, email: DB_USER.email, role: DB_USER.role });
  });

  it('throws UnauthorizedException when the user has been deleted since the token was issued', async () => {
    prisma.user.findUnique.mockResolvedValue(null); // account deleted

    await expect(
      strategy.validate({ sub: 99, email: 'gone@example.com', role: Role.CUSTOMER }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('looks up the user by the sub claim, not by the email in the payload', async () => {
    prisma.user.findUnique.mockResolvedValue(DB_USER);

    await strategy.validate({ sub: DB_USER.id, email: DB_USER.email, role: DB_USER.role });

    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: DB_USER.id } });
  });
});
