import { useRef, useState, type ReactNode } from 'react';
import { prepareImage } from '../lib/image';
import { Button } from './Button';
import { useToast } from './Toast';

const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Botão que abre a câmera ou a galeria. Fotos são convertidas para JPEG e reduzidas antes do envio
 * (HEIC do iPhone, fotos de 8 MB); só então o limite de 5 MB é conferido.
 */
export function FileButton({
  label,
  onFile,
  loading,
  variant = 'secondary',
  size = 'md',
  block,
}: {
  label: ReactNode;
  onFile: (file: File) => void;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'soft' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  block?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const [preparing, setPreparing] = useState(false);

  return (
    <>
      <input
        ref={input}
        type="file"
        accept="image/*,application/pdf"
        className="sr-only"
        tabIndex={-1}
        onChange={async (e) => {
          const picked = e.target.files?.[0];
          e.target.value = '';
          if (!picked) return;
          setPreparing(true);
          try {
            const file = await prepareImage(picked);
            if (file.size > MAX_BYTES) {
              toast.error('O arquivo passa de 5 MB. Tire uma foto menor ou comprima o PDF.');
              return;
            }
            onFile(file);
          } finally {
            setPreparing(false);
          }
        }}
      />
      <Button
        variant={variant}
        size={size}
        block={block ?? false}
        loading={(loading ?? false) || preparing}
        onClick={() => input.current?.click()}
      >
        {label}
      </Button>
    </>
  );
}
