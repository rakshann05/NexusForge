import { Injectable } from '@nestjs/common';

@Injectable()
export class IntegrationsService {
  list() {
    return [{ id: 'sample-integrations', name: 'Sample Integration' }];
  }
}
