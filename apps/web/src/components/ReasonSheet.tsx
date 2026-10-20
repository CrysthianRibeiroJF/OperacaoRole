import { useState, type FormEvent } from 'react';
import { Button } from './Button';
import { Field } from './misc';
import { Sheet } from './Sheet';

/** Folha para pedir um motivo/justificativa (recusar comprovante, contestar despesa, etc.). */
export function ReasonSheet({
  open,
  title,
  label,
  submitLabel,
  tone = 'danger',
  minLength = 3,
  loading,
  onSubmit,
  onClose,
}: {
  open: boolean;
  title: string;
  label: string;
  submitLabel: string;
  tone?: 'danger' | 'primary';
  minLength?: number;
  loading?: boolean;
  onSubmit: (reason: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState('');

  function submit(e: FormEvent) {
    e.preventDefault();
    onSubmit(reason.trim());
  }

  return (
    <Sheet
      open={open}
      title={title}
      onClose={() => {
        setReason('');
        onClose();
      }}
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label={label}>
          <textarea
            className="field min-h-24"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={240}
            required
            autoFocus
          />
        </Field>
        <Button
          type="submit"
          block
          variant={tone}
          loading={loading}
          disabled={reason.trim().length < minLength}
        >
          {submitLabel}
        </Button>
      </form>
    </Sheet>
  );
}
