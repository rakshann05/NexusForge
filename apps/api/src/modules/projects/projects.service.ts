import { Injectable } from '@nestjs/common';

@Injectable()
export class ProjectsService {
  list() {
    return [{ id: 'sample-projects', name: 'Sample Project' }];
  }
}
