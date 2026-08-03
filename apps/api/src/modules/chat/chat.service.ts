import { Injectable } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class ChatService {
  private readonly redis: Redis;

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });
  }

  async status() {
    try {
      await this.redis.connect();
      await this.redis.quit();
      return { cache: 'reachable' };
    } catch {
      return { cache: 'unreachable' };
    }
  }
}
