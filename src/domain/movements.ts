import { snatch } from '../data/snatch';
import type { Movement } from './types';
// Future movements are catalog entries, not partly implemented experiences.
const planned = [
  'Clean',
  'Jerk',
  'Clean & Jerk',
  'Back Squat',
  'Front Squat',
].map((name): Movement => ({
  id: name.toLowerCase().replaceAll(' & ', '-and-').replaceAll(' ', '-'),
  name,
  available: false,
  description: 'Planned movement',
  cameraGuide: '',
  drills: [],
}));
export const movements: readonly Movement[] = [snatch, ...planned];
export function getMovement(id: string): Movement | undefined {
  return movements.find((m) => m.id === id);
}
export function availableMovements(): Movement[] {
  return movements.filter((m) => m.available);
}
export function requireMovement(id: string): Movement {
  const movement = getMovement(id);
  if (!movement?.available)
    throw new Error('This movement is not available yet.');
  return movement;
}
