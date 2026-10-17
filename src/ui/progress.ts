import { progression, type ProgressSeries } from '../domain/progression';
import { exerciseById } from '../domain/exercises';
import type { VisionRecord } from '../domain/vision';
import { formatDate, formatDateTime, formatNumber, t } from '../i18n';
import { escapeHtml as e } from './html';
import { movementName } from './labels';

const W = 320,
  H = 150,
  left = 28,
  right = 14,
  top = 14,
  bottom = 26;
const signed = (n: number) =>
  `${n > 0 ? '+' : n < 0 ? '−' : '±'}${formatNumber(Math.abs(n))}`;
const name = (id: string) => movementName(id, exerciseById(id)?.name ?? id);

/** Score over time for one exercise: a single line on a fixed 0–100 scale,
 * evenly spaced recordings, hollow markers for partial scores, and a native
 * tooltip per recording. */
function chart(series: ProgressSeries): string {
  const n = series.points.length;
  const x = (i: number) =>
    n === 1
      ? (left + W - right) / 2
      : left + (i / (n - 1)) * (W - left - right);
  const y = (score: number) => top + (1 - score / 100) * (H - top - bottom);
  const line = series.points
    .map(
      (p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.score).toFixed(1)}`,
    )
    .join('');
  const grid = [0, 50, 100]
    .map(
      (v) =>
        `<path class="chart-grid progress-grid" d="M${left} ${y(v)}H${W - right}"/><text class="chart-label" x="${left - 6}" y="${y(v) + 3}" text-anchor="end" font-size="9">${formatNumber(v)}</text>`,
    )
    .join('');
  const last = series.points.at(-1)!;
  const dates =
    n > 1
      ? `<text class="chart-label" x="${left}" y="${H - 8}" font-size="9">${e(formatDate(series.points[0].time))}</text><text class="chart-label" x="${W - right}" y="${H - 8}" text-anchor="end" font-size="9">${e(formatDate(last.time))}</text>`
      : '';
  const marks = series.points
    .map(
      (p, i) =>
        `<g class="progress-point"><circle class="progress-marker ${p.partial ? 'partial' : ''}" cx="${x(i)}" cy="${y(p.score)}" r="4"/><circle class="progress-hit" cx="${x(i)}" cy="${y(p.score)}" r="12"><title>${e(`${formatDateTime(p.time)} · ${formatNumber(p.score)}/100${p.partial ? ` · ${t('vision.partialAnalysis')}` : ''}`)}</title></circle></g>`,
    )
    .join('');
  const label = `<text class="progress-value" x="${Math.min(x(n - 1), W - right - 2)}" y="${y(last.score) - 9}" text-anchor="${n === 1 ? 'middle' : 'end'}" font-size="11">${formatNumber(last.score)}</text>`;
  return `<svg class="progress-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${e(t('progress.chartAria', { movement: name(series.exerciseId), count: formatNumber(n) }))}">${grid}${dates}${n > 1 ? `<path class="chart-accent" d="${line}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>` : ''}${marks}${label}</svg>`;
}

/** Progression card shown above the recordings list. */
export function progressCard(
  records: VisionRecord[],
  selected: string | null,
): string {
  const all = progression(records);
  if (!all.length) return '';
  const series = all.find((s) => s.exerciseId === selected) ?? all[0];
  const chips =
    all.length > 1
      ? `<div class="progress-filter" role="group" aria-label="${e(t('progress.movementFilter'))}">${all
          .map(
            (s) =>
              `<button class="rep-pill" data-action="progress-exercise" data-id="${e(s.exerciseId)}" aria-pressed="${s === series}">${e(name(s.exerciseId))}<small>${formatNumber(s.points.length)}</small></button>`,
          )
          .join('')}</div>`
      : '';
  const tiles = [
    [t('progress.latest'), `${formatNumber(series.latest)}<small>/100</small>`],
    [
      t('progress.change'),
      series.change === null
        ? '—'
        : `${signed(series.change)}<small> ${e(t('progress.points'))}</small>`,
    ],
    [t('progress.best'), `${formatNumber(series.best)}<small>/100</small>`],
  ]
    .map(([label, value]) => `<div><dt>${e(label)}</dt><dd>${value}</dd></div>`)
    .join('');
  const note =
    series.points.length === 1
      ? t('progress.single')
      : series.recentTrend !== null
        ? t('progress.trend', { delta: signed(series.recentTrend) })
        : t('progress.early');
  const table = `<table class="sr-only"><caption>${e(t('progress.tableCaption', { movement: name(series.exerciseId) }))}</caption><thead><tr><th scope="col">${e(t('progress.date'))}</th><th scope="col">${e(t('progress.score'))}</th></tr></thead><tbody>${series.points
    .map(
      (p) =>
        `<tr><td>${e(formatDateTime(p.time))}</td><td>${formatNumber(p.score)}${p.partial ? ` (${e(t('vision.partialAnalysis'))})` : ''}</td></tr>`,
    )
    .join('')}</tbody></table>`;
  return `<section class="progress-card analysis-card" aria-labelledby="progress-title"><div class="section-title"><h2 id="progress-title">${e(t('progress.title'))}</h2><span class="micro">${e(name(series.exerciseId))}</span></div>${chips}<dl class="quick-verdict progress-stats">${tiles}</dl>${chart(series)}<p class="footnote">${e(note)} ${series.points.some((p) => p.partial) ? e(t('progress.partialNote')) : ''}</p>${table}</section>`;
}
