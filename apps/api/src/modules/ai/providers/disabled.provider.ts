import { Injectable } from '@nestjs/common';
import { AiGenerateRequest, AiProvider } from '../ai.contract';

@Injectable()
export class DisabledAiProvider implements AiProvider {
  name = 'disabled';

  generate(request: AiGenerateRequest): Promise<string> {
    return Promise.resolve(
      `AI mode disabled. Prompt received: ${request.prompt}`,
    );
  }
}
