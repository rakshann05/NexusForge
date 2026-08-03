import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  it('does not reveal whether a user account exists on failed login', async () => {
    const prisma = { user: { findFirst: jest.fn().mockResolvedValue(null) } };
    const service = new AuthService(prisma as never, {} as never, {} as never);
    await expect(service.login('missing@example.com', 'wrong-password', {}))
      .rejects.toBeInstanceOf(UnauthorizedException);
  });
});
