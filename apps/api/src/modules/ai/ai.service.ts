import { Inject, Injectable } from '@nestjs/common';
import { AI_PROVIDER } from './ai.contract';
import type { AiProvider } from './ai.contract';

@Injectable()
export class AiService {
  constructor(@Inject(AI_PROVIDER) private readonly provider: AiProvider) {}

  async ask(prompt: string) {
    return {
      provider: this.provider.name,
      response: await this.provider.generate({ prompt }),
    };
  }
}
