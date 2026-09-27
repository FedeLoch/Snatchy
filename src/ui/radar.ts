import type { VisionAnalysis } from '../domain/vision';
import { escapeHtml as e } from './html';
import { formatNumber, t } from '../i18n';
import { eventDetail, eventTitle } from './labels';

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
    { key: 'radarPanel.elbowExtension', value: range('elbow') },
    { key: 'radarPanel.hipExtension', value: range('hip') },
    { key: 'radarPanel.kneeExtension', value: range('knee') },
    { key: 'radarPanel.kneeExcursion', value: range('knee', true) },
    { key: 'radarPanel.elbowExcursion', value: range('elbow', true) },
  ] as const;
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
  return `<section class="radar-card" aria-label="${e(t('radarPanel.aria'))}"><div class="section-title"><h2>${e(t('radarPanel.title'))}</h2><span class="micro">${e(t('radarPanel.measurements'))}</span></div><p class="footnote">${e(t('radarPanel.lede'))}</p><svg class="radar-chart" viewBox="0 0 360 310" role="img" aria-label="${e(t('radarPanel.chartAria'))} ${e(t(complete ? 'radarPanel.chartAriaComplete' : 'radarPanel.chartAriaInsufficient'))}">${[1 / 3, 2 / 3, 1].map((scale) => `<polygon points="${polygon(100 * scale)}" class="radar-grid"/>`).join('')}${metrics
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
      : `<text x="180" y="164" text-anchor="middle" class="radar-label">${e(t('radarPanel.unavailable'))}</text>`
  }${metrics
    .map((m, i) => {
      const [x, y] = point(i, 132);
      return `<text x="${x}" y="${y}" text-anchor="middle" class="radar-label">${e(t(m.key))}</text>`;
    })
    .join(
      '',
    )}<text x="185" y="157" class="radar-scale">0°</text><text x="185" y="64" class="radar-scale">180°</text></svg><dl class="radar-values">${metrics.map((m) => `<div><dt>${e(t(m.key))}</dt><dd>${m.value === null ? e(t('radarPanel.unavailable')) : `${e(formatNumber(m.value, 0))}\u00B0`}</dd></div>`).join('')}</dl><p class="footnote">${e(t('radarPanel.footnote'))}</p><div class="radar-review"><h3>${e(t('radarPanel.pointsToReview'))}</h3>${a.status !== 'tracked' ? `<p>${e(t('radarPanel.improveRecording'))}</p>` : hypotheses.length ? hypotheses.map((event) => `<p><strong>${e(eventTitle(event.title))}</strong> · ${e(formatNumber(event.time, 2))} s<br>${e(eventDetail(event.id, event.detail, event.values))}</p>`).join('') : `<p>${e(t('radarPanel.noneEstablished'))}</p>`}</div></section>`;
}
