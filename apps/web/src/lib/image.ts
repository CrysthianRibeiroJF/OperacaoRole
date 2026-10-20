/**
 * Prepara fotos antes do envio. Resolve dois problemas reais de celular:
 * - iPhone pode entregar HEIC, que o servidor não aceita; aqui vira JPEG.
 * - Foto da câmera passa fácil de 5 MB; reduzimos para no máximo 2000 px de lado.
 * Se qualquer passo falhar, o arquivo original segue (o servidor decide).
 */
export const MAX_SIDE = 2000;
const JPEG_QUALITY = 0.85;

export function fitWithin(
  width: number,
  height: number,
  max = MAX_SIDE,
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= max) return { width, height };
  const scale = max / longest;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/** Já é JPEG leve e pequeno o bastante: não vale reprocessar. */
export function needsProcessing(file: { type: string; size: number }): boolean {
  if (!file.type.startsWith('image/')) return false; // PDF e afins seguem como estão
  return file.type !== 'image/jpeg' || file.size > 1_500_000;
}

async function decode(
  file: File,
): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  if (typeof createImageBitmap === 'function') {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
  }
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;
  await img.decode();
  return {
    source: img,
    width: img.naturalWidth,
    height: img.naturalHeight,
    close: () => URL.revokeObjectURL(url),
  };
}

export async function prepareImage(file: File): Promise<File> {
  if (!needsProcessing(file)) return file;
  try {
    const { source, width, height, close } = await decode(file);
    const size = fitWithin(width, height);
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      close();
      return file;
    }
    ctx.fillStyle = '#fff'; // PNG com transparência vira JPEG sem fundo preto
    ctx.fillRect(0, 0, size.width, size.height);
    ctx.drawImage(source, 0, 0, size.width, size.height);
    close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY),
    );
    if (!blob) return file;
    // JPEG que não encolheu: não há ganho em trocar. Outros formatos (HEIC, PNG) sempre viram JPEG.
    if (file.type === 'image/jpeg' && blob.size >= file.size) return file;
    return asJpeg(blob);
  } catch {
    return file;
  }
}

const asJpeg = (blob: Blob) => new File([blob], 'foto.jpg', { type: 'image/jpeg' });
