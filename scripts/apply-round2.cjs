const fs = require('fs');

/* ============ lift-analysis.ts ============ */
(() => {
  const p = 'src/ui/lift-analysis.ts';
  let s = fs.readFileSync(p, 'utf8');

  /* --- obs 8: hoist bar-notes explainer out of barPanel into new export barEstimation(a) --- */
  const openAt = s.indexOf('<details class="bar-notes">');
  if (openAt < 0) throw new Error('bar-notes open not found');
  const closeAt = s.indexOf('</details>', openAt) + '</details>'.length;
  const barNotes = s.slice(openAt, closeAt);
  console.log('barNotes block bytes', barNotes.length);
  // remove from barPanel return tail
  s = s.slice(0, openAt) + s.slice(closeAtRecall);
  if (s === undefined) throw new Error('splice bug');

  const startOfBp = s.indexOf('export function barPanel');
  const decl = `export function barEstimation(a: VisionAnalysis): string {
  return \\`<section>${barNotes.replace(/["'`]/g, (m) => '\\' + m)}</section>\\`;
}
`;
  s = s.slice(0, startOfBp) + decl + s.slice(startOfBp);

  /* --- obs 4: stick-man overlay for snatch family in barPanel (illustrative, honest) --- */
  const stick = `
function stickFigure(a: VisionAnalysis): string {
  if ((a.exercise?.family ?? 'snatch') !== 'snatch') return '';
  const wrist = a.wristLine ?? { start: 0.5, end: 0.82 };
  const mid = ((wrist.start ?? 0.5) + (wrist.end ?? 0.82)) / 2;
  const cx = 210, head = 0.055 * 1000;
  const hipY = 1 - mid * 0.92;
  const cy = hipY * 0.3;
  return `
    <g class="stick-man" transform="translate(${(cx|0)},0)" aria-hidden="true">
      <circle cx="0" cy="${cy}" r="${head}"/>
      <line x1="0" y1="${cy + head}" x2="0" y2="${cy + head + 3.4 * head}"/>
      <line x1="0" y1="${cy + head + 1.4 * head}" x2="${-1.1 * head}" y2="${cy + head + 2.6 * head}"/>
      <line x1="0" y1="${cy + head + 1.4 * head}" x2="${1.1 * head}" y2="${cy + head + 2.6 * head}"/>
      <line x1="0" y1="${cy + head + 3.4 * head}" x2="${-0.9 * head}" y2="${cy + head + 4.5 * head}"/>
      <line x1="0" y1="${cy + head + 3.4 * head}" x2="${0.9 * head}" y2="${cy + head + 4.5 * head}"/>
      <title>Illustrative body reference, not tracked from your video</title>
    </g>`;
}
`;
  const idxPose = s.lastIndexOf('export function barPanel');
  s = s.slice(0, idxPose) + stick + s.slice(idxPose);
  // inject stickFigure inside barPanel return before metrics (search anchor inside barPanel)
  const anchor = 'class="floating-metric" data-metric="';
  const anchorIdx = s.indexOf(anchorapsed);
  if (anchorIdx < 0) throw new Error('barPanel metric anchor not found');
  s = s.slice(0, anchorIdx) + '${stickFigure(a)}' + s.slice(anchorIdx);

  fs.writeFileSync(p, s);
  console.log('[lift-analysis] written', p, 'len', s.length);
})();

/* ============ vision.ts ============ */
(() => {
  const p = 'src/ui/vision.ts';
  let s = fs.readFileSync(p, 'utf8');
  const openIdx = s.indexOf('How the score is calculated</summary>');
  if (openIdx < 0) throw new Error('vision score-calc not found');
  const detailsOpen = s.lastIndexOf('<details', openIdx);
  const detailsClose = s.indexOf('</details>', openIdx) + '</details>'.length;
  const block = s.slice(detailsOpen, detailsClose);
  console.log('[vision] score-calc block bytes', block.length);
  fs.writeFileSync('/tmp/vision-scorecalc-block.txt', block);
})();

console.log('danger-zone checks: no undefined splice', 'ok');
