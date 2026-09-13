import type { ImagePickerAsset } from 'expo-image-picker';

/**
 * A picked image, in whatever shape THIS platform's FormData understands.
 *
 * THE BUG THIS FIXES. Every upload in the app appended the React Native shape
 * - `{ uri, name, type }` - to a FormData. React Native's own FormData knows
 * to read a file off that object; the BROWSER's does not. It has no idea what
 * the object is, so it stringifies it, and the server receives the eleven
 * characters "[object Object]" where a file should be. Measured against the
 * running API: `422 The file field must be a file.`
 *
 * Which meant NO UPLOAD FROM THE WEB BUILD HAS EVER WORKED - not a member's
 * NID, not their nominee's, not a payment slip, not a signatory's signature.
 * Five call sites, one mistake, and invisible on the platform most of the
 * development happened on.
 *
 * `asset.file` IS THE WEB ANSWER AND ONLY EXISTS THERE. expo-image-picker's
 * web implementation puts the real `File` on the asset
 * (ExponentImagePicker.web.ts) and its types declare it optional for exactly
 * that reason. A `File` is a `Blob`, which browser FormData handles natively.
 *
 * So: the File when there is one, the React Native shape when there is not.
 * Not a `Platform.OS` check - the presence of the thing that works is a
 * better question than the name of the platform, and it keeps working if a
 * future version of the picker starts providing it elsewhere.
 */
export function filePart(asset: ImagePickerAsset, fallbackName: string): Blob {
  const web = (asset as ImagePickerAsset & { file?: File }).file;

  if (web) return web;

  return {
    uri: asset.uri,
    name: asset.fileName ?? fallbackName,
    type: asset.mimeType ?? 'image/jpeg',
  } as unknown as Blob;
}
