import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { LoginDto } from './auth.dto';

const hasStringSub = (value: unknown): value is { sub: string } =>
  typeof value === 'object' &&
  value !== null &&
  'sub' in value &&
  typeof (value as Record<string, unknown>).sub === 'string';

@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService) {}

  login(payload: LoginDto) {
    const subject = payload.email;
    return {
      accessToken: this.jwtService.sign({ sub: subject, role: 'member' }),
      refreshToken: this.jwtService.sign(
        { sub: subject, tokenType: 'refresh' },
        { expiresIn: '7d' },
      ),
    };
  }

  refresh(refreshToken: string) {
    const decoded: unknown = this.jwtService.decode(refreshToken);
    const sub = hasStringSub(decoded) ? decoded.sub : 'user';
    return {
      accessToken: this.jwtService.sign({
        sub,
      }),
    };
  }

  providers() {
    return ['jwt', 'oauth'];
  }
}
