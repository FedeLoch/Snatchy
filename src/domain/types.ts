export interface Phase {
  id: string;
  name: string;
  start: number;
  score: number;
}
export interface Drill {
  id: string;
  name: string;
  instruction: string;
  cue: string;
}
export interface Issue {
  id: string;
  name: string;
  phaseId: string;
  severity: 'moderate' | 'minor';
  time: number;
  measurement: string;
  what: string;
  why: string;
  how: string;
  drillIds: string[];
  highlight: 'elbow' | 'bar' | 'shoulder';
}
export interface Metric {
  label: string;
  value: number;
  unit: string;
}
export interface Analysis {
  version: 1;
  movementId: string;
  score: number;
  verdict: string;
  summary: string;
  duration: number;
  simulated: true;
  phases: Phase[];
  issues: Issue[];
  metrics: Metric[];
}
export interface Movement {
  id: string;
  name: string;
  available: boolean;
  description: string;
  cameraGuide: string;
  drills: Drill[];
}
export interface LiftRecord {
  id: string;
  createdAt: number;
  source: 'demo' | 'video';
  analysis: Analysis;
}
export interface VideoSource {
  url: string;
  name: string;
  duration: number;
}
export type Page = 'home' | 'capture' | 'history' | 'result';
export type ProcessingStep =
  | 'Detecting athlete'
  | 'Tracking barbell'
  | 'Identifying lift phases'
  | 'Analyzing technique';
export interface AnalysisProvider {
  analyze(
    movementId: string,
    options: { signal: AbortSignal; onProgress: (step: number) => void },
  ): Promise<Analysis>;
}
