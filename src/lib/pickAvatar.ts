import {launchImageLibrary} from 'react-native-image-picker';

import type {AvatarUpload} from './storage';

export interface PickedAvatar {
  upload: AvatarUpload;
  previewUri: string | null;
}

/**
 * Open the photo library and return an avatar ready for `uploadAvatar`.
 * Resolves null when the user cancels; throws when the image can't be read so
 * callers surface the failure in their own error UI.
 */
export async function pickAvatar(): Promise<PickedAvatar | null> {
  const result = await launchImageLibrary({
    mediaType: 'photo',
    includeBase64: true,
    maxWidth: 800,
    maxHeight: 800,
    quality: 0.8,
  });
  if (result.didCancel || !result.assets || result.assets.length === 0) {
    return null;
  }
  const asset = result.assets[0];
  if (!asset.base64) {
    throw new Error('Could not read that image. Try another.');
  }
  return {
    upload: {
      base64: asset.base64,
      mimeType: asset.type ?? 'image/jpeg',
      fileName: asset.fileName ?? null,
    },
    previewUri: asset.uri ?? null,
  };
}
