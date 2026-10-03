import { formatNumber, t, td } from '../i18n';
import type { MessageKey } from '../i18n/catalogs';
import {
  CHECK_NAMES,
  PHASE_NAMES,
  type CheckName,
  type PhaseName,
} from '../domain/lift-phases';
import type { Side } from '../domain/vision';

/**
 * Names that arrive from persisted data are keyed by their stored English
 * value rather than replaced. `services/vision-history.ts` validates saved
 * records against those exact strings, so swapping them for a translation when
 * the analysis is written would reject every existing record. Translating here,
 * at the point of display, keeps stored data valid in every language and lets a
 * translation change without a data migration.
 *
 * A value with no entry here is data this build does not recognise, so it is
 * shown as-is rather than silently replaced by some other label.
 */
const PHASE_LABELS: Record<PhaseName, MessageKey> = {
  Setup: 'phases.setup',
  'First pull': 'phases.firstPull',
  Transition: 'phases.transition',
  'Second pull': 'phases.secondPull',
  Turnover: 'phases.turnover',
  Catch: 'phases.catch',
  Recovery: 'phases.recovery',
};

const CHECK_LABELS: Record<CheckName, MessageKey> = {
  'Arms through the pull': 'checks.armsThroughPull',
  'Hip extension': 'checks.hipExtension',
  'Knee extension': 'checks.kneeExtension',
  'Front-rack arm flexion': 'checks.frontRackFlexion',
  'Receiving arm extension': 'checks.receivingArmExtension',
  'Standing recovery': 'checks.standingRecovery',
};

const CHECK_DETAIL_LABELS: Record<CheckName, MessageKey> = {
  'Arms through the pull': 'checkDetail.armsThroughPull',
  'Hip extension': 'checkDetail.hipExtension',
  'Knee extension': 'checkDetail.kneeExtension',
  'Front-rack arm flexion': 'checkDetail.frontRackFlexion',
  'Receiving arm extension': 'checkDetail.receivingArmExtension',
  'Standing recovery': 'checkDetail.standingRecovery',
};

const SIDE_LABELS: Record<Side, MessageKey> = {
  left: 'sides.left',
  right: 'sides.right',
};

const SEVERITY_LABELS: Record<string, MessageKey> = {
  moderate: 'severity.moderate',
  minor: 'severity.minor',
};

const JOINT_LABELS: Record<string, MessageKey> = {
  elbow: 'joints.elbow',
  hip: 'joints.hip',
  knee: 'joints.knee',
};

function byName(
  table: Record<string, MessageKey>,
  value: string,
  fallback: string,
): string {
  const key = table[value];
  return key ? t(key) : fallback;
}

export const phaseName = (name: string): string =>
  byName(PHASE_LABELS, name, name);

export const checkName = (name: string): string =>
  byName(CHECK_LABELS, name, name);

/** A saved record may predate its detail string; prefer the catalog. */
export const checkDetail = (name: string, fallback: string): string =>
  fallback.startsWith('Median elbow flexion')
    ? t('checkDetail.frontRackSustained')
    : fallback.startsWith('Median visible elbow angle')
      ? t('checkDetail.receivingSustained')
      : fallback.startsWith('Median knee angle')
        ? t('checkDetail.recoverySustained')
        : fallback.startsWith('Lowest three-sample median elbow angle')
          ? t('checkDetail.armsThroughPullSustained')
          : byName(CHECK_DETAIL_LABELS, name, fallback);

export const sideName = (side: string): string =>
  byName(SIDE_LABELS, side, side);

export const severityName = (value: string): string =>
  byName(SEVERITY_LABELS, value, value);

export const jointName = (joint: string): string =>
  byName(JOINT_LABELS, joint, joint);

export const eventKindName = (kind: string): string =>
  kind === 'hypothesis' ? t('vision.kindHypothesis') : t('vision.kindMeasured');

/**
 * Vision event titles are written into the saved record, so they are stored
 * English too and translated only when rendered.
 */
