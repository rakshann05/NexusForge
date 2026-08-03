import { Module } from '@nestjs/common';
import { InMemoryTaskRepository } from './repositories/in-memory-task.repository';
import { TASK_REPOSITORY } from './tasks.contract';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

@Module({
  controllers: [TasksController],
  providers: [
    TasksService,
    {
      provide: TASK_REPOSITORY,
      useClass: InMemoryTaskRepository,
    },
  ],
})
export class TasksModule {}
