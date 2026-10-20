import { useRef, type ReactNode } from 'react';
import { useToast } from './Toast';
import { Button } from './Button';

const MAX_BYTES = 5 * 1024 * 1024;

/** Botão que abre a câmera/galeria. Valida o tamanho antes de gastar a rede do usuário. */
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

  return (
    <>
      <input
        ref={input}
        type="file"
        accept="image/*,application/pdf"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          if (file.size > MAX_BYTES) {
            toast.error('O arquivo passa de 5 MB. Tire uma foto menor ou comprima o PDF.');
            return;
          }
          onFile(file);
        }}
      />
      <Button
        variant={variant}
        size={size}
        block={block ?? false}
        loading={loading ?? false}
        onClick={() => input.current?.click()}
      >
        {label}
      </Button>
    </>
  );
}
