import type { EventDetail, PhotoDto } from '@role/contracts';
import { useState } from 'react';
import { Button } from '../../../components/Button';
import { FileButton } from '../../../components/FileButton';
import { IconCamera, IconDownload, IconTrash } from '../../../components/icons';
import { Skeleton } from '../../../components/misc';
import { Sheet } from '../../../components/Sheet';
import { useToast } from '../../../components/Toast';
import { api } from '../../../lib/api';
import { formatDateTime } from '../../../lib/format';
import { keys, useAction, usePhotos } from '../../../lib/queries';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Mural de fotos do rolê: só quem confirmou presença vê e posta. As fotos são comprimidas antes de subir. */
export function PhotosCard({ detail }: { detail: EventDetail }) {
  const { event } = detail;
  const { data, isPending } = usePhotos(event.id);
  const [open, setOpen] = useState<PhotoDto | null>(null);
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const invalidate = [keys.photos(event.id)];

  const upload = useAction((file: File) => api.upload(`/events/${event.id}/photos`, file), {
    invalidate,
    success: 'Foto no mural',
  });
  const remove = useAction((id: string) => api.delete(`/photos/${id}`), {
    invalidate,
    success: 'Foto apagada',
    onSuccess: () => setOpen(null),
  });

  /** O navegador não baixa várias fotos num clique só: dispara uma por vez, com um respiro entre elas. */
  async function saveAll() {
    if (!data) return;
    setSaving(true);
    try {
      for (const [i, p] of data.photos.entries()) {
        const a = document.createElement('a');
        a.href = `/api/photos/${p.id}`;
        a.download = `role-${event.code}-${i + 1}`;
        document.body.append(a);
        a.click();
        a.remove();
        await wait(400);
      }
    } catch {
      toast.error('Não consegui baixar tudo. Abra as fotos e salve uma a uma.');
    } finally {
      setSaving(false);
    }
  }

  if (isPending || !data) return <Skeleton rows={1} />;

  return (
    <section className="card space-y-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2>Mural de fotos</h2>
          <p className="mt-1 text-sm text-muted">
            {data.photos.length}/{data.max} fotos · só a turma do rolê vê.
          </p>
        </div>
        {data.canAdd && (
          <FileButton
            size="sm"
            accept="image/*"
            loading={upload.isPending}
            label={
              <>
                <IconCamera size={16} /> Postar
              </>
            }
            onFile={(file) => upload.mutate(file)}
          />
        )}
      </div>

      {!data.canAdd && data.photos.length === 0 && (
        <p className="text-sm text-muted">
          O mural abre quando o rolê é confirmado. Depois é só postar as fotos da viagem.
        </p>
      )}
      {data.canAdd && data.photos.length === 0 && (
        <p className="text-sm text-muted">Nenhuma foto ainda. Quem posta a primeira?</p>
      )}

      {data.photos.length > 0 && (
        <ul className="grid grid-cols-3 gap-1.5">
          {data.photos.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className="block aspect-square w-full overflow-hidden rounded-lg bg-desk-deep"
                onClick={() => setOpen(p)}
                aria-label={`Foto de ${p.by.name}`}
              >
                <img
                  src={`/api/photos/${p.id}`}
                  alt={`Foto postada por ${p.by.name}`}
                  loading="lazy"
                  className="size-full object-cover"
                />
              </button>
            </li>
          ))}
        </ul>
      )}

      {data.photos.length > 1 && (
        <Button variant="soft" size="sm" loading={saving} onClick={() => void saveAll()}>
          <IconDownload size={16} /> Baixar todas
        </Button>
      )}

      <Sheet open={!!open} title="Foto do rolê" onClose={() => setOpen(null)}>
        {open && (
          <div className="space-y-3">
            <img
              src={`/api/photos/${open.id}`}
              alt={`Foto postada por ${open.by.name}`}
              className="max-h-[60vh] w-full rounded-xl object-contain"
            />
            <p className="text-sm text-muted">
              {open.by.name} · {formatDateTime(open.createdAt)}
            </p>
            <div className="flex gap-2">
              <a
                href={`/api/photos/${open.id}`}
                download={`role-${event.code}`}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-[10px] bg-navy-soft px-3 text-sm font-bold text-navy-dark"
              >
                <IconDownload size={16} /> Salvar
              </a>
              {open.canDelete && (
                <Button
                  size="sm"
                  variant="danger"
                  loading={remove.isPending}
                  onClick={() => remove.mutate(open.id)}
                >
                  <IconTrash size={16} /> Apagar
                </Button>
              )}
            </div>
          </div>
        )}
      </Sheet>
    </section>
  );
}
