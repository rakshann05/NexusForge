import { Inject, Injectable } from '@nestjs/common';
import { TASK_REPOSITORY } from './tasks.contract';
import type { TaskRepository } from './tasks.contract';

@Injectable()
export class TasksService {
  constructor(
    @Inject(TASK_REPOSITORY)
    private readonly taskRepository: TaskRepository,
  ) {}

  list() {
    return this.taskRepository.findAll();
  }
}
