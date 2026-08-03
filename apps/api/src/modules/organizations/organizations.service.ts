import { Injectable } from '@nestjs/common';

@Injectable()
export class OrganizationsService {
  list() {
    return [{ id: 'sample-organizations', name: 'Sample Organization' }];
  }
}
