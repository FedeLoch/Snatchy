import { exerciseById } from './exercises';
import { type Point } from './snatch-motion';

export interface BarPathModel {
  exerciseName: string;
  family: 'snatch' | 'clean';
  start: 'floor' | 'hang' | 'high-hang';
  receiving: 'squat' | 'power' | 'muscle';
  startY: number;
  topY: number;
  refPoints: Point[];
  corridorPath: string;
  refTracePath: string;
  silhouette: {
    legs: string;
    arms: string;
    head: Point;
    bar: Point;
  };
}

const formatPoint = (p: Point) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`;

export function getBarPathModel(exerciseId?: string): BarPathModel {
  const ex = exerciseById(exerciseId ?? 'snatch');
  const family = ex?.family ?? 'snatch';
  const start = ex?.start ?? 'floor';
  const receiving = ex?.receiving ?? 'squat';
  const name = ex?.name ?? 'Snatch';

  const startY = start === 'high-hang' ? 215 : start === 'hang' ? 255 : 324;
  const topY = family === 'clean' ? (receiving === 'squat' ? 168 : 145) : 46;

  // Build reference trajectory points
  let allPoints: Point[] = [];
  if (family === 'clean') {
    const catchPoint: Point = receiving === 'squat' ? [198, 168] : [198, 145];
    allPoints = [
      [218, 324],
      [218, 290],
      [214, 255],
      [211, 221],
      [206, 185],
      [204, 160],
      catchPoint,
    ];
  } else {
    allPoints = [
      [218, 324],
      [218, 290],
      [214, 255],
      [211, 221],
      [205, 180],
      [200, 120],
      [194, 75],
      [194, 46],
    ];
  }

  // Filter start position
  const refPoints =
    start === 'high-hang'
      ? allPoints.filter((p) => p[1] <= 215)
      : start === 'hang'
        ? allPoints.filter((p) => p[1] <= 255)
        : allPoints;

  // Ensure first point matches startY
  if (refPoints.length > 0) {
    refPoints[0] = [refPoints[0][0], startY];
  }

  const corridorWidth = family === 'clean' ? 8 : 9;
  const corridorLeft = refPoints.map((p) => `${(p[0] - corridorWidth).toFixed(1)},${p[1].toFixed(1)}`);
  const corridorRight = [...refPoints].reverse().map((p) => `${(p[0] + corridorWidth).toFixed(1)},${p[1].toFixed(1)}`);
  const corridorPath = `M${corridorLeft.join(' L')} L${corridorRight.join(' L')} Z`;

  const refTracePath = refPoints
    .map((p, i) => `${i ? 'L' : 'M'}${formatPoint(p)}`)
    .join(' ');

  // Silhouette configuration
  let legs = '';
  let arms = '';
  let head: Point = [170, 130];
  let bar: Point = [194, 46];

  if (family === 'clean') {
    if (receiving === 'squat') {
      const hip: Point = [152, 260];
      const knee: Point = [205, 305];
      const ankle: Point = [176, 350];
      const shoulder: Point = [182, 168];
      const elbow: Point = [226, 168];
      const wrist: Point = [198, 168];
      head = [182, 136];
      bar = [198, 168];
      legs = `M${formatPoint(shoulder)}L${formatPoint(hip)}L${formatPoint(knee)}L${formatPoint(ankle)}`;
      arms = `M${formatPoint(shoulder)}L${formatPoint(elbow)}L${formatPoint(wrist)}`;
    } else {
      const hip: Point = [175, 225];
      const knee: Point = [198, 275];
      const ankle: Point = [176, 350];
      const shoulder: Point = [185, 145];
      const elbow: Point = [228, 145];
      const wrist: Point = [198, 145];
      head = [185, 115];
      bar = [198, 145];
      legs = `M${formatPoint(shoulder)}L${formatPoint(hip)}L${formatPoint(knee)}L${formatPoint(ankle)}`;
      arms = `M${formatPoint(shoulder)}L${formatPoint(elbow)}L${formatPoint(wrist)}`;
    }
  } else {
    if (receiving === 'squat') {
      const hip: Point = [152, 266];
      const knee: Point = [205, 305];
      const ankle: Point = [176, 350];
      const shoulder: Point = [170, 160];
      head = [170, 130];
      bar = [194, 46];
      legs = `M${formatPoint(shoulder)}L${formatPoint(hip)}L${formatPoint(knee)}L${formatPoint(ankle)}`;
      arms = `M${formatPoint(shoulder)}L${formatPoint(bar)}`;
    } else {
      const hip: Point = [175, 230];
      const knee: Point = [198, 280];
      const ankle: Point = [176, 350];
      const shoulder: Point = [180, 140];
      head = [180, 110];
      bar = [194, 46];
      legs = `M${formatPoint(shoulder)}L${formatPoint(hip)}L${formatPoint(knee)}L${formatPoint(ankle)}`;
      arms = `M${formatPoint(shoulder)}L${formatPoint(bar)}`;
    }
  }

  return {
    exerciseName: name,
    family,
    start,
    receiving,
    startY,
    topY,
    refPoints,
    corridorPath,
    refTracePath,
    silhouette: {
      legs,
      arms,
      head,
      bar,
    },
  };
}
