import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { IconArrowLeft } from '../../components/icons';

/** Moldura das subpáginas da central da conta: voltar para o menu e título no padrão do app. */
export function AccountPage({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-xl space-y-6">
      <header>
        <Link
          to="/perfil"
          className="inline-flex items-center gap-1.5 text-sm font-bold text-navy-dark"
        >
          <IconArrowLeft size={16} /> Conta
        </Link>
        <h1 className="mt-2 text-[2.6rem]">{title}</h1>
        {intro && <p className="mt-2 text-muted">{intro}</p>}
      </header>
      {children}
    </div>
  );
}
