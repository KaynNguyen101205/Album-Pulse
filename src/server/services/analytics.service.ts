import 'server-only';

import { randomUUID } from 'crypto';

import { prisma } from '@/lib/prisma';
import { getSessionUserId } from '@/lib/session';
import type { AnalyticsEventPayload } from '@/types/weekly-drop';

export class AnalyticsValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AnalyticsValidationError';
  }
}

export class AnalyticsAuthError extends Error {
  constructor(message = 'Not logged in.') {
    super(message);
    this.name = 'AnalyticsAuthError';
  }
}

function normalizeMetadata(value: unknown): Record<string, unknown> | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new AnalyticsValidationError('metadata must be an object.');
  }
  return value as Record<string, unknown>;
}

export async function createAnalyticsEvent(input: AnalyticsEventPayload): Promise<void> {
  const userId = await getSessionUserId();
  if (!userId) {
    throw new AnalyticsAuthError();
  }

  const eventName =
    typeof input.eventName === 'string' && input.eventName.trim() ? input.eventName.trim() : null;
  if (!eventName) {
    throw new AnalyticsValidationError('eventName is required.');
  }
  if (eventName.length > 120) {
    throw new AnalyticsValidationError('eventName is too long.');
  }

  const weeklyDropId =
    typeof input.weeklyDropId === 'string' && input.weeklyDropId.trim()
      ? input.weeklyDropId.trim()
      : null;
  const weeklyDropItemId =
    typeof input.weeklyDropItemId === 'string' && input.weeklyDropItemId.trim()
      ? input.weeklyDropItemId.trim()
      : null;
  const metadata = normalizeMetadata(input.metadata);

  await prisma.$executeRawUnsafe(
    `
    INSERT INTO "AnalyticsEvent" (
      "id",
      "eventName",
      "userId",
      "weeklyDropId",
      "weeklyDropItemId",
      "metadata",
      "createdAt"
    )
    VALUES ($1, $2, $3, $4, $5, $6::jsonb, NOW())
    `,
    randomUUID(),
    eventName,
    userId,
    weeklyDropId,
    weeklyDropItemId,
    metadata ? JSON.stringify(metadata) : null
  );
}
