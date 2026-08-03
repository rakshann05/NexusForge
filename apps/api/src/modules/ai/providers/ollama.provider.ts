import { Injectable } from '@nestjs/common';
import { AiGenerateRequest, AiProvider } from '../ai.contract';

@Injectable()
export class OllamaProvider implements AiProvider {
  name = 'ollama';

  generate(request: AiGenerateRequest): Promise<string> {
    return Promise.resolve(
      `Ollama response placeholder for: ${request.prompt}`,
    );
  }
}