const EVENT_TITLE_KEYS: Record<string, MessageKey> = {
  'Greatest observed hip extension': 'eventTitles.hip',
  'Deepest observed knee flexion': 'eventTitles.knee',
  'Greatest observed elbow flexion': 'eventTitles.elbow',
  'Extended arm above shoulder': 'eventTitles.armAboveShoulder',
  'Possible arm bend before extension': 'eventTitles.armBend',
};

export const eventTitle = (title: string): string =>
  byName(EVENT_TITLE_KEYS, title, title);

/**
 * Rebuild a motion-event sentence in the active language from the numbers the
 * analysis measured. `detail` stays the fallback, so a record saved before this
 * build still shows its original English text rather than a broken template.
 */
const EVENT_DETAIL_KEYS: Record<string, MessageKey> = {
  extension: 'eventDetails.extension',
  'knee-flexion': 'eventDetails.knee-flexion',
  'elbow-flexion': 'eventDetails.elbow-flexion',
  overhead: 'eventDetails.overhead',
  'possible-early-bend': 'eventDetails.possible-early-bend',
};

export const eventDetail = (
  id: string,
  fallback: string,
  values: number[] = [],
): string => {
  const key = EVENT_DETAIL_KEYS[id];
  if (!key) return fallback;
  if (!values.length)
    return key === 'eventDetails.overhead' ? t(key) : fallback;
  const [angle = 0, ms = 0] = values;
  return t(key, { angle: formatNumber(angle, 0), ms: formatNumber(ms) });
};

/**
 * Re-render a phase's explanation in the active language. The stored
 * `evidence` is the English sentence the analysis produced; `evidenceKey` says
 * which catalog entry it came from, so a translation change is picked up
 * without re-running the analysis. Records saved before the key existed fall
 * back to the stored text.
 */
export const phaseEvidence = (phase: {
  evidence: string;
  evidenceKey?: string;
  partialEvidenceKey?: string;
}): string => {
  const main = phase.evidenceKey ? td(phase.evidenceKey) : phase.evidence;
  return phase.partialEvidenceKey
    ? `${main} ${td(phase.partialEvidenceKey)}`
    : main;
};

/**
 * Movement, exercise, drill, and observation names are keyed by their stable
 * id rather than replaced. Only phase and check names had to be protected for
 * validation, but keying all of them keeps one mechanism: the catalog can be
 * corrected or extended later without a data migration.
 */
const MOVEMENT_EN_NAMES: Record<string, string> = {
  snatch: 'Snatch',
  'power-snatch': 'Power Snatch',
  'hang-snatch': 'Hang Snatch',
  'high-hang-snatch': 'High-Hang Snatch',
  clean: 'Clean',
  'power-clean': 'Power Clean',
  'hang-clean': 'Hang Clean',
  'hang-power-clean': 'Hang Power Clean',
  'high-hang-clean': 'High-Hang Clean',
  'high-hang-power-clean': 'High-Hang Power Clean',
  'muscle-clean': 'Muscle Clean',
  jerk: 'Jerk',
  'clean-and-jerk': 'Clean & Jerk',
  'back-squat': 'Back Squat',
  'front-squat': 'Front Squat',
};

const DRILL_LABELS: Record<string, MessageKey> = {
  'snatch-pull': 'drills.snatch-pull',
  'tall-snatch': 'drills.tall-snatch',
  'high-hang-snatch': 'drills.high-hang-snatch',
};

const ISSUE_LABELS: Record<string, MessageKey> = {
  arms: 'issueNames.arms',
  drift: 'issueNames.drift',
  turnover: 'issueNames.turnover',
};

const ISSUE_TEXT_LABELS: Record<
  string,
  Record<'what' | 'why' | 'how', MessageKey>
> = {
  arms: {
    what: 'issueText.arms.what',
    why: 'issueText.arms.why',
    how: 'issueText.arms.how',
  },
  drift: {
    what: 'issueText.drift.what',
    why: 'issueText.drift.why',
    how: 'issueText.drift.how',
  },
  turnover: {
    what: 'issueText.turnover.what',
    why: 'issueText.turnover.why',
    how: 'issueText.turnover.how',
  },
};

