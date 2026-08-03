import { Injectable } from '@nestjs/common';

@Injectable()
export class DocsService {
  list() {
    return [{ id: 'sample-docs', name: 'Sample Doc' }];
  }
}
