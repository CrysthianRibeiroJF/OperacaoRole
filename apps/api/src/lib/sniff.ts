export interface DetectedFile {
  mime: 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf';
  extension: 'jpg' | 'png' | 'webp' | 'pdf';
}

/**
 * Identifica o tipo pelo conteúdo (magic bytes), ignorando o Content-Type e o nome enviados
 * pelo cliente. Só aceitamos imagens e PDF.
 */
export function detectFile(buf: Buffer): DetectedFile | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { mime: 'image/jpeg', extension: 'jpg' };
  }
  if (
    buf.length >= 8 &&
    buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return { mime: 'image/png', extension: 'png' };
  }
  if (
    buf.length >= 12 &&
    buf.toString('ascii', 0, 4) === 'RIFF' &&
    buf.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return { mime: 'image/webp', extension: 'webp' };
  }
  if (buf.length >= 5 && buf.toString('ascii', 0, 5) === '%PDF-') {
    return { mime: 'application/pdf', extension: 'pdf' };
  }
  return null;
}

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
