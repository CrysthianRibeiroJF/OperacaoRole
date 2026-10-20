import { createReadStream } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { Readable } from 'node:stream';
import { newId } from '../ids';

/** Armazenamento de comprovantes e notas. Hoje em disco; trocável por S3 sem tocar nos serviços. */
export interface FileStorage {
  save(scope: string, data: Buffer, extension: string): Promise<string>;
  open(key: string): Readable;
  remove(key: string): Promise<void>;
}

export class LocalDiskStorage implements FileStorage {
  private readonly root: string;

  constructor(root: string) {
    this.root = resolve(root);
  }

  async save(scope: string, data: Buffer, extension: string): Promise<string> {
    // Nome gerado no servidor: nada que o usuário envia vira caminho de arquivo.
    const key = `${scope}/${newId()}.${extension}`;
    const target = this.resolveKey(key);
    await mkdir(join(this.root, scope), { recursive: true });
    await writeFile(target, data, { flag: 'wx' });
    return key;
  }

  open(key: string): Readable {
    return createReadStream(this.resolveKey(key));
  }

  async remove(key: string): Promise<void> {
    await rm(this.resolveKey(key), { force: true });
  }

  private resolveKey(key: string): string {
    const full = resolve(this.root, key);
    if (!full.startsWith(this.root + sep)) throw new Error('Chave de arquivo inválida');
    return full;
  }
}

/** Armazenamento em memória para testes. */
export class MemoryStorage implements FileStorage {
  readonly files = new Map<string, Buffer>();

  async save(scope: string, data: Buffer, extension: string): Promise<string> {
    const key = `${scope}/${newId()}.${extension}`;
    this.files.set(key, data);
    return key;
  }

  async remove(key: string): Promise<void> {
    this.files.delete(key);
  }

  open(key: string): Readable {
    const data = this.files.get(key);
    if (!data) throw new Error('Arquivo não encontrado');
    return Readable.from(data);
  }
}
