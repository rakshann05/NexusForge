import { Controller, Get } from '@nestjs/common';
import { SprintsService } from './sprints.service';

@Controller('sprints')
export class SprintsController {
  constructor(private readonly sprintsService: SprintsService) {}

  @Get()
  list() {
    return this.sprintsService.list();
  }
}
