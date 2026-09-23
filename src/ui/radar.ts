import type { VisionAnalysis } from '../domain/vision';
import { escapeHtml as e } from './html';

export function radarMetrics(a: VisionAnalysis) {
  const range = (key: 'elbow' | 'hip' | 'knee', excursion = false) => {
    const r = a.ranges[key];
    return a.status === 'tracked' && r
      ? excursion
        ? r.max - r.min
        : r.max
      : null;
  };
  return [
    { label: 'Elbow extension', value: range('elbow') },
    { label: 'Hip extension', value: range('hip') },
    { label: 'Knee extension', value: range('knee') },
    { label: 'Knee excursion', value: range('knee', true) },
    { label: 'Elbow excursion', value: range('elbow', true) },
  ];
}

export function visionRadar(a: VisionAnalysis): string {
  const metrics = radarMetrics(a);
  const point = (i: number, radius: number) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    return [180 + Math.cos(angle) * radius, 160 + Math.sin(angle) * radius];
  };
  const polygon = (radius: number) =>
    metrics.map((_, i) => point(i, radius).join(',')).join(' ');
  const complete = metrics.every((m) => m.value !== null);
  const hypotheses = a.events.filter((event) => event.kind === 'hypothesis');
  return `<section class="radar-card" aria-label="Movement profile"><div class="section-title"><h2>Movement profile</h2><span class="micro">5 MEASUREMENTS</span></div><p class="footnote">Your measured angles at a glance. A larger shape does not mean better technique.</p><svg class="radar-chart" viewBox="0 0 360 310" role="img" aria-label="Five-axis radar chart of measured joint angles, zero to 180 degrees. ${complete ? 'Values listed below.' : 'Insufficient evidence; values withheld.'}">${[1 / 3, 2 / 3, 1].map((scale) => `<polygon points="${polygon(100 * scale)}" class="radar-grid"/>`).join('')}${metrics
    .map((_, i) => {
      const [x, y] = point(i, 100);
      return `<line x1="180" y1="160" x2="${x}" y2="${y}" class="radar-grid"/>`;
    })
    .join('')}${
    complete
      ? `<polygon points="${metrics.map((m, i) => point(i, (100 * m.value!) / 180).join(',')).join(' ')}" class="radar-value"/>${metrics
          .map((m, i) => {
            const [x, y] = point(i, (100 * m.value!) / 180);
            return `<circle cx="${x}" cy="${y}" r="4" class="radar-point"/>`;
          })
          .join('')}`
      : '<text x="180" y="164" text-anchor="middle" class="radar-label">Unavailable</text>'
  }${metrics
    .map((m, i) => {
      const [x, y] = point(i, 132);
      return `<text x="${x}" y="${y}" text-anchor="middle" class="radar-label">${e(m.label)}</text>`;
    })
    .join(
      '',
    )}<text x="185" y="157" class="radar-scale">0°</text><text x="185" y="64" class="radar-scale">180°</text></svg><dl class="radar-values">${metrics.map((m) => `<div><dt>${e(m.label)}</dt><dd>${m.value === null ? 'Unavailable' : Math.round(m.value) + '°'}</dd></div>`).join('')}</dl><p class="footnote">Extension is the upper measured angle; excursion is the difference between the lower and upper angles. All axes use 0–180°, based on the 5th–95th percentile ranges.</p><div class="radar-review"><h3>Points to review</h3>${a.status !== 'tracked' ? '<p>Improve the recording first: use a steady side view, good lighting, and keep the whole athlete visible.</p>' : hypotheses.length ? hypotheses.map((event) => `<p><strong>${e(event.title)}</strong> · ${event.time.toFixed(2)} s<br>${e(event.detail)}</p>`).join('') : '<p>No technique improvement was established by these measurements. Review the timestamped moments below with a coach; the chart shows motion, not an ideal target.</p>'}</div></section>`;
}
