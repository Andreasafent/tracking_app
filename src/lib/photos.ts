import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { BodyPhoto } from './database.types'
import type { ISODate } from './dates'
import { must, supabase } from './supabase'

const BUCKET = 'progress-photos'
const URL_TTL = 60 * 60

/** Re-encodes a picture as JPEG with its longest side at most `max` px (keeps EXIF rotation). */
async function resize(file: File, max: number): Promise<Blob> {
  const img = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => {
    throw new Error(`Το «${file.name}» δεν μπορεί να διαβαστεί ως εικόνα. Δοκίμασε JPG ή PNG.`)
  })
  const scale = Math.min(1, max / Math.max(img.width, img.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(img.width * scale)
  canvas.height = Math.round(img.height * scale)
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
  img.close()
  return new Promise((ok, fail) =>
    canvas.toBlob((b) => (b ? ok(b) : fail(new Error('Αποτυχία συμπίεσης εικόνας'))), 'image/jpeg', 0.85),
  )
}

/** All photos, newest day first. */
export function useBodyPhotos() {
  return useQuery({
    queryKey: ['body_photos'],
    queryFn: async () =>
      must(await supabase.from('body_photos').select('*').order('taken_on', { ascending: false }).order('created_at')),
  })
}

/** Temporary links for files in the private bucket, as { path: url }. */
export function useSignedUrls(paths: string[]) {
  return useQuery({
    queryKey: ['photo_urls', paths],
    enabled: paths.length > 0,
    staleTime: (URL_TTL - 600) * 1000,
    gcTime: (URL_TTL - 600) * 1000,
    refetchInterval: (URL_TTL - 600) * 1000,
    placeholderData: (prev) => prev,
    queryFn: async () => {
      const data = must(await supabase.storage.from(BUCKET).createSignedUrls(paths, URL_TTL))
      return Object.fromEntries(data!.map((d) => [d.path, d.signedUrl])) as Record<string, string>
    },
  })
}

/** Uploads one at a time; `onProgress` gets how many are fully saved. */
export function useUploadPhotos() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { files: File[]; date: ISODate; onProgress: (done: number) => void }) => {
      const { data } = await supabase.auth.getSession()
      const uid = data.session!.user.id
      for (const [i, file] of v.files.entries()) {
        const name = `${uid}/${crypto.randomUUID()}`
        const path = `${name}.jpg`
        const thumb_path = `${name}_thumb.jpg`
        const bucket = supabase.storage.from(BUCKET)
        try {
          must(await bucket.upload(path, await resize(file, 1600), { contentType: 'image/jpeg' }))
          must(await bucket.upload(thumb_path, await resize(file, 400), { contentType: 'image/jpeg' }))
          must(await supabase.from('body_photos').insert({ taken_on: v.date, path, thumb_path }))
        } catch (e) {
          await bucket.remove([path, thumb_path]) // don't leave files that no row points to
          throw e
        }
        v.onProgress(i + 1)
      }
    },
    // Settled, not just success: a failure half-way still saved the earlier ones.
    onSettled: () => qc.invalidateQueries({ queryKey: ['body_photos'] }),
  })
}

export function useDeletePhoto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (p: BodyPhoto) => {
      must(await supabase.storage.from(BUCKET).remove([p.path, p.thumb_path]))
      must(await supabase.from('body_photos').delete().eq('id', p.id))
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['body_photos'] }),
  })
}
