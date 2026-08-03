export interface StoragePort {
  upload(path: string, content: Buffer): Promise<string>;
}

export const STORAGE_PORT = Symbol('STORAGE_PORT');
