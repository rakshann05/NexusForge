import { Injectable } from '@nestjs/common';
import { StoragePort } from './storage.contract';

@Injectable()
export class S3StorageAdapter implements StoragePort {
  upload(path: string, _content: Buffer): Promise<string> {
    void _content;
    return Promise.resolve(`s3://nexusforge/${path}`);
  }
}
