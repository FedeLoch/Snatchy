import type { VideoSource } from '../domain/types';
export const MAX_VIDEO_BYTES = 250 * 1024 * 1024;
export function validateVideo(file: Pick<File, 'type' | 'size'>): string {
  if (!file.type.startsWith('video/'))
    return 'Choose a video file, such as MP4, MOV, or WebM.';
  if (file.size === 0) return 'This video is empty. Choose another recording.';
  if (file.size > MAX_VIDEO_BYTES)
    return 'Choose a video smaller than 250 MB. A short clip of one lift works best.';
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
        reject(new DOMException('Video cancelled', 'AbortError'));
      };
      const timer = setTimeout(
        () => fail('This video took too long to open. Try a shorter MP4 clip.'),
        10000,
      );
      video.onloadedmetadata = () => {
        const length = video.duration;
        if (!Number.isFinite(length) || length <= 0)
          return fail('This video has no playable duration. Try another clip.');
        cleanup();
        resolve(length);
      };
      video.onerror = () =>
        fail('This browser cannot play that video. Try an MP4 or WebM clip.');
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
