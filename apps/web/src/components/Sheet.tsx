import { useEffect, useRef, type ReactNode } from 'react';

interface Props {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/** Folha de baixo (mobile) / modal central (desktop) sobre <dialog>: foco preso e Esc fecham de graça. */
export function Sheet({ open, title, onClose, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className="m-auto mb-0 w-full max-w-lg rounded-t-3xl border-0 bg-surface p-0 text-ink backdrop:bg-night/60 sm:mb-auto sm:rounded-3xl"
    >
      {open && (
        <div className="max-h-[88dvh] overflow-y-auto p-5 pb-7">
          <div className="mb-4 flex items-start justify-between gap-4">
            <h2>{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              className="-mr-2 -mt-1 grid size-10 place-items-center rounded-full text-2xl text-muted hover:bg-desk"
            >
              ×
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
