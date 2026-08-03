import { Body, Controller, Post } from '@nestjs/common';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { AuthService } from './auth.service';

class RegisterDto { @IsEmail() email!: string; @IsString() @MinLength(2) displayName!: string; @IsString() @MinLength(10) password!: string; }
class LoginDto { @IsEmail() email!: string; @IsString() password!: string; }

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Post('register') register(@Body() input: RegisterDto) { return this.auth.register(input); }
  @Post('login') login(@Body() input: LoginDto) { return this.auth.login(input); }
}
