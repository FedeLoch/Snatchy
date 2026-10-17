import { t } from '../i18n';

type P = readonly [number, number];
const pt = ([x, y]: P) => `${x.toFixed(1)},${y.toFixed(1)}`;
const add = (p: P, q: P, k = 1): P => [p[0] + q[0] * k, p[1] + q[1] * k];
const along = (from: P, to: P, length: number): P => {
  const d = Math.hypot(to[0] - from[0], to[1] - from[1]) || 1;
  return add(from, [(to[0] - from[0]) / d, (to[1] - from[1]) / d], length);
};

/** A lifter in the floor start position, seen side-on and facing right, at
 * roughly 1.6 units per centimetre. Segment lengths follow common
 * anthropometric ratios, and the pose follows a sound setup: bar over
 * midfoot, shins forward, hips above knees, flat back, straight arms and
 * shoulders slightly ahead of the bar. */
const FLOOR = 228;
const PLATE = 29;
const bar: P = [190, FLOOR - PLATE];
const ankle: P = [182, FLOOR - 7];
const knee: P = [204, 175];
const hip: P = [159, 149];
const shoulder: P = [211, 112];
const elbow = along(shoulder, bar, 41);
const head: P = [228, 99];
const far = (p: P): P => [p[0] - 9, p[1] - 3];
const limb = (points: P[]) => `M${points.map(pt).join('L')}`;

/** The torso as a tapered outline instead of a thick stroke. */
function torso(): string {
  const d = Math.hypot(shoulder[0] - hip[0], shoulder[1] - hip[1]);
  const n: P = [(hip[1] - shoulder[1]) / d, (shoulder[0] - hip[0]) / d];
  return `M${[
    add(hip, n, -12),
    add(shoulder, n, -10),
    add(shoulder, n, 13),
    add(hip, n, 13),
  ]
    .map(pt)
    .join('L')}Z`;
}

/** Camera setup guide for the capture screen: the side-on frame the phone
 * should see, its height, and (inset, from above) that it looks along the
 * bar at a right angle to the way the lifter faces. Illustration only. */
export function captureGuideSvg(): string {
  const back = `
    <g fill="none" stroke-linecap="round" stroke-linejoin="round">
      <path class="figure-limb" d="${limb([far(hip), far(knee), far(ankle)])}" stroke-width="17"/>
      <path class="figure-limb" d="${limb([far(shoulder), far(elbow), far(bar)])}" stroke-width="10"/>
      <path class="figure-limb" d="M${ankle[0] - 19},${FLOOR - 5}H${ankle[0] + 13}" stroke-width="8"/>
    </g>`;
  const plateFace = `<circle class="figure-plate-lit" cx="${bar[0]}" cy="${bar[1]}" r="${PLATE}" fill-opacity=".22"/>`;
  const front = `
    <g fill="none" stroke-linecap="round" stroke-linejoin="round">
      <path class="figure-leg" d="${limb([hip, knee, ankle])}" stroke-width="19"/>
      <path class="figure-heel" d="M${ankle[0] - 11},${FLOOR - 3}H${ankle[0] + 22}" stroke-width="8"/>
    </g>
    <path class="guide-torso" d="${torso()}" stroke-width="5" stroke-linejoin="round"/>
    <g fill="none" stroke-linecap="round" stroke-linejoin="round">
      <path class="figure-skin" d="${limb([shoulder, along(shoulder, head, 14)])}" stroke-width="11"/>
      <path class="figure-skin" d="${limb([shoulder, elbow, bar])}" stroke-width="11"/>
    </g>
    <circle class="figure-skin-fill" cx="${head[0]}" cy="${head[1]}" r="12.5"/>`;
  const plate = `
    <path class="figure-bar" d="M${bar[0] - 46},${bar[1]}H${bar[0] + 46}" stroke-width="4" stroke-linecap="round"/>
    <circle class="figure-plate-edge" cx="${bar[0]}" cy="${bar[1]}" r="${PLATE}" fill="none" stroke-width="3"/>
    <circle class="figure-plate-edge" cx="${bar[0]}" cy="${bar[1]}" r="${PLATE - 9}" fill="none" stroke-width="1.2" stroke-opacity=".45"/>
    <circle class="figure-hub" cx="${bar[0]}" cy="${bar[1]}" r="4"/>`;
  // Framing brackets: the whole body and both bar ends stay in shot.
  const box = { x0: 124, y0: 70, x1: 262, y1: FLOOR + 8 };
  const c = 14;
  const brackets = [
    `M${box.x0},${box.y0 + c}V${box.y0}H${box.x0 + c}`,
    `M${box.x1 - c},${box.y0}H${box.x1}V${box.y0 + c}`,
    `M${box.x0},${box.y1 - c}V${box.y1}H${box.x0 + c}`,
    `M${box.x1 - c},${box.y1}H${box.x1}V${box.y1 - c}`,
  ].join('');
  // Lens height: a phone marker on the hip line, outside the frame.
  const lens = `
    <path class="figure-accent" d="M${box.x0 - 26},${hip[1]}H${box.x1 + 12}" stroke-width="1.2" stroke-dasharray="4 5" stroke-opacity=".7"/>
    <rect class="figure-plate figure-plate-edge" x="${box.x0 - 46}" y="${hip[1] - 14}" width="16" height="28" rx="3.5" stroke-width="1.5"/>
    <circle class="figure-accent-fill" cx="${box.x0 - 38}" cy="${hip[1] - 7}" r="2.5"/>
    <circle class="figure-accent-fill" cx="${hip[0]}" cy="${hip[1]}" r="3.5"/>`;
  // From above: the lifter faces the bar; the phone looks along the bar.
  const inset = `
    <g transform="translate(62 14) scale(.85)">
      <rect class="guide-inset" x="0" y="0" width="62" height="86" rx="7" stroke-width="1"/>
      <path class="figure-bar" d="M31 12V62" stroke-width="2.5" stroke-linecap="round"/>
      <rect class="figure-plate-edge" x="23" y="9" width="16" height="5" rx="1.5" fill="none" stroke-width="1.5"/>
      <rect class="figure-plate-edge" x="23" y="60" width="16" height="5" rx="1.5" fill="none" stroke-width="1.5"/>
      <ellipse class="figure-skin-fill" cx="20" cy="37" rx="6" ry="11"/>
      <path class="figure-skin" d="M24 37h6" stroke-width="2" stroke-linecap="round"/>
      <rect class="figure-plate figure-plate-edge" x="27" y="74" width="8" height="10" rx="1.5" stroke-width="1"/>
      <path class="figure-accent" d="M31 73V67" stroke-width="1.4" stroke-dasharray="2 2"/>
      <path class="figure-accent" d="M36 69h5v5" fill="none" stroke-width="1"/>
    </g>`;
  return `<svg class="athlete capture-guide" viewBox="56 8 222 236" role="img" aria-label="${t('capture.guideAria')}">
    <path class="figure-grid" d="M60 ${FLOOR + 0.5}H274" stroke-width="1"/>
    <ellipse class="figure-shadow" cx="${bar[0] - 6}" cy="${FLOOR + 2}" rx="62" ry="4.5" opacity=".7"/>
    ${lens}${back}${plateFace}${front}${plate}
    <path class="figure-accent" d="${brackets}" fill="none" stroke-width="2.2" stroke-linecap="round"/>
    ${inset}
  </svg>`;
}
