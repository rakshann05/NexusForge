import { Injectable } from '@nestjs/common';
import { TaskEntity, TaskRepository } from '../tasks.contract';

@Injectable()
export class InMemoryTaskRepository implements TaskRepository {
  private readonly tasks: TaskEntity[] = [
    {
      id: 'task-1',
      title: 'Set up NexusForge foundations',
      status: 'in_progress',
    },
  ];

  findAll(): Promise<TaskEntity[]> {
    return Promise.resolve(this.tasks);
  }
}
