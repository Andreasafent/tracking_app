import { ImagePlus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button, DateInput, ErrorNote, Field, Hero, Loading, QuickAction, QuickActions, Sheet, Widget } from '../components/ui'
import { useSaveRow } from '../lib/api'
import type { BodyPhoto } from '../lib/database.types'
import { fmtDayDMY, today } from '../lib/dates'
import { useBodyPhotos, useDeletePhoto, useSignedUrls, useUploadPhotos } from '../lib/photos'

export function Photos() {
  const query = useBodyPhotos()
  const photos = query.data ?? []
  const thumbs = useSignedUrls(photos.map((p) => p.thumb_path))
  const [uploading, setUploading] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)

  const days = [...new Set(photos.map((p) => p.taken_on))]
  const open = photos.find((p) => p.id === openId)

  return (
    <div className="space-y-3">
      <Hero
        label="ΦΩΤΟΓΡΑΦΙΕΣ ΠΡΟΟΔΟΥ"
        value={photos.length}
        sub={days.length ? `σε ${days.length} ${days.length === 1 ? 'ημέρα' : 'ημέρες'} · τελευταία ${fmtDayDMY(days[0])}` : undefined}
      >
        <QuickActions>
          <QuickAction icon={<ImagePlus size={20} />} label="Ανέβασμα" onClick={() => setUploading(true)} />
        </QuickActions>
      </Hero>

      <ErrorNote error={query.error ?? thumbs.error} />
      {query.isLoading && <Loading />}
      {query.isSuccess && photos.length === 0 && (
        <p className="py-8 text-center text-sm text-muted">Δεν έχεις ανεβάσει ακόμα φωτογραφίες.</p>
      )}

      {days.map((day) => (
        <Widget key={day} title={fmtDayDMY(day)}>
          <div className="grid grid-cols-3 gap-2 lg:grid-cols-5">
            {photos
              .filter((p) => p.taken_on === day)
              .map((p) => (
                <button
                  key={p.id}
                  type="button"
                  aria-label={`Φωτογραφία ${fmtDayDMY(day)}`}
                  onClick={() => setOpenId(p.id)}
                  className="aspect-[3/4] overflow-hidden rounded-2xl bg-surface-2 transition hover:brightness-110 active:scale-[0.98]"
                >
                  {thumbs.data?.[p.thumb_path] && (
                    <img src={thumbs.data[p.thumb_path]} alt="" loading="lazy" className="size-full object-cover" />
                  )}
                </button>
              ))}
          </div>
        </Widget>
      ))}

      {uploading && <UploadSheet onClose={() => setUploading(false)} />}
      {open && <PhotoSheet photo={open} onClose={() => setOpenId(null)} />}
    </div>
  )
}

function UploadSheet(props: { onClose: () => void }) {
  const upload = useUploadPhotos()
  const [files, setFiles] = useState<File[]>([])
  const [date, setDate] = useState(today())
  const [done, setDone] = useState(0)

  const submit = () => {
    setDone(0)
    let saved = 0
    upload.mutate(
      { files, date, onProgress: (n) => setDone((saved = n)) },
      {
        onSuccess: props.onClose,
        // Keep only the ones still missing, so retrying doesn't duplicate.
        onError: () => setFiles((f) => f.slice(saved)),
      },
    )
  }

  return (
    <Sheet
      open
      onClose={props.onClose}
      title="Νέες φωτογραφίες"
      footer={
        <Button className="w-full" disabled={!files.length || !date || date > today() || upload.isPending} onClick={submit}>
          {upload.isPending ? `Ανέβασμα ${done + 1}/${files.length}…` : `Ανέβασμα${files.length ? ` (${files.length})` : ''}`}
        </Button>
      }
    >
      <ErrorNote error={upload.error} />
      <Field label="Ημερομηνία λήψης">
        <DateInput value={date} onChange={setDate} />
      </Field>
      {date > today() && <p className="text-xs text-warn">Η ημερομηνία λήψης δεν μπορεί να είναι στο μέλλον.</p>}
      <input
        type="file"
        accept="image/*"
        multiple
        disabled={upload.isPending}
        onChange={(e) => setFiles([...(e.target.files ?? [])])}
        className="mt-3 w-full text-sm text-muted file:mr-3 file:h-11 file:cursor-pointer file:rounded-full file:border-0 file:bg-surface-2 file:px-5 file:text-sm file:font-semibold file:text-text"
      />
    </Sheet>
  )
}

function PhotoSheet(props: { photo: BodyPhoto; onClose: () => void }) {
  const p = props.photo
  const url = useSignedUrls([p.path])
  const save = useSaveRow('body_photos')
  const del = useDeletePhoto()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const src = url.data?.[p.path]

  return (
    <Sheet
      open
      onClose={props.onClose}
      title={fmtDayDMY(p.taken_on)}
      footer={
        <Button
          variant="danger"
          className="w-full"
          disabled={del.isPending}
          onClick={() => (confirmDelete ? del.mutate(p, { onSuccess: props.onClose }) : setConfirmDelete(true))}
        >
          <Trash2 size={16} /> {confirmDelete ? 'Σίγουρα διαγραφή;' : 'Διαγραφή'}
        </Button>
      }
    >
      <ErrorNote error={url.error ?? save.error ?? del.error} />
      {src ? <img src={src} alt="" className="mx-auto max-h-[60dvh] rounded-2xl" /> : <Loading />}
      <Field label="Ημερομηνία λήψης">
        <DateInput
          value={p.taken_on}
          onChange={(taken_on) => {
            if (taken_on && taken_on <= today()) save.mutate({ id: p.id, taken_on, path: p.path, thumb_path: p.thumb_path })
          }}
        />
      </Field>
    </Sheet>
  )
}
