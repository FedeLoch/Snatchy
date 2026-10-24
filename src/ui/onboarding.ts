import type { StoragePort } from '../services/history';
import { t } from '../i18n';
import { captureGuideSvg } from './capture-guide';
import { escapeHtml as e, icon } from './html';

export const ONBOARDING_KEY = 'snatchy-onboarding-v1';

/** Whether the quick-start guide was already finished or skipped. A blocked
 * store counts as done, so a visitor is never shown the guide on every load. */
export function onboardingDone(storage: StoragePort): boolean {
  try {
    return storage.getItem(ONBOARDING_KEY) === 'done';
  } catch {
    return true;
  }
}
export function markOnboardingDone(storage: StoragePort): void {
  try {
    storage.setItem(ONBOARDING_KEY, 'done');
  } catch {
    /* The guide simply shows again next time. */
  }
}

/** A lifter catching a snatch overhead, drawn as the tracked skeleton the
 * app overlays on real video. Illustration only. */
const welcomeArt = `<svg class="onboarding-art" viewBox="0 0 240 150" aria-hidden="true">
  <path class="figure-grid" d="M20 140H220" stroke-width="1"/>
  <path d="M52 34H188" class="onboarding-bar" stroke-width="4" stroke-linecap="round"/>
  <circle cx="50" cy="34" r="15" class="onboarding-plate" stroke-width="3"/>
  <circle cx="190" cy="34" r="15" class="onboarding-plate" stroke-width="3"/>
  <g class="figure-accent figure-accent-fill" stroke-width="3.5" stroke-linecap="round">
    <path d="M80 34 L96 58 L108 74 M160 34 L144 58 L132 74 M108 74 L132 74 M110 74 L112 104 M130 74 L128 104 M112 104 L92 112 L98 138 M128 104 L148 112 L142 138" fill="none"/>
    <circle cx="80" cy="34" r="4"/><circle cx="160" cy="34" r="4"/>
    <circle cx="96" cy="58" r="4"/><circle cx="144" cy="58" r="4"/>
    <circle cx="108" cy="74" r="4"/><circle cx="132" cy="74" r="4"/>
    <circle cx="112" cy="104" r="4"/><circle cx="128" cy="104" r="4"/>
    <circle cx="92" cy="112" r="4"/><circle cx="148" cy="112" r="4"/>
    <circle cx="98" cy="138" r="4"/><circle cx="142" cy="138" r="4"/>
  </g>
  <circle cx="120" cy="62" r="9" class="figure-skin-fill"/>
</svg>`;

const tiles = (items: [string, string][]) =>
  `<ul class="onboarding-tiles">${items
    .map(
      ([name, label]) =>
        `<li><span class="onboarding-tile-icon">${icon(name)}</span><span>${e(label)}</span></li>`,
    )
    .join('')}</ul>`;

interface Step {
  title: string;
  body: string;
  art: string;
}
function steps(): Step[] {
  return [
    {
      title: t('onboarding.welcomeTitle'),
      body: t('onboarding.welcomeBody'),
      art: welcomeArt,
    },
    {
      title: t('onboarding.filmTitle'),
      body: t('onboarding.filmBody'),
      art: captureGuideSvg(),
    },
    {
      title: t('onboarding.analyzeTitle'),
      body: t('onboarding.analyzeBody'),
      art: tiles([
        ['camera', t('onboarding.tileRecord')],
        ['eye', t('onboarding.tileTrack')],
        ['check', t('onboarding.tileResults')],
      ]),
    },
    {
      title: t('onboarding.resultsTitle'),
      body: t('onboarding.resultsBody'),
      art: tiles([
        ['play', t('onboarding.tilePhases')],
        ['check', t('onboarding.tileChecks')],
        ['arrowUp', t('onboarding.tileProgress')],
      ]),
    },
  ];
}

/** Opens the quick-start guide as a modal dialog. `onDismiss` runs the
 * moment the visitor finishes, skips or presses Escape, so the guide is
 * remembered as seen even if the page reloads straight away; `onClose` runs
 * once the dialog has closed and receives whether to start an analysis. */
export function showOnboarding(
  root: HTMLElement,
  onDismiss: () => void,
  onClose: (start: boolean) => void,
): HTMLDialogElement {
  const all = steps();
  let index = 0,
    start = false;
  const dialog = document.createElement('dialog');
  dialog.className = 'onboarding';
  dialog.setAttribute('aria-labelledby', 'onboarding-title');
  dialog.setAttribute('aria-describedby', 'onboarding-body');
  const render = () => {
    const step = all[index];
    const last = index === all.length - 1;
    dialog.innerHTML = `<button class="dialog-close" data-onboarding="skip" aria-label="${e(t('onboarding.skip'))}">${icon('close')}</button><div class="onboarding-visual">${step.art}</div><p class="eyebrow onboarding-count">${e(t('onboarding.stepOf', { n: index + 1, total: all.length }))}</p><h2 id="onboarding-title">${e(step.title)}</h2><p id="onboarding-body">${e(step.body)}</p><div class="onboarding-dots" aria-hidden="true">${all.map((_, i) => `<span class="${i === index ? 'active' : ''}"></span>`).join('')}</div><div class="onboarding-actions">${
      last
        ? `<button class="primary" data-onboarding="start">${e(t('onboarding.start'))} ${icon('arrow')}</button><button class="secondary" data-onboarding="finish">${e(t('onboarding.explore'))}</button>`
        : `<button class="primary" data-onboarding="next">${e(t('onboarding.next'))} ${icon('arrow')}</button>${index > 0 ? `<button class="secondary" data-onboarding="back">${e(t('onboarding.back'))}</button>` : `<button class="secondary" data-onboarding="skip">${e(t('onboarding.skip'))}</button>`}`
    }</div>`;
    dialog
      .querySelector<HTMLElement>(
        '[data-onboarding="next"],[data-onboarding="start"]',
      )
      ?.focus();
  };
  const go = (delta: number) => {
    const next = Math.max(0, Math.min(all.length - 1, index + delta));
    if (next === index) return;
    index = next;
    render();
  };
  dialog.addEventListener('click', (event) => {
    const action = (event.target as Element).closest<HTMLElement>(
      '[data-onboarding]',
    )?.dataset.onboarding;
    if (action === 'next') go(1);
    else if (action === 'back') go(-1);
    else if (action === 'start' || action === 'finish' || action === 'skip') {
      start = action === 'start';
      onDismiss();
      dialog.close();
    }
  });
  dialog.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowRight') go(1);
    else if (event.key === 'ArrowLeft') go(-1);
  });
  // Swipe between steps on touch screens.
  let touchX: number | null = null;
  dialog.addEventListener(
    'touchstart',
    (event) => (touchX = event.touches[0]?.clientX ?? null),
    { passive: true },
  );
  dialog.addEventListener('touchend', (event) => {
    const end = event.changedTouches[0]?.clientX;
    if (touchX !== null && end !== undefined && Math.abs(end - touchX) > 50)
      go(end < touchX ? 1 : -1);
    touchX = null;
  });
  dialog.addEventListener('cancel', () => onDismiss());
  dialog.addEventListener('close', () => {
    dialog.remove();
    onClose(start);
  });
  render();
  root.append(dialog);
  dialog.showModal();
  render();
  return dialog;
}
