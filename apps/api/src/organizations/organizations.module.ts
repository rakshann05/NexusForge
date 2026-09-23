import { Module } from '@nestjs/common';
import { OrgAccessGuard } from './org-access';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';

// Re-exported so existing modules (projects, documents) keep importing
// OrganizationsService from this path unchanged.
export { OrganizationsService } from './organizations.service';

@Module({
  controllers: [OrganizationsController],
  providers: [OrganizationsService, OrgAccessGuard],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}
