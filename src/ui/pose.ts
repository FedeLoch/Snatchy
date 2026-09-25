import {
  barTrace,
  elbowDegrees,
  MOTION,
  snatchPose,
  type Point,
} from '../domain/snatch-motion';
const point = (p: Point) => p.map((n) => n.toFixed(2)).join(',');
const trace = (time: number) =>
  barTrace(time)
    .map((p, i) => `${i ? 'L' : 'M'}${point(p)}`)
    .join(' ');
export function poseSvg(time = 0, overlay = true, highlight?: string): string {
  const p = snatchPose(time);
  const leg = `M${point(p.hip)} L${point(p.knee)} L${point(p.ankle)}`;
  const arm = `M${point(p.shoulder)} L${point(p.elbow)} L${point(p.wrist)}`;
  const focus =
    highlight === 'elbow'
      ? p.elbow
      : highlight === 'shoulder'
        ? p.shoulder
        : p.bar;
  return `<svg class="athlete" viewBox="70 0 260 380" role="img" aria-label="Illustrated Snatch motion. Not tracked athlete data." data-motion-time="${Math.max(0, Math.min(MOTION.duration, Number.isFinite(time) ? time : 0))}"><path class="figure-grid" d="M80 354H320M120 30v324M200 30v324M280 30v324M80 114h240M80 194h240M80 274h240" stroke-width=".6"/><ellipse class="figure-shadow" cx="196" cy="356" rx="60" ry="5" opacity=".65"/>
 <g class="figure-limb" transform="translate(-10,-2)" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="${leg}" stroke-width="17"/><path d="${arm}" stroke-width="11"/><path d="M176 ${348 - p.heelLift}L191 ${350 - p.heelLift}L218 350" stroke-width="8"/></g>
 <path class="figure-leg" d="${leg}" fill="none" stroke-width="20" stroke-linecap="round" stroke-linejoin="round"/>
 <path class="figure-torso" d="M${point(p.hip)}L${point(p.shoulder)}" stroke-width="30" stroke-linecap="round"/>
 <path class="figure-skin" d="M${point(p.shoulder)}L${p.head[0] - 2},${p.head[1] + 13}" stroke-width="12" stroke-linecap="round"/>
 <circle class="figure-skin-fill" cx="${p.head[0]}" cy="${p.head[1]}" r="16"/><path class="figure-limb" d="M${p.head[0] + 10} ${p.head[1] - 2}h4" stroke-width="2"/>
 <path class="figure-heel" d="M176 ${348 - p.heelLift}L191 ${350 - p.heelLift}L218 350" fill="none" stroke-width="8" stroke-linecap="round"/>
 <path class="figure-skin" d="${arm}" fill="none" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
 <g data-overlay="${overlay}" opacity="${overlay ? 1 : 0}"><path class="figure-accent" d="${trace(time)}" data-bar-trace fill="none" stroke-width="1.8" stroke-linecap="round"/><path class="figure-accent" d="M194 36V354" stroke-opacity=".2" stroke-dasharray="3 6"/><path class="figure-accent" d="${leg} M${point(p.hip)} L${point(p.shoulder)} ${arm}" fill="none" stroke-width="1.2"/>${[p.shoulder, p.hip, p.knee, p.ankle, p.elbow].map((j) => `<circle class="figure-accent figure-accent-fill" cx="${j[0]}" cy="${j[1]}" r="2.7"/>`).join('')}</g>
 <g data-barbell transform="translate(${point(p.bar)})"><ellipse class="figure-plate figure-plate-edge" cx="-9" cy="-1" rx="21" ry="29" stroke-width="2"/><path class="figure-bar" d="M-32 0H37" stroke-width="4"/><ellipse class="figure-plate-lit figure-accent" cx="7" cy="0" rx="24" ry="30" fill-opacity=".8" stroke-width="2"/><ellipse class="figure-accent" cx="7" cy="0" rx="17" ry="23" fill="none" stroke-opacity=".3"/><circle class="figure-hub" cx="0" cy="0" r="4"/><path class="figure-skin figure-skin-fill" d="M-5 -3l5 6" stroke-width="5" stroke-linecap="round"/></g>
 ${overlay && highlight ? `<g><circle class="figure-warning" cx="${focus[0]}" cy="${focus[1]}" r="14" fill="none"/><text class="figure-warning-fill" x="${focus[0] + 19}" y="${focus[1] - 8}" font-size="10">${highlight === 'elbow' ? Math.round(elbowDegrees(p)) + '°' : highlight === 'bar' ? 'BAR' : ''}</text></g>` : ''}</svg>`;
}
export function snatchBarPathSvg(): string {
  const p = snatchPose(MOTION.catchTime);
  return `<svg viewBox="115 15 150 355" role="img" aria-label="Illustrative bar trajectory matching the demo motion"><path class="figure-silhouette" d="M${point(p.shoulder)}L${point(p.hip)}L${point(p.knee)}L${point(p.ankle)}M${point(p.shoulder)}L${point(p.bar)}" fill="none" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/><circle class="figure-silhouette-fill" cx="${p.head[0]}" cy="${p.head[1]}" r="13"/><path class="figure-axis" d="M194 30V354" stroke-dasharray="3 5"/><path class="figure-accent" d="${trace(MOTION.duration)}" fill="none" stroke-width="2.5"/><circle class="figure-accent-fill" cx="194" cy="46" r="4"/></svg>`;
}
