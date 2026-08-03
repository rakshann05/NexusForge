import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  health() {
    return {
      name: 'NexusForge API',
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
