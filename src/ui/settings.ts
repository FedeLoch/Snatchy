import { t } from '../i18n';
import {
  LANGUAGE_OPTIONS,
  languageEndonym,
  type Language,
} from '../i18n/catalogs';
import { escapeHtml as e, icon } from './html';
import { APP_VERSION } from '../version';

export function settings(stored: Language | null, system: Language): string {
  const options = [
    `<option value="system" ${stored === null ? 'selected' : ''}>${e(
      t('settings.systemOption', { language: languageEndonym(system) }),
    )}</option>`,
    ...LANGUAGE_OPTIONS.map(
      (option) =>
        `<option value="${option.code}" ${stored === option.code ? 'selected' : ''}>${e(option.label)}</option>`,
    ),
  ].join('');
  return `<div class="narrow"><a href="#home" class="back">${icon('back')} ${e(t('settings.back'))}</a><div class="eyebrow">${e(t('settings.eyebrow'))}</div><h1>${e(t('settings.title'))}<span class="accent">.</span></h1><section class="settings-section"><h2>${e(t('settings.languageSection'))}</h2><div class="movement-field"><label for="language">${e(t('settings.languageLabel'))}</label><select id="language" aria-describedby="language-hint">${options}</select></div><p id="language-hint" class="field-hint">${e(t('settings.languageHint'))}</p></section><section class="settings-section"><h2>${e(t('settings.aboutTitle'))}</h2><p class="footnote">${e(t('settings.version', { version: APP_VERSION }))}</p><p>${e(t('settings.aboutBody'))}</p><p class="settings-privacy">${icon('shield')} ${e(t('settings.privacyNote'))}</p></section><section class="settings-section"><h2>${e(t('settings.authorTitle'))}</h2><p>${e(t('settings.authorBody'))}</p><a class="text-link" href="https://github.com/FedeLoch" target="_blank" rel="noopener noreferrer">${e(t('settings.authorLink'))} ${icon('arrow')}</a></section><section class="settings-section settings-support"><h2>${e(t('settings.supportTitle'))}</h2><p>${e(t('settings.supportBody'))}</p><a class="primary" href="https://buymeacoffee.com/fedelochbaum" target="_blank" rel="noopener noreferrer">☕ ${e(t('settings.supportDonate'))}</a><a class="text-link" href="https://github.com/FedeLoch/Snatchy/issues" target="_blank" rel="noopener noreferrer">${e(t('settings.supportIssues'))} ${icon('arrow')}</a><p class="field-hint">${e(t('settings.supportIssuesHint'))}</p></section></div>`;
}
