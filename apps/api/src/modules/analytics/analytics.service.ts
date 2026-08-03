import { Injectable } from '@nestjs/common';

@Injectable()
export class AnalyticsService {
  list() {
    return [{ id: 'sample-analytics', name: 'Sample Analytic' }];
  }
}
