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
  return `<svg class="athlete" viewBox="70 0 260 380" role="img" aria-label="Illustrated Snatch motion. Not tracked athlete data." data-motion-time="${Math.max(0, Math.min(MOTION.duration, Number.isFinite(time) ? time : 0))}"><path d="M80 354H320M120 30v324M200 30v324M280 30v324M80 114h240M80 194h240M80 274h240" stroke="#39452f" stroke-width=".6"/><ellipse cx="196" cy="356" rx="60" ry="5" fill="#080b07" opacity=".65"/>
 <g transform="translate(-10,-2)" fill="none" stroke="#526246" stroke-linecap="round" stroke-linejoin="round"><path d="${leg}" stroke-width="17"/><path d="${arm}" stroke-width="11"/><path d="M176 ${348 - p.heelLift}L191 ${350 - p.heelLift}L218 350" stroke-width="8"/></g>
 <path d="${leg}" fill="none" stroke="#8f9d79" stroke-width="20" stroke-linecap="round" stroke-linejoin="round"/>
 <path d="M${point(p.hip)}L${point(p.shoulder)}" stroke="#677953" stroke-width="30" stroke-linecap="round"/>
 <path d="M${point(p.shoulder)}L${p.head[0] - 2},${p.head[1] + 13}" stroke="#b0bc99" stroke-width="12" stroke-linecap="round"/>
 <circle cx="${p.head[0]}" cy="${p.head[1]}" r="16" fill="#b0bc99"/><path d="M${p.head[0] + 10} ${p.head[1] - 2}h4" stroke="#526246" stroke-width="2"/>
 <path d="M176 ${348 - p.heelLift}L191 ${350 - p.heelLift}L218 350" fill="none" stroke="#d5ddc6" stroke-width="8" stroke-linecap="round"/>
 <path d="${arm}" fill="none" stroke="#b0bc99" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
 <g data-overlay="${overlay}" opacity="${overlay ? 1 : 0}"><path d="${trace(time)}" data-bar-trace fill="none" stroke="#d4f778" stroke-width="1.8" stroke-linecap="round"/><path d="M194 36V354" stroke="#d4f778" stroke-opacity=".2" stroke-dasharray="3 6"/><path d="${leg} M${point(p.hip)} L${point(p.shoulder)} ${arm}" fill="none" stroke="#d4f778" stroke-width="1.2"/>${[p.shoulder, p.hip, p.knee, p.ankle, p.elbow].map((j) => `<circle cx="${j[0]}" cy="${j[1]}" r="2.7" fill="#d4f778"/>`).join('')}</g>
 <g data-barbell transform="translate(${point(p.bar)})"><ellipse cx="-9" cy="-1" rx="21" ry="29" fill="#344828" stroke="#88a85e" stroke-width="2"/><path d="M-32 0H37" stroke="#d9dfcc" stroke-width="4"/><ellipse cx="7" cy="0" rx="24" ry="30" fill="#40572e" fill-opacity=".8" stroke="#d4f778" stroke-width="2"/><ellipse cx="7" cy="0" rx="17" ry="23" fill="none" stroke="#d4f778" stroke-opacity=".3"/><circle cx="0" cy="0" r="4" fill="#edf5dc"/><path d="M-5 -3l5 6" stroke="#b0bc99" stroke-width="5" stroke-linecap="round"/></g>
 ${overlay && highlight ? `<g><circle cx="${focus[0]}" cy="${focus[1]}" r="14" fill="none" stroke="#f0c995"/><text x="${focus[0] + 19}" y="${focus[1] - 8}" fill="#f0c995" font-size="10">${highlight === 'elbow' ? Math.round(elbowDegrees(p)) + '°' : highlight === 'bar' ? 'BAR' : ''}</text></g>` : ''}</svg>`;
}
export function snatchBarPathSvg(): string {
  const p = snatchPose(MOTION.catchTime);
  return `<svg viewBox="115 15 150 355" role="img" aria-label="Illustrative bar trajectory matching the demo motion"><path d="M${point(p.shoulder)}L${point(p.hip)}L${point(p.knee)}L${point(p.ankle)}M${point(p.shoulder)}L${point(p.bar)}" fill="none" stroke="#46513b" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${p.head[0]}" cy="${p.head[1]}" r="13" fill="#46513b"/><path d="M194 30V354" stroke="#8a957c" stroke-dasharray="3 5"/><path d="${trace(MOTION.duration)}" fill="none" stroke="#d4f778" stroke-width="2.5"/><circle cx="194" cy="46" r="4" fill="#d4f778"/></svg>`;
}
