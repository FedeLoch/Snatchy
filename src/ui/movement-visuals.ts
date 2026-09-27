import { t } from '../i18n';
import { poseSvg, snatchBarPathSvg } from './pose';
type DemoRenderer = (
  time: number,
  overlay: boolean,
  highlight?: string,
) => string;
const renderers: Readonly<Record<string, DemoRenderer>> = { snatch: poseSvg };
export function movementVisual(
  movementId: string,
  time = 0,
  overlay = true,
  highlight?: string,
): string {
  const renderer = renderers[movementId];
  return renderer
    ? renderer(time, overlay, highlight)
    : `<div class="visual-placeholder">${t('movementMeta.noIllustrativeMotion')}</div>`;
}

export function movementBarPath(movementId: string): string {
  const renderers: Readonly<Record<string, () => string>> = {
    snatch: snatchBarPathSvg,
  };
  return (
    renderers[movementId]?.() ??
    `<p class="footnote">${t('movementMeta.noIllustrativeTrajectory')}</p>`
  );
}
