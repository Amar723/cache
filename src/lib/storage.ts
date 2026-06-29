import {decode} from 'base64-arraybuffer';

import {STORAGE_BUCKET, supabase} from './supabase';

/**
 * Avatar uploads to Supabase Storage.
 *
 * We store under `<userId>/avatar.<ext>` so RLS storage policies can scope each
 * user to their own folder, and so a re-upload overwrites the previous file
 * (upsert) rather than orphaning blobs. Returns the public URL to persist on the
 * profile row.
 *
 * The image is passed in as base64 (react-native-image-picker `includeBase64`)
 * which we decode to an ArrayBuffer — the most reliable way to upload binary
 * from React Native, where Blob support is inconsistent across versions.
 */
export interface AvatarUpload {
  base64: string;
  /** e.g. "image/jpeg". Defaults to jpeg when the picker omits it. */
  mimeType?: string | null;
  /** Original filename, used only to derive an extension. */
  fileName?: string | null;
}

function extensionFor(upload: AvatarUpload): string {
  if (upload.fileName && upload.fileName.includes('.')) {
    return upload.fileName.split('.').pop()!.toLowerCase();
  }
  if (upload.mimeType) {
    return upload.mimeType.split('/').pop()!.toLowerCase();
  }
  return 'jpg';
}

export async function uploadAvatar(
  userId: string,
  upload: AvatarUpload,
): Promise<string> {
  const ext = extensionFor(upload);
  const path = `${userId}/avatar.${ext}`;
  const contentType = upload.mimeType ?? 'image/jpeg';

  const {error} = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, decode(upload.base64), {
      contentType,
      upsert: true,
    });

  if (error) {
    throw error;
  }

  const {data} = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  // Bust caches when the file is overwritten by appending the upload time.
  return `${data.publicUrl}?v=${Date.now()}`;
}
