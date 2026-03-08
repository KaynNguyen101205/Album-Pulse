import { FEEDBACK_LOOP_CONFIG } from './config';
import { normalizeToken } from './feedback-weights';
import type {
  ActiveSuppressionRule,
  SuppressionIntent,
} from './types';

function toKey(intent: SuppressionIntent): string {
  return `${intent.targetType}:${normalizeToken(intent.targetValue)}`;
}

function weekOffsetDate(from: Date, weeks: number): Date {
  const date = new Date(from.getTime());
  date.setUTCDate(date.getUTCDate() + weeks * 7);
  return date;
}

export function collapseSuppressionIntents(
  intents: SuppressionIntent[],
  options?: { now?: Date }
): ActiveSuppressionRule[] {
  const now = options?.now ?? new Date();
  const map = new Map<string, ActiveSuppressionRule>();

  for (const intent of intents) {
    const targetValue = normalizeToken(intent.targetValue);
    if (!targetValue || intent.weeks <= 0) continue;

    const expiresAt = weekOffsetDate(now, intent.weeks);
    const key = toKey(intent);
    const existing = map.get(key);

    const candidate: ActiveSuppressionRule = {
      targetType: intent.targetType,
      targetValue,
      strength: Number(Math.max(0.05, intent.strength).toFixed(4)),
      reason: intent.reason,
      expiresAt,
    };

    if (!existing) {
      map.set(key, candidate);
      continue;
    }

    const useCandidate =
      candidate.expiresAt.getTime() > existing.expiresAt.getTime() ||
      candidate.strength > existing.strength;

    if (useCandidate) {
      map.set(key, candidate);
    }
  }

  return Array.from(map.values()).sort(
    (a, b) => b.expiresAt.getTime() - a.expiresAt.getTime()
  );
}

export function splitSuppressionByType(rules: ActiveSuppressionRule[]): {
  artists: Record<string, number>;
  tags: Record<string, number>;
  albums: Record<string, number>;
} {
  const artists: Record<string, number> = {};
  const tags: Record<string, number> = {};
  const albums: Record<string, number> = {};

  for (const rule of rules) {
    const key = normalizeToken(rule.targetValue);
    if (!key) continue;
    if (rule.targetType === 'ARTIST') artists[key] = rule.strength;
    else if (rule.targetType === 'TAG') tags[key] = rule.strength;
    else if (rule.targetType === 'ALBUM') albums[key] = rule.strength;
  }

  return { artists, tags, albums };
}

export function isRuleActive(rule: Pick<ActiveSuppressionRule, 'expiresAt'>, now = new Date()): boolean {
  return rule.expiresAt.getTime() >= now.getTime();
}

export function defaultSuppressionWeeks(targetType: 'ARTIST' | 'TAG' | 'ALBUM'): number {
  if (targetType === 'ARTIST') return FEEDBACK_LOOP_CONFIG.artistSuppressionWeeks;
  if (targetType === 'TAG') return FEEDBACK_LOOP_CONFIG.tagSuppressionWeeks;
  return FEEDBACK_LOOP_CONFIG.albumCooldownWeeks;
}
