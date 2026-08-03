import { Injectable } from '@nestjs/common';

@Injectable()
export class NotificationsService {
  list() {
    return [{ id: 'sample-notifications', name: 'Sample Notification' }];
  }
}
