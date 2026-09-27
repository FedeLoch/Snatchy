import type { VideoSource } from '../domain/types';
export const MAX_VIDEO_BYTES = 250 * 1024 * 1024;
export function validateVideo(file: Pick<File, 'type' | 'size'>): string {
  if (!file.type.startsWith('video/')) return 'errors.media.wrongType';
  if (file.size === 0) return 'errors.media.empty';
  if (file.size > MAX_VIDEO_BYTES) return 'errors.media.tooLarge';
  return '';
}
export async function prepareVideo(
  file: File,
  signal?: AbortSignal,
): Promise<VideoSource> {
  const error = validateVideo(file);
  if (error) throw new Error(error);
  signal?.throwIfAborted();
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.preload = 'metadata';
  try {
    const duration = await new Promise<number>((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timer);
        video.onloadedmetadata = null;
        video.onerror = null;
        signal?.removeEventListener('abort', cancel);
      };
      const fail = (message: string) => {
        cleanup();
        reject(new Error(message));
      };
      const cancel = () => {
        cleanup();
        reject(new DOMException('errors.media.cancelled', 'AbortError'));
      };
      const timer = setTimeout(() => fail('errors.media.openTimedOut'), 10000);
      video.onloadedmetadata = () => {
        const length = video.duration;
        if (!Number.isFinite(length) || length <= 0)
          return fail('errors.media.noDuration');
        cleanup();
        resolve(length);
      };
      video.onerror = () => fail('errors.media.cannotPlay');
      signal?.addEventListener('abort', cancel, { once: true });
      video.src = url;
    });
    return { url, name: file.name, duration };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  } finally {
    video.removeAttribute('src');
    video.load();
  }
}
export function releaseVideo(source: VideoSource | null): void {
  if (source) URL.revokeObjectURL(source.url);
}
