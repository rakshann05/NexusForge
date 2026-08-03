import { Module } from '@nestjs/common';
import { S3StorageAdapter } from './s3.storage';
import { STORAGE_PORT } from './storage.contract';

@Module({
  providers: [
    {
      provide: STORAGE_PORT,
      useClass: S3StorageAdapter,
    },
  ],
  exports: [STORAGE_PORT],
})
export class StorageModule {}
