import type { Analysis, Movement } from '../domain/types';
export const snatch: Movement = {
  id: 'snatch',
  name: 'Snatch',
  available: true,
  description: 'One continuous movement. Every detail matters.',
  cameraGuide:
    'Place your phone at hip height, perpendicular to the athlete. Keep the whole athlete and both ends of the bar in frame.',
  drills: [
    {
      id: 'snatch-pull',
      name: 'Snatch Pull',
      instruction:
        'Practice the first and second pull without catching. Keep your arms long as your legs and hips finish extending.',
      cue: 'Push through the floor. Finish tall.',
    },
    {
      id: 'tall-snatch',
      name: 'Tall Snatch',
      instruction:
        'Start standing tall with an empty or light bar. Pull yourself under and receive in a stable overhead squat.',
      cue: 'Move under. Meet the bar.',
    },
    {
      id: 'high-hang-snatch',
      name: 'High Hang Snatch',
      instruction:
        'Start with the bar at the upper thigh. Drive with your legs, finish extension, then move decisively under.',
      cue: 'Legs first. Then fast under.',
    },
  ],
};
export const snatchDemo: Analysis = {
  version: 1,
  movementId: 'snatch',
  score: 83,
  verdict: 'Good lift',
  summary: 'A strong foundation. Let’s refine the details.',
  duration: 3.6,
  simulated: true,
  phases: [
    { id: 'setup', name: 'Setup', score: 94, start: 0 },
    { id: 'first-pull', name: 'First pull', score: 91, start: 0.45 },
    { id: 'transition', name: 'Transition', score: 86, start: 0.95 },
    { id: 'second-pull', name: 'Second pull', score: 72, start: 1.25 },
    { id: 'turnover', name: 'Turnover', score: 76, start: 1.65 },
    { id: 'catch', name: 'Catch', score: 84, start: 2.15 },
    { id: 'recovery', name: 'Recovery', score: 92, start: 2.8 },
  ],
  issues: [
    {
      id: 'arms',
      name: 'Early arm bend',
      phaseId: 'second-pull',
      severity: 'moderate',
      time: 1.34,
      measurement: '153° elbow angle · 81% hip extension',
      what: 'Arm flexion started approximately 120 ms before full hip extension.',
      why: 'Bending early can reduce the force transferred from your legs to the bar.',
      how: 'Keep your arms long. Finish driving through the floor before pulling under.',
      drillIds: ['snatch-pull', 'high-hang-snatch'],
      highlight: 'elbow',
    },
    {
      id: 'drift',
      name: 'Forward bar drift',
      phaseId: 'transition',
      severity: 'minor',
      time: 1.08,
      measurement: '6.4 cm horizontal displacement',
      what: 'The bar moved 6.4 cm away from the vertical reference during transition.',
      why: 'Forward movement can pull your balance away from the middle of your foot.',
      how: 'Keep the bar close as it passes your knees. Maintain pressure through your whole foot.',
      drillIds: ['snatch-pull'],
      highlight: 'bar',
    },
    {
      id: 'turnover',
      name: 'Slow turnover',
      phaseId: 'turnover',
      severity: 'minor',
      time: 1.85,
      measurement: 'Turnover phase · 76 / 100',
      what: 'The demo flags a delayed move under the bar after extension.',
      why: 'A slower turnover leaves less time to establish a stable overhead position.',
      how: 'Move actively under the bar and meet it with a firm overhead position.',
      drillIds: ['tall-snatch', 'high-hang-snatch'],
      highlight: 'shoulder',
    },
  ],
  metrics: [
    { label: 'Horizontal displacement', value: 6.4, unit: 'cm' },
    { label: 'Vertical displacement', value: 1.24, unit: 'm' },
    { label: 'Peak velocity', value: 1.82, unit: 'm/s' },
  ],
};
