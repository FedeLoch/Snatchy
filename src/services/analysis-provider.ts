import { snatchDemo } from '../data/snatch';
import { requireMovement } from '../domain/movements';
import type { AnalysisProvider, ProcessingStep } from '../domain/types';
export const processingSteps: ProcessingStep[] = [
  'Detecting athlete',
  'Tracking barbell',
  'Identifying lift phases',
  'Analyzing technique',
];
function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted();
    const cancel = () => {
      clearTimeout(timer);
      reject(new DOMException('Analysis cancelled', 'AbortError'));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', cancel);
      resolve();
    }, ms);
    signal.addEventListener('abort', cancel, { once: true });
  });
}
export const demoProvider: AnalysisProvider = {
  async analyze(movementId, { signal, onProgress }) {
    requireMovement(movementId);
    // Explicit provider dispatch: enabling a catalog entry never silently gives it Snatch data.
    if (movementId !== 'snatch')
      throw new Error('No analysis provider for this movement.');
    for (let i = 0; i < processingSteps.length; i++) {
      signal.throwIfAborted();
      onProgress(i);
      await wait(450, signal);
    }
    signal.throwIfAborted();
    return structuredClone(snatchDemo);
  },
};
