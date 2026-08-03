import { Injectable } from '@nestjs/common';
import { AiGenerateRequest, AiProvider } from '../ai.contract';

@Injectable()
export class OpenAiCompatibleProvider implements AiProvider {
  name = 'openai-compatible';

  generate(request: AiGenerateRequest): Promise<string> {
    return Promise.resolve(
      `OpenAI-compatible response placeholder for: ${request.prompt}`,
    );
  }
}
