import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AI_PROVIDER } from './ai.contract';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { DisabledAiProvider } from './providers/disabled.provider';
import { GeminiProvider } from './providers/gemini.provider';
import { OllamaProvider } from './providers/ollama.provider';
import { OpenAiCompatibleProvider } from './providers/openai.provider';

@Module({
  controllers: [AiController],
  providers: [
    AiService,
    DisabledAiProvider,
    GeminiProvider,
    OllamaProvider,
    OpenAiCompatibleProvider,
    {
      provide: AI_PROVIDER,
      inject: [
        ConfigService,
        DisabledAiProvider,
        GeminiProvider,
        OllamaProvider,
        OpenAiCompatibleProvider,
      ],
      useFactory: (
        configService: ConfigService,
        disabled: DisabledAiProvider,
        gemini: GeminiProvider,
        ollama: OllamaProvider,
        openai: OpenAiCompatibleProvider,
      ) => {
        const provider = configService.get<string>('AI_PROVIDER', 'disabled');
        switch (provider) {
          case 'gemini':
            return gemini;
          case 'ollama':
            return ollama;
          case 'openai':
            return openai;
          default:
            return disabled;
        }
      },
    },
  ],
  exports: [AiService],
})
export class AiModule {}
