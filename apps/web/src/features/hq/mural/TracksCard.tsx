import type { EventDetail } from '@role/contracts';
import { useState, type FormEvent } from 'react';
import { Button } from '../../../components/Button';
import { IconTrash } from '../../../components/icons';
import { Field, Skeleton } from '../../../components/misc';
import { api } from '../../../lib/api';
import { keys, useAction, useTracks } from '../../../lib/queries';

/** Trilha do rolê: a Base fixa a playlist e a turma sugere e vota nas músicas. */
export function TracksCard({ detail }: { detail: EventDetail }) {
  const { event, me } = detail;
  const { data, isPending } = useTracks(event.id);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [playlist, setPlaylist] = useState<string | null>(null);
  const invalidate = [keys.tracks(event.id)];
  const live = event.status === 'open' || event.status === 'confirmed';

  const add = useAction(
    () =>
      api.post(`/events/${event.id}/tracks`, {
        title: title.trim(),
        ...(url.trim() ? { url: url.trim() } : {}),
      }),
    {
      invalidate,
      onSuccess: () => {
        setTitle('');
        setUrl('');
      },
    },
  );
  const vote = useAction((id: string) => api.post(`/tracks/${id}/vote`), { invalidate });
  const remove = useAction((id: string) => api.delete(`/tracks/${id}`), { invalidate });
  const savePlaylist = useAction(
    (value: string | null) => api.put(`/events/${event.id}/playlist`, { url: value }),
    { invalidate, success: 'Playlist atualizada', onSuccess: () => setPlaylist(null) },
  );

  if (isPending || !data) return <Skeleton rows={1} />;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (title.trim().length >= 2) add.mutate(undefined);
  }

  return (
    <section className="card space-y-4 p-5">
      <div>
        <h2>Trilha do rolê</h2>
        <p className="mt-1 text-sm text-muted">Sugira músicas e vote nas que merecem tocar.</p>
      </div>

      {data.playlistUrl && playlist === null && (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-navy-soft p-3">
          <a
            href={data.playlistUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="min-w-0 truncate font-bold text-navy-dark underline"
          >
            Abrir a playlist do rolê
          </a>
          {data.canEditPlaylist && (
            <span className="flex shrink-0 gap-1">
              <Button size="sm" variant="ghost" onClick={() => setPlaylist(data.playlistUrl ?? '')}>
                Editar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => savePlaylist.mutate(null)}>
                Remover
              </Button>
            </span>
          )}
        </div>
      )}
      {data.canEditPlaylist && (!data.playlistUrl || playlist !== null) && (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (playlist) savePlaylist.mutate(playlist.trim());
          }}
        >
          <Field label="Link da playlist (Spotify, YouTube…)">
            <input
              className="field"
              type="url"
              inputMode="url"
              value={playlist ?? ''}
              onChange={(e) => setPlaylist(e.target.value)}
              placeholder="https://"
              maxLength={300}
            />
          </Field>
          <Button
            type="submit"
            size="sm"
            variant="soft"
            loading={savePlaylist.isPending}
            disabled={!playlist?.trim()}
          >
            Salvar playlist
          </Button>
        </form>
      )}

      {data.tracks.length > 0 && (
        <ol className="divide-y divide-line">
          {data.tracks.map((t) => (
            <li key={t.id} className="flex items-center gap-3 py-2.5">
              <button
                type="button"
                disabled={!me.can['tracks.add'] || !live}
                aria-pressed={t.votedByMe}
                aria-label={t.votedByMe ? `Tirar meu voto em ${t.title}` : `Votar em ${t.title}`}
                onClick={() => vote.mutate(t.id)}
                className={`flex min-w-12 shrink-0 flex-col items-center rounded-lg px-2 py-1.5 text-xs font-extrabold ${t.votedByMe ? 'bg-sol text-on-sol' : 'bg-desk-deep text-muted'}`}
              >
                <span aria-hidden>▲</span>
                {t.votes}
              </button>
              <div className="min-w-0 flex-1">
                {t.url ? (
                  <a
                    href={t.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block truncate font-bold text-navy-dark underline"
                  >
                    {t.title}
                  </a>
                ) : (
                  <p className="truncate font-bold">{t.title}</p>
                )}
                <p className="text-xs text-muted">sugerida por {t.by.name.split(' ')[0]}</p>
              </div>
              {t.canDelete && (
                <button
                  type="button"
                  aria-label={`Remover ${t.title}`}
                  className="grid size-9 place-items-center rounded-lg text-muted hover:bg-danger-soft hover:text-danger"
                  onClick={() => remove.mutate(t.id)}
                >
                  <IconTrash size={17} />
                </button>
              )}
            </li>
          ))}
        </ol>
      )}

      {me.can['tracks.add'] && live && (
        <form onSubmit={submit} className="space-y-2">
          <input
            className="field"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Nome da música e artista"
            maxLength={80}
            aria-label="Música"
          />
          <input
            className="field"
            type="url"
            inputMode="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Link (opcional)"
            maxLength={300}
            aria-label="Link da música"
          />
          <Button
            type="submit"
            block
            variant="soft"
            loading={add.isPending}
            disabled={title.trim().length < 2}
          >
            Sugerir música
          </Button>
        </form>
      )}
    </section>
  );
}
