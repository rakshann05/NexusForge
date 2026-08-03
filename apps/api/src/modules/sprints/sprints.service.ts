import { Injectable } from '@nestjs/common';

@Injectable()
export class SprintsService {
  list() {
    return [{ id: 'sample-sprints', name: 'Sample Sprint' }];
  }
}
