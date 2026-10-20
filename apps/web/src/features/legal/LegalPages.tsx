import { TERMS_VERSION } from '@role/domain';
import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { IconArrowLeft } from '../../components/icons';

/**
 * Textos provisórios, escritos em linguagem simples. Ainda passam por revisão jurídica (Q12 / ROL-004):
 * o aviso no topo existe para ninguém confundir este rascunho com o texto final.
 */
function LegalLayout({ title, children }: { title: string; children: ReactNode }) {
  const navigate = useNavigate();
  return (
    <div className="mx-auto max-w-xl space-y-5 pb-4">
      <header>
        <button
          type="button"
          onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}
          className="inline-flex items-center gap-1.5 text-sm font-bold text-navy-dark"
        >
          <IconArrowLeft size={16} /> Voltar
        </button>
        <h1 className="mt-2 text-[2.6rem]">{title}</h1>
        <p className="mono mt-2 text-xs text-muted">Versão {TERMS_VERSION}</p>
      </header>
      <p className="rounded-[10px] bg-sol-soft p-3 text-sm font-bold text-sol-ink">
        Texto provisório: ainda está em revisão jurídica e pode mudar antes do lançamento público.
      </p>
      <div className="card space-y-5 p-5 [&_h2]:text-[1.4rem] [&_li]:mt-1.5 [&_ul]:list-disc [&_ul]:pl-5">
        {children}
      </div>
    </div>
  );
}

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="space-y-2">
    <h2>{title}</h2>
    <div className="space-y-2 text-[15px] leading-relaxed text-ink/90">{children}</div>
  </section>
);

export function TermsPage() {
  return (
    <LegalLayout title="Termos de uso">
      <Section title="O que o app é">
        <p>
          A Operação Rolê ajuda grupos de amigos a organizar encontros: confirmar presença, dividir
          tarefas, combinar carros, listar compras e acertar as contas. Não vendemos viagens,
          hospedagem ou transporte, e não somos uma instituição financeira.
        </p>
      </Section>
      <Section title="O app não mexe no seu dinheiro">
        <p>
          Todo pagamento (sinal, reembolso, acerto de contas) acontece por Pix, direto entre as
          pessoas, fora do app. Aqui ficam só os registros: comprovantes, despesas e saldos. O app
          não garante que alguém pague, nem devolve valores.
        </p>
        <p>
          Se um rolê for cancelado, a devolução de sinais deve ser combinada entre quem pagou e quem
          recebeu. O aviso do app é só uma orientação.
        </p>
      </Section>
      <Section title="Sua conta">
        <ul>
          <li>Você entra com celular e senha. Uma pessoa, uma conta.</li>
          <li>
            O código de recuperação é a única forma de voltar à conta se você esquecer a senha.
            Guarde-o: sem ele, não conseguimos recuperar o acesso.
          </li>
          <li>Você responde pelo que acontece na sua conta. Não compartilhe senha nem código.</li>
        </ul>
      </Section>
      <Section title="Papéis e decisões do grupo">
        <p>
          Cada rolê tem um Idealizador e, se o grupo quiser, Generais (Base, Frota, Suprimentos e
          Tesouro). As decisões deles, como aprovar um comprovante ou uma despesa, são do grupo; o
          app apenas registra e aplica as regras combinadas. Quem discordar de uma despesa pode
          contestá-la em até 72 horas.
        </p>
      </Section>
      <Section title="Como esperamos que você use">
        <ul>
          <li>Informar dados verdadeiros e enviar apenas comprovantes e notas reais.</li>
          <li>Não usar o app para fraude, assédio ou para expor dados de outras pessoas.</li>
          <li>Respeitar a privacidade de quem participa dos seus rolês.</li>
        </ul>
      </Section>
      <Section title="Serviço em evolução">
        <p>
          O app está em fase de testes e pode mudar ou ficar indisponível. Se estes termos mudarem
          de forma relevante, vamos pedir um novo aceite.
        </p>
      </Section>
      <Section title="Fale com a gente">
        <p>Canal de contato: a definir antes do lançamento público.</p>
      </Section>
      <p className="text-sm text-muted">
        Veja também a{' '}
        <Link to="/privacidade" className="font-bold text-navy-dark">
          política de privacidade
        </Link>
        .
      </p>
    </LegalLayout>
  );
}

export function PrivacyPage() {
  return (
    <LegalLayout title="Privacidade">
      <Section title="O que guardamos">
        <ul>
          <li>Nome, celular e, se você quiser, a chave Pix para receber pagamentos.</li>
          <li>
            Suas respostas e preferências nos rolês (por exemplo, se bebe álcool ou é vegetariano,
            usado só no rateio).
          </li>
          <li>Comprovantes de sinal, notas fiscais e as despesas que você lançou.</li>
          <li>Os acessos à conta: aparelhos conectados e o último uso.</li>
        </ul>
      </Section>
      <Section title="Para que usamos">
        <p>
          Somente para fazer o app funcionar: organizar o rolê, calcular o rateio, avisar você
          dentro do app e proteger a conta.
        </p>
      </Section>
      <Section title="Quem vê o quê">
        <ul>
          <li>Participantes do mesmo rolê veem seu nome, suas respostas e as despesas do grupo.</li>
          <li>Seu comprovante de sinal só é visto por você e pelo Tesoureiro do rolê.</li>
          <li>Cada pessoa vê só o próprio saldo no acerto de contas; o Tesoureiro vê todos.</li>
          <li>Seu celular não aparece para os outros participantes.</li>
        </ul>
      </Section>
      <Section title="Serviços de terceiros">
        <p>
          A previsão do tempo é buscada no Open-Meteo e recebe apenas o nome da cidade do rolê,
          nunca dados de pessoas. Não usamos rastreadores de publicidade. O único cookie é o da sua
          sessão.
        </p>
      </Section>
      <Section title="Por quanto tempo">
        <ul>
          <li>
            Comprovantes e fotos de notas são apagados 90 dias depois que o rolê é encerrado ou
            cancelado.
          </li>
          <li>
            Valores e registros da conta do grupo ficam, sem identificar você depois que excluir a
            conta.
          </li>
        </ul>
      </Section>
      <Section title="Seus direitos">
        <p>
          Em Conta, Privacidade e dados, você baixa tudo o que guardamos sobre você ou exclui a
          conta. A exclusão apaga nome, celular, chave Pix e comprovantes, e só é possível sem rolês
          em andamento e sem acertos pendentes.
        </p>
      </Section>
      <Section title="Segurança">
        <p>
          Senhas são guardadas com criptografia forte (nunca em texto), a sessão pode ser encerrada
          aparelho por aparelho e as tentativas erradas de acesso são bloqueadas.
        </p>
      </Section>
      <Section title="Fale com a gente">
        <p>Encarregado e canal de contato: a definir antes do lançamento público.</p>
      </Section>
      <p className="text-sm text-muted">
        Veja também os{' '}
        <Link to="/termos" className="font-bold text-navy-dark">
          termos de uso
        </Link>
        .
      </p>
    </LegalLayout>
  );
}
