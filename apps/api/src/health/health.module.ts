import { Controller, Get, Module } from '@nestjs/common';

@Controller('health')
class HealthController {
  @Get()
  check() { return { status: 'ok', service: 'nexusforge-api', timestamp: new Date().toISOString() }; }
}

@Module({ controllers: [HealthController] })
export class HealthModule {}
