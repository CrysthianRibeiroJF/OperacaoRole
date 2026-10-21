import type { PixPaymentDto } from '@role/contracts';
import { buildPixPayload, can } from '@role/domain';
import type { AppContext } from '../../context';
import { conflict, forbidden, notFound } from '../../errors';
import { buildActor, getTreasurerId, requireEvent, usersById } from '../events/event.queries';

/** Cidade do BR Code: o trecho do destino antes da vírgula ("Maresias, SP" vira "Maresias"). */
const cityOf = (destination: string) => destination.split(',')[0] ?? destination;

/**
 * Pix do acerto de contas, pronto para colar no app do banco com o valor certo. O app só monta o
 * texto: nenhum dinheiro passa por aqui (D-003). Só quem paga recebe o código.
 */
export async function getTransferPix(
  ctx: AppContext,
  userId: string,
  transferId: string,
): Promise<PixPaymentDto> {
  const transfer = await ctx.db
    .selectFrom('settlement_transfers')
    .innerJoin('settlements', 'settlements.id', 'settlement_transfers.settlement_id')
    .select([
      'settlement_transfers.id as id',
      'settlement_transfers.from_user as from_user',
      'settlement_transfers.to_user as to_user',
      'settlement_transfers.amount_cents as amount_cents',
      'settlement_transfers.paid_at as paid_at',
      'settlements.event_id as event_id',
    ])
    .where('settlement_transfers.id', '=', transferId)
    .executeTakeFirst();
  if (!transfer) throw notFound('Acerto não encontrado');
  if (transfer.from_user !== userId) throw forbidden('Só quem paga recebe o código do Pix');
  if (transfer.paid_at) throw conflict('ALREADY_PAID', 'Esse acerto já foi pago');

  const event = await requireEvent(ctx.db, transfer.event_id);
  const payee = await ctx.db
    .selectFrom('users')
    .select(['id', 'name', 'pix_key'])
    .where('id', '=', transfer.to_user)
    .executeTakeFirstOrThrow();
  const treasurerId = await getTreasurerId(ctx.db, event);
  // Mesma regra da tela de acerto: o Tesoureiro sem Pix no perfil recebe pela chave do sinal.
  const key = payee.pix_key ?? (payee.id === treasurerId ? event.deposit_pix_key : null);
  if (!key) {
    throw conflict('NO_PIX_KEY', `${payee.name} ainda não cadastrou a chave Pix. Combine direto.`);
  }
  return {
    payload: buildPixPayload({
      key,
      merchantName: payee.name,
      merchantCity: cityOf(event.destination),
      amountCents: transfer.amount_cents,
      txid: `ROLE${transfer.id.replace(/-/g, '').slice(0, 20)}`,
    }),
    amountCents: transfer.amount_cents,
    payee: { id: payee.id, name: payee.name },
    key,
  };
}

/** Pix do sinal: o valor combinado para a chave que o Tesoureiro cadastrou. */
export async function getDepositPix(
  ctx: AppContext,
  userId: string,
  eventId: string,
): Promise<PixPaymentDto> {
  const event = await requireEvent(ctx.db, eventId);
  const { actor } = await buildActor(ctx.db, event, userId);
  if (!can(actor, 'event.viewInternal')) throw forbidden('Confirme presença para ver o sinal');
  if (!event.deposit_required || !event.deposit_cents || !event.deposit_pix_key) {
    throw conflict('NO_DEPOSIT', 'Este rolê não tem sinal');
  }
  const treasurerId = await getTreasurerId(ctx.db, event);
  const payee = (await usersById(ctx.db, [treasurerId])).get(treasurerId) ?? {
    id: treasurerId,
    name: 'Tesoureiro',
  };
  return {
    payload: buildPixPayload({
      key: event.deposit_pix_key,
      merchantName: payee.name,
      merchantCity: cityOf(event.destination),
      amountCents: event.deposit_cents,
      txid: `SINAL${event.code}`,
    }),
    amountCents: event.deposit_cents,
    payee,
    key: event.deposit_pix_key,
  };
}
