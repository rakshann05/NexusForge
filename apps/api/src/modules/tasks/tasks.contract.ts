export interface TaskEntity {
  id: string;
  title: string;
  status: 'todo' | 'in_progress' | 'done';
}

export interface TaskRepository {
  findAll(): Promise<TaskEntity[]>;
}

export const TASK_REPOSITORY = Symbol('TASK_REPOSITORY');
