export interface AiGenerateRequest {
  prompt: string;
}

export interface AiProvider {
  name: string;
  generate(request: AiGenerateRequest): Promise<string>;
}

export const AI_PROVIDER = Symbol('AI_PROVIDER');
