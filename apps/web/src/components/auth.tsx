import { passwordStrength, STRENGTH_LABELS } from '@role/domain';
import { useState } from 'react';
import { Button } from './Button';
import { IconCheck, IconDownload } from './icons';
import { CopyButton } from './misc';

/** Campo de senha com mostrar/ocultar e, no cadastro, o medidor de força (orientação, não regra). */
export function PasswordField({
  value,
  onChange,
  autoComplete,
  showStrength = false,
  id,
  autoFocus,
}: {
  value: string;
  onChange: (value: string) => void;
  autoComplete: 'current-password' | 'new-password';
  showStrength?: boolean;
  id?: string;
  autoFocus?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const strength = passwordStrength(value);

  return (
    <div>
      <div className="relative">
        <input
          id={id}
          className="field pr-20"
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={72}
          {...(autoFocus ? { autoFocus: true } : {})}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2.5 py-1.5 text-sm font-bold text-navy-dark hover:bg-navy-soft"
        >
          {visible ? 'Ocultar' : 'Mostrar'}
        </button>
      </div>
      {showStrength && value.length > 0 && (
        <div className="mt-2" aria-live="polite">
          <div className="flex gap-1" aria-hidden>
            {[1, 2, 3, 4].map((n) => (
              <span
                key={n}
                className={`h-1.5 flex-1 rounded-full ${
                  n <= strength
                    ? strength <= 1
                      ? 'bg-danger'
                      : strength === 2
                        ? 'bg-sol'
                        : 'bg-ok'
                    : 'bg-desk-deep'
                }`}
              />
            ))}
          </div>
          <p className="mt-1 text-xs text-muted">
            Força: <strong className="text-ink">{STRENGTH_LABELS[strength] || '—'}</strong>
            {strength <= 1 && ' · use 8 ou mais caracteres, sem sequências'}
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Código de recuperação: único jeito de voltar à conta sem SMS ou e-mail. Aparece uma vez,
 * e só libera o "continuar" depois que a pessoa confirma que guardou.
 */
export function RecoveryCodeBox({
  code,
  onConfirm,
  confirmLabel = 'Continuar',
}: {
  code: string;
  onConfirm?: () => void;
  confirmLabel?: string;
}) {
  const [saved, setSaved] = useState(false);

  function download() {
    const text = [
      'Operação Rolê: código de recuperação',
      '',
      code,
      '',
      'Guarde em lugar seguro. Ele é a única forma de recuperar a conta se você esquecer a senha.',
      'Quem tiver este código pode redefinir a sua senha.',
    ].join('\n');
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'codigo-de-recuperacao-operacao-role.txt';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-[14px] bg-night p-5 text-center text-white">
        <p className="eyebrow !text-white/55">Código de recuperação</p>
        <p
          className="mono mt-3 select-all whitespace-nowrap text-[1.3rem] font-semibold tracking-[0.06em] text-sol"
          data-testid="recovery-code"
        >
          {code}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <CopyButton value={code} label="Copiar código" />
        <Button size="sm" variant="soft" onClick={download}>
          <IconDownload size={16} /> Baixar .txt
        </Button>
      </div>
      <p className="text-sm text-muted">
        Sem SMS ou e-mail, este código é a <strong className="text-ink">única forma</strong> de
        voltar à conta se você esquecer a senha. Ele não aparece de novo.
      </p>
      {onConfirm && (
        <>
          <label className="flex cursor-pointer items-start gap-3 rounded-[10px] bg-desk-deep p-3">
            <input
              type="checkbox"
              className="mt-0.5 size-5 accent-navy"
              checked={saved}
              onChange={(e) => setSaved(e.target.checked)}
            />
            <span className="text-sm font-bold">Guardei o código em um lugar seguro</span>
          </label>
          <Button block size="lg" disabled={!saved} onClick={onConfirm}>
            <IconCheck size={18} /> {confirmLabel}
          </Button>
        </>
      )}
    </div>
  );
}
