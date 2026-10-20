import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft';
type Size = 'md' | 'lg' | 'sm';

/*
 * "key" dá espessura ao botão (afunda ao apertar). O amarelo-sol é a única cor de ação principal:
 * se tudo é amarelo, nada é; por isso só a ação mais importante da tela usa `primary`.
 */
const variants: Record<Variant, string> = {
  primary: 'key bg-sol text-on-sol hover:brightness-105 [--key-edge:var(--color-sol-dark)]',
  secondary: 'key bg-ink text-surface hover:opacity-90 [--key-edge:rgb(14_31_61/0.45)]',
  soft: 'bg-navy-soft text-navy-dark hover:brightness-95',
  ghost: 'bg-transparent text-navy-dark hover:bg-navy-soft',
  danger: 'bg-danger-soft text-danger hover:brightness-95',
};

const sizes: Record<Size, string> = {
  sm: 'min-h-9 px-3 text-sm',
  md: 'min-h-11 px-4 text-base',
  lg: 'min-h-14 px-6 text-lg',
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  block?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  block = false,
  disabled,
  className = '',
  children,
  type = 'button',
  ...rest
}: Props) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex items-center justify-center gap-2 rounded-[10px] font-bold tracking-[-0.005em] disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${block ? 'w-full' : ''} ${className}`}
      {...rest}
    >
      {loading && (
        <span
          className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden
        />
      )}
      {children}
    </button>
  );
}
