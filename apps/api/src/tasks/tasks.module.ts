import { Module } from '@nestjs/common';
import { OrganizationsModule } from '../organizations/organizations.module';
import { ProjectAccessGuard } from '../projects/project-access';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

@Module({
  imports: [OrganizationsModule],
  controllers: [TasksController],
  providers: [TasksService, ProjectAccessGuard],
})
export class TasksModule {}