/** Movement or exercise display name, from the id stored on the record. */
export const movementName = (id: string | undefined, fallback = ''): string =>
  id ? (MOVEMENT_EN_NAMES[id] ?? fallback) : fallback;

export const drillName = (id: string, fallback: string): string =>
  byName(DRILL_LABELS, id, fallback);

export const issueName = (id: string, fallback: string): string =>
  byName(ISSUE_LABELS, id, fallback);

const DRILL_TEXT_LABELS: Record<string, Record<string, MessageKey>> = {
  'snatch-pull': {
    instruction: 'drillText.snatch-pull.instruction',
    cue: 'drillText.snatch-pull.cue',
  },
  'tall-snatch': {
    instruction: 'drillText.tall-snatch.instruction',
    cue: 'drillText.tall-snatch.cue',
  },
  'high-hang-snatch': {
    instruction: 'drillText.high-hang-snatch.instruction',
    cue: 'drillText.high-hang-snatch.cue',
  },
};

export const drillText = (
  id: string,
  field: 'instruction' | 'cue',
  fallback: string,
): string => {
  const key = DRILL_TEXT_LABELS[id]?.[field];
  return key ? t(key) : fallback;
};

export const issueField = (
  id: string,
  field: 'what' | 'why' | 'how',
  fallback: string,
): string => {
  const key = ISSUE_TEXT_LABELS[id]?.[field];
  return key ? t(key) : fallback;
};

/**
 * The demo analysis ships a single hard-coded verdict and summary, so they are
 * recognised by their text. This is a fallback path: if a future demo uses
 * different wording it renders unchanged rather than showing the wrong sentence.
 */
type VerdictKey =
  | 'verdicts.insufficient'
  | 'verdicts.strong'
  | 'verdicts.good'
  | 'verdicts.consistency'
  | 'verdicts.refine';

const DEMO_VERDICT_KEYS: Record<string, VerdictKey> = {
  'More evidence needed': 'verdicts.insufficient',
  'Strong lift': 'verdicts.strong',
  'Good lift': 'verdicts.good',
  'Building consistency': 'verdicts.consistency',
  'Let\u2019s refine': 'verdicts.refine',
};

const DEMO_SUMMARY_KEYS: Record<string, MessageKey> = {
  'A strong foundation. Let\u2019s refine the details.': 'demoSummary.good',
};

export const demoVerdict = (verdict: string): VerdictKey =>
  DEMO_VERDICT_KEYS[verdict] ?? 'verdicts.good';

export const demoSummary = (summary: string): string => {
  const key = DEMO_SUMMARY_KEYS[summary];
  return key ? t(key) : summary;
};

/**
 * The illustrated demo carries its own metric labels and one-line readings, so
 * they are recognised by their English text and re-rendered in the active
 * language. Unknown wording passes through unchanged instead of being replaced
 * with the wrong sentence.
 */
const DEMO_METRIC_KEYS: Record<string, MessageKey> = {
  'Horizontal displacement': 'demoMetrics.horizontal',
  'Vertical displacement': 'demoMetrics.vertical',
  'Peak velocity': 'demoMetrics.peakVelocity',
};

const DEMO_MEASUREMENT_KEYS: Record<string, MessageKey> = {
  '153° elbow angle · 81% hip extension': 'demoMeasurements.arms',
  '6.4 cm horizontal displacement': 'demoMeasurements.drift',
  'Turnover phase · 76 / 100': 'demoMeasurements.turnover',
};

export const demoMetric = (label: string): string =>
  byName(DEMO_METRIC_KEYS, label, label);

export const demoMeasurement = (measurement: string): string =>
  byName(DEMO_MEASUREMENT_KEYS, measurement, measurement);

export { CHECK_NAMES, PHASE_NAMES };
export type { CheckName, PhaseName };
