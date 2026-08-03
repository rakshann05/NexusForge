import { Injectable } from '@nestjs/common';

@Injectable()
export class BoardsService {
  list() {
    return [{ id: 'sample-boards', name: 'Sample Board' }];
  }
}
