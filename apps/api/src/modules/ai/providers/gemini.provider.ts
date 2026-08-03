import { Injectable } from '@nestjs/common';
import { AiGenerateRequest, AiProvider } from '../ai.contract';

@Injectable()
export class GeminiProvider implements AiProvider {
  name = 'gemini';

  generate(request: AiGenerateRequest): Promise<string> {
    return Promise.resolve(
      `Gemini response placeholder for: ${request.prompt}`,
    );
  }
}
