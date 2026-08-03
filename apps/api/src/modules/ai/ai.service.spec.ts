import { Test } from '@nestjs/testing';
import { AI_PROVIDER } from './ai.contract';
import { AiService } from './ai.service';

describe('AiService', () => {
  it('uses injected provider', async () => {
    const module = await Test.createTestingModule({
      providers: [
        AiService,
        {
          provide: AI_PROVIDER,
          useValue: {
            name: 'disabled',
            generate: () => Promise.resolve('disabled response'),
          },
        },
      ],
    }).compile();

    const service = module.get(AiService);
    const result = await service.ask('hello');

    expect(result.provider).toBe('disabled');
    expect(result.response).toBe('disabled response');
  });
});
