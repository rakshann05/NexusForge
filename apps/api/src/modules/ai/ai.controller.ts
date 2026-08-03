import { Body, Controller, Get, Post } from '@nestjs/common';
import { IsString, MinLength } from 'class-validator';
import { AiService } from './ai.service';

class AiPromptDto {
  @IsString()
  @MinLength(3)
  prompt!: string;
}

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Get('provider')
  provider() {
    return this.aiService.ask('provider-check');
  }

  @Post('ask')
  ask(@Body() payload: AiPromptDto) {
    return this.aiService.ask(payload.prompt);
  }
}
