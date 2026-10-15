import { Module } from '@nestjs/common';
import { OrganizationsModule } from '../organizations/organizations.module';
import { ProjectAccessGuard } from './project-access';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';

@Module({
  // OrganizationsModule provides OrgAccessGuard, chained before ProjectAccessGuard.
  imports: [OrganizationsModule],
  controllers: [ProjectsController],
  providers: [ProjectsService, ProjectAccessGuard],
})
export class ProjectsModule {}
