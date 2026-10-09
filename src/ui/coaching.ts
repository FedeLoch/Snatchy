import { features } from '../services/features';
import { coachingGroup } from '../domain/coaching';
import type { VisionAnalysis } from '../domain/vision';
import type { MovementCheck } from '../domain/lift-phases';
import { exerciseById } from '../domain/exercises';
import { t } from '../i18n';
import { escapeHtml as e } from './html';
export function coachingCard(
  a: VisionAnalysis,
  check: MovementCheck,
  canSeek: boolean,
): string {
  if (!features().ads)
    return `<div class="coaching-preview"><strong>${e(t('coaching.title'))}</strong><p>${e(t('coaching.offer'))}</p><a class="text-link" href="#settings">${e(t('coaching.enable'))} ↗</a></div>`;
  const group = coachingGroup(check.name);
  const family = exerciseById(a.exercise?.id ?? 'snatch')?.family ?? 'snatch';
  if (family === 'squat' || family === 'vertical-pull')
    return `<section class="coaching-preview"><h3>${e(t('coaching.title'))}</h3><p>${e(t(family === 'squat' ? 'strength.squatPractice' : 'strength.pullPractice'))}</p><p class="footnote">${e(t('strength.checkNote'))}</p></section>`;
  if (family === 'hinge' || family === 'row')
    return `<section class="coaching-preview"><h3>${e(t('coaching.title'))}</h3><p>${e(t(family === 'hinge' ? 'strength.hingePractice' : 'strength.rowPractice'))}</p><p class="footnote">${e(t('strength.checkNote'))}</p></section>`;
  return `<section class="coaching-preview" aria-label="${e(t('coaching.title'))}"><span class="tag">${e(t('coaching.preview'))}</span><h3>${e(t(`coaching.${group}`))}</h3><ul>${([1, 2] as const).map((n) => `<li>${e(t(`coaching.${family}${group}${n}`))}</li>`).join('')}</ul><p class="footnote">${e(t('coaching.caution'))}</p><button class="secondary" data-cv-time="${check.time}" data-coaching-check="${e(check.name)}" ${canSeek ? '' : 'disabled'}>${e(t('coaching.showVector'))}</button><p class="footnote">${e(t('coaching.vectorNote'))}</p><a class="text-link" href="https://www.catalystathletics.com/exercises/" target="_blank" rel="noopener noreferrer">${e(t('coaching.library'))} ↗</a></section>`;
}
