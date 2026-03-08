import 'server-only';

import { randomUUID } from 'crypto';

import { prisma } from '@/lib/prisma';
import { getSessionUserId } from '@/lib/session';
import type {
  NotInterestedReason,
  WeeklyDrop,
  WeeklyDropFeedback,
  WeeklyDropFeedbackPatch,
  WeeklyDropHistoryPage,
  WeeklyDropItem,
} from '@/types/weekly-drop';

type DropRow = {
  id: string;
  weekStart: Date | string;
  status: 'ACTIVE' | 'EXPIRED';
};

type ItemRow = {
  itemId: string;
  weeklyDropId: string;
  rank: number;
  reasonJson: unknown;
  albumId: string;
  albumTitle: string;
  artistName: string;
  coverUrl: string | null;
  releaseYear: number | null;
  tags: string[] | null;
  liked: boolean | null;
  disliked: boolean | null;
  skipped: boolean | null;
  savedValue: boolean | null;
  rating: number | null;
  reviewText: string | null;
  alreadyListened: boolean | null;
  listenedNotes: string | null;
  notInterestedReason: NotInterestedReason | null;
  notInterestedOtherText: string | null;
  feedbackUpdatedAt: Date | null;
};

type FeedbackRow = {
  liked: boolean | null;
  disliked: boolean | null;
  skipped: boolean | null;
  saved: boolean | null;
  rating: number | null;
  reviewText: string | null;
  alreadyListened: boolean | null;
  listenedNotes: string | null;
  notInterestedReason: NotInterestedReason | null;
  notInterestedOtherText: string | null;
  updatedAt: Date | null;
};

type ItemContextRow = {
  itemId: string;
  weeklyDropId: string;
  albumId: string;
  weekStart: Date | string;
};

type HistoryRow = {
  id: string;
  weekStart: Date | string;
  status: 'ACTIVE' | 'EXPIRED';
  itemCount: number;
};

export class NotLoggedInError extends Error {
  constructor(message = 'Not logged in.') {
    super(message);
    this.name = 'NotLoggedInError';
  }
}

export class WeeklyDropNotFoundError extends Error {
  constructor(message = 'Weekly drop not found.') {
    super(message);
    this.name = 'WeeklyDropNotFoundError';
  }
}

export class WeeklyDropItemNotFoundError extends Error {
  constructor(message = 'Weekly drop item not found.') {
    super(message);
    this.name = 'WeeklyDropItemNotFoundError';
  }
}

export class FeedbackValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FeedbackValidationError';
  }
}

export class FeedbackLockedError extends Error {
  constructor(message = 'Can only update feedback for the current week.') {
    super(message);
    this.name = 'FeedbackLockedError';
  }
}

function toDateOnlyString(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getLocalIsoWeekStartDate(referenceDate = new Date()): Date {
  const local = new Date(referenceDate);
  local.setHours(0, 0, 0, 0);

  const day = local.getDay(); // 0 = Sunday, 1 = Monday, ...
  const daysSinceMonday = day === 0 ? 6 : day - 1;
  local.setDate(local.getDate() - daysSinceMonday);
  return local;
}

function encodeHistoryCursor(input: { weekStart: string; id: string }): string {
  return Buffer.from(JSON.stringify(input)).toString('base64url');
}

function decodeHistoryCursor(value: string): { weekStart: string; id: string } | null {
  if (!value || typeof value !== 'string') return null;
  try {
    const decoded = Buffer.from(value, 'base64url').toString('utf8');
    const parsed = JSON.parse(decoded) as { weekStart?: unknown; id?: unknown };
    if (typeof parsed.weekStart !== 'string' || typeof parsed.id !== 'string') return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(parsed.weekStart)) return null;
    if (!parsed.id.trim()) return null;
    return { weekStart: parsed.weekStart, id: parsed.id };
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeReason(reasonJson: unknown): string {
  if (typeof reasonJson === 'string' && reasonJson.trim()) return reasonJson.trim();
  if (Array.isArray(reasonJson)) {
    const text = reasonJson.filter((value) => typeof value === 'string').join(', ').trim();
    if (text) return text;
  }
  if (isRecord(reasonJson)) {
    const candidates = [
      reasonJson.reason,
      reasonJson.whyRecommended,
      reasonJson.explanation,
      reasonJson.text,
      reasonJson.summary,
    ];
    const text = candidates.find((value) => typeof value === 'string' && value.trim().length > 0);
    if (typeof text === 'string') return text.trim();
  }
  return 'Recommended for your weekly drop based on your listening profile.';
}

function normalizeFeedbackFromRow(row: ItemRow | FeedbackRow): WeeklyDropFeedback {
  const saved =
    'savedValue' in row ? row.savedValue : 'saved' in row ? row.saved : null;
  const updatedAt =
    'feedbackUpdatedAt' in row
      ? row.feedbackUpdatedAt
      : 'updatedAt' in row
        ? row.updatedAt
        : null;

  return {
    liked: row.liked ?? null,
    disliked: row.disliked ?? null,
    skipped: row.skipped ?? null,
    saved,
    rating: typeof row.rating === 'number' ? row.rating : null,
    reviewText: row.reviewText ?? null,
    alreadyListened: row.alreadyListened ?? null,
    listenedNotes: row.listenedNotes ?? null,
    notInterestedReason: row.notInterestedReason ?? null,
    notInterestedOtherText: row.notInterestedOtherText ?? null,
    updatedAt: updatedAt ? updatedAt.toISOString() : null,
  };
}

function parseBooleanPatch(value: unknown): boolean | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'boolean') throw new FeedbackValidationError('Boolean field is invalid.');
  return value;
}

function parseTextPatch(
  value: unknown,
  opts: { maxLength: number; fieldName: string }
): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') {
    throw new FeedbackValidationError(`${opts.fieldName} must be a string.`);
  }
  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.length > opts.maxLength) {
    throw new FeedbackValidationError(
      `${opts.fieldName} must be at most ${opts.maxLength} characters.`
    );
  }
  return normalized;
}

function parseNotInterestedReasonPatch(
  value: unknown
): NotInterestedReason | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (
    value === 'NOT_MY_GENRE' ||
    value === 'DONT_LIKE_ARTIST' ||
    value === 'ALREADY_KNOW_ALBUM' ||
    value === 'TOO_SIMILAR_RECENT' ||
    value === 'MOOD_MISMATCH' ||
    value === 'OTHER'
  ) {
    return value;
  }
  throw new FeedbackValidationError('Invalid notInterestedReason value.');
}

function parseRatingPatch(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new FeedbackValidationError('Rating must be a number from 1 to 5.');
  }
  const rating = Math.floor(value);
  if (rating < 1 || rating > 5) {
    throw new FeedbackValidationError('Rating must be a number from 1 to 5.');
  }
  return rating;
}

function enforceReactionExclusivity(
  state: WeeklyDropFeedback,
  changedKeys: Set<keyof WeeklyDropFeedback>
): WeeklyDropFeedback {
  const next = { ...state };

  if (next.liked === true && changedKeys.has('liked')) {
    next.disliked = false;
    next.skipped = false;
    return next;
  }

  if (next.disliked === true && changedKeys.has('disliked')) {
    next.liked = false;
    next.skipped = false;
    return next;
  }

  if (next.skipped === true && changedKeys.has('skipped')) {
    next.liked = false;
    next.disliked = false;
    return next;
  }

  const selected = [next.liked === true, next.disliked === true, next.skipped === true].filter(Boolean)
    .length;
  if (selected > 1) {
    throw new FeedbackValidationError('liked/disliked/skipped are mutually exclusive.');
  }
  return next;
}

type NormalizedPatch = {
  liked?: boolean | null;
  disliked?: boolean | null;
  skipped?: boolean | null;
  saved?: boolean | null;
  rating?: number | null;
  reviewText?: string | null;
  alreadyListened?: boolean | null;
  listenedNotes?: string | null;
  notInterestedReason?: NotInterestedReason | null;
  notInterestedOtherText?: string | null;
};

function normalizePatch(patch: WeeklyDropFeedbackPatch): NormalizedPatch {
  return {
    liked: parseBooleanPatch(patch.liked),
    disliked: parseBooleanPatch(patch.disliked),
    skipped: parseBooleanPatch(patch.skipped),
    saved: parseBooleanPatch(patch.saved),
    rating: parseRatingPatch(patch.rating),
    reviewText: parseTextPatch(patch.reviewText, {
      maxLength: 4000,
      fieldName: 'reviewText',
    }),
    alreadyListened: parseBooleanPatch(patch.alreadyListened),
    listenedNotes: parseTextPatch(patch.listenedNotes, {
      maxLength: 2000,
      fieldName: 'listenedNotes',
    }),
    notInterestedReason: parseNotInterestedReasonPatch(patch.notInterestedReason),
    notInterestedOtherText: parseTextPatch(patch.notInterestedOtherText, {
      maxLength: 500,
      fieldName: 'notInterestedOtherText',
    }),
  };
}

export function mergeFeedbackState(
  current: WeeklyDropFeedback,
  patch: WeeklyDropFeedbackPatch
): { next: WeeklyDropFeedback; changedKeys: Set<keyof WeeklyDropFeedback> } {
  const normalized = normalizePatch(patch);
  const next: WeeklyDropFeedback = { ...current };
  const changedKeys = new Set<keyof WeeklyDropFeedback>();

  (Object.keys(normalized) as Array<keyof NormalizedPatch>).forEach((key) => {
    const value = normalized[key];
    if (value === undefined) return;
    const feedbackKey = key as keyof WeeklyDropFeedback;
    if (next[feedbackKey] !== value) {
      (next as Record<string, unknown>)[feedbackKey] = value;
      changedKeys.add(feedbackKey);
    }
  });

  const normalizedNext = enforceReactionExclusivity(next, changedKeys);
  if (normalizedNext.liked !== next.liked) changedKeys.add('liked');
  if (normalizedNext.disliked !== next.disliked) changedKeys.add('disliked');
  if (normalizedNext.skipped !== next.skipped) changedKeys.add('skipped');

  if (normalizedNext.alreadyListened === false) {
    if (normalizedNext.listenedNotes !== null) changedKeys.add('listenedNotes');
    normalizedNext.listenedNotes = null;
  }

  if (normalizedNext.notInterestedReason !== 'OTHER') {
    if (normalizedNext.notInterestedOtherText !== null) {
      changedKeys.add('notInterestedOtherText');
    }
    normalizedNext.notInterestedOtherText = null;
  }

  return { next: normalizedNext, changedKeys };
}

async function requireUserId(): Promise<string> {
  const userId = await getSessionUserId();
  if (!userId) throw new NotLoggedInError();
  return userId;
}

function mapItems(rows: ItemRow[]): WeeklyDropItem[] {
  return rows.map((row) => ({
    id: row.itemId,
    rank: row.rank,
    whyRecommended: normalizeReason(row.reasonJson),
    weeklyDropId: row.weeklyDropId,
    album: {
      id: row.albumId,
      title: row.albumTitle,
      artistName: row.artistName,
      coverUrl: row.coverUrl,
      releaseYear: row.releaseYear,
      tags: Array.isArray(row.tags) ? row.tags.filter((tag) => typeof tag === 'string') : [],
    },
    feedback: normalizeFeedbackFromRow(row),
  }));
}

async function fetchDropItems(
  weeklyDropId: string,
  userId: string
): Promise<WeeklyDropItem[]> {
  const rows = await prisma.$queryRawUnsafe<ItemRow[]>(
    `
    SELECT
      wdi."id" AS "itemId",
      wdi."weeklyDropId" AS "weeklyDropId",
      wdi."rank" AS "rank",
      wdi."reason" AS "reasonJson",
      a."id" AS "albumId",
      a."title" AS "albumTitle",
      ar."name" AS "artistName",
      a."coverUrl" AS "coverUrl",
      a."releaseYear" AS "releaseYear",
      COALESCE(array_remove(array_agg(DISTINCT t."name"), NULL), '{}') AS "tags",
      wdf."liked" AS "liked",
      wdf."disliked" AS "disliked",
      wdf."skipped" AS "skipped",
      COALESCE(wdf."saved", CASE WHEN ufa."albumId" IS NOT NULL THEN TRUE ELSE NULL END) AS "savedValue",
      wdf."rating" AS "rating",
      wdf."reviewText" AS "reviewText",
      wdf."alreadyListened" AS "alreadyListened",
      wdf."listenedNotes" AS "listenedNotes",
      wdf."notInterestedReason" AS "notInterestedReason",
      wdf."notInterestedOtherText" AS "notInterestedOtherText",
      wdf."updatedAt" AS "feedbackUpdatedAt"
    FROM "WeeklyDropItem" wdi
    JOIN "Album" a ON a."id" = wdi."albumId"
    JOIN "Artist" ar ON ar."id" = a."artistId"
    LEFT JOIN "AlbumTag" at ON at."albumId" = a."id"
    LEFT JOIN "Tag" t ON t."id" = at."tagId"
    LEFT JOIN "WeeklyDropItemFeedback" wdf
      ON wdf."weeklyDropItemId" = wdi."id" AND wdf."userId" = $2
    LEFT JOIN "UserFavoriteAlbum" ufa
      ON ufa."userId" = $2 AND ufa."albumId" = a."id"
    WHERE wdi."weeklyDropId" = $1
    GROUP BY
      wdi."id",
      wdi."weeklyDropId",
      wdi."rank",
      wdi."reason",
      a."id",
      a."title",
      ar."name",
      a."coverUrl",
      a."releaseYear",
      wdf."liked",
      wdf."disliked",
      wdf."skipped",
      wdf."saved",
      wdf."rating",
      wdf."reviewText",
      wdf."alreadyListened",
      wdf."listenedNotes",
      wdf."notInterestedReason",
      wdf."notInterestedOtherText",
      wdf."updatedAt",
      ufa."albumId"
    ORDER BY wdi."rank" ASC, wdi."id" ASC
    `,
    weeklyDropId,
    userId
  );

  return mapItems(rows);
}

export async function getCurrentWeeklyDrop(): Promise<WeeklyDrop | null> {
  const userId = await requireUserId();
  const weekStart = toDateOnlyString(getLocalIsoWeekStartDate());

  const drops = await prisma.$queryRawUnsafe<DropRow[]>(
    `
    SELECT "id", "weekStart", "status"
    FROM "WeeklyDrop"
    WHERE "userId" = $1 AND "weekStart" = $2::date
    ORDER BY "createdAt" DESC, "id" DESC
    LIMIT 1
    `,
    userId,
    weekStart
  );

  const drop = drops[0];
  if (!drop) return null;

  const items = (await fetchDropItems(drop.id, userId)).slice(0, 5);
  if (items.length < 5) return null;

  return {
    id: drop.id,
    weekStart:
      drop.weekStart instanceof Date ? toDateOnlyString(drop.weekStart) : String(drop.weekStart),
    status: drop.status,
    items,
  };
}

async function getItemContext(itemId: string, userId: string): Promise<ItemContextRow | null> {
  const rows = await prisma.$queryRawUnsafe<ItemContextRow[]>(
    `
    SELECT
      wdi."id" AS "itemId",
      wdi."weeklyDropId" AS "weeklyDropId",
      wdi."albumId" AS "albumId",
      wd."weekStart" AS "weekStart"
    FROM "WeeklyDropItem" wdi
    JOIN "WeeklyDrop" wd ON wd."id" = wdi."weeklyDropId"
    WHERE wdi."id" = $1 AND wd."userId" = $2
    LIMIT 1
    `,
    itemId,
    userId
  );
  return rows[0] ?? null;
}

async function getExistingFeedback(
  weeklyDropItemId: string,
  userId: string
): Promise<WeeklyDropFeedback> {
  const rows = await prisma.$queryRawUnsafe<FeedbackRow[]>(
    `
    SELECT
      wdf."liked" AS "liked",
      wdf."disliked" AS "disliked",
      wdf."skipped" AS "skipped",
      wdf."saved" AS "saved",
      wdf."rating" AS "rating",
      wdf."reviewText" AS "reviewText",
      wdf."alreadyListened" AS "alreadyListened",
      wdf."listenedNotes" AS "listenedNotes",
      wdf."notInterestedReason" AS "notInterestedReason",
      wdf."notInterestedOtherText" AS "notInterestedOtherText",
      wdf."updatedAt" AS "updatedAt"
    FROM "WeeklyDropItemFeedback" wdf
    WHERE wdf."weeklyDropItemId" = $1 AND wdf."userId" = $2
    LIMIT 1
    `,
    weeklyDropItemId,
    userId
  );

  const row = rows[0];
  if (!row) {
    return {
      liked: null,
      disliked: null,
      skipped: null,
      saved: null,
      rating: null,
      reviewText: null,
      alreadyListened: null,
      listenedNotes: null,
      notInterestedReason: null,
      notInterestedOtherText: null,
      updatedAt: null,
    };
  }

  return normalizeFeedbackFromRow(row);
}

function metadataJson(input: Record<string, unknown>): string {
  return JSON.stringify(input);
}

type SqlClient = Pick<typeof prisma, '$executeRawUnsafe'>;

async function syncFavorite(
  tx: SqlClient,
  input: { userId: string; albumId: string; saved: boolean | null }
): Promise<void> {
  if (input.saved === true) {
    await tx.$executeRawUnsafe(
      `
      INSERT INTO "UserFavoriteAlbum" ("id", "userId", "albumId", "addedAt")
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT ("userId", "albumId") DO NOTHING
      `,
      randomUUID(),
      input.userId,
      input.albumId
    );
    return;
  }

  if (input.saved === false) {
    await tx.$executeRawUnsafe(
      `
      DELETE FROM "UserFavoriteAlbum"
      WHERE "userId" = $1 AND "albumId" = $2
      `,
      input.userId,
      input.albumId
    );
  }
}

async function appendUserEvents(
  tx: SqlClient,
  input: {
    userId: string;
    albumId: string;
    weeklyDropId: string;
    weeklyDropItemId: string;
    previous: WeeklyDropFeedback;
    next: WeeklyDropFeedback;
  }
): Promise<void> {
  const rows: Array<{ type: 'LIKE' | 'DISLIKE' | 'SKIP' | 'SAVE' | 'UNSAVE' }> = [];

  if (input.previous.liked !== true && input.next.liked === true) rows.push({ type: 'LIKE' });
  if (input.previous.disliked !== true && input.next.disliked === true) rows.push({ type: 'DISLIKE' });
  if (input.previous.skipped !== true && input.next.skipped === true) rows.push({ type: 'SKIP' });
  if (input.previous.saved !== true && input.next.saved === true) rows.push({ type: 'SAVE' });
  if (input.previous.saved === true && input.next.saved === false) rows.push({ type: 'UNSAVE' });

  if (rows.length === 0) return;

  for (const row of rows) {
    await tx.$executeRawUnsafe(
      `
      INSERT INTO "UserEvent" ("id", "userId", "albumId", "type", "metadata", "createdAt")
      VALUES ($1, $2, $3, $4, $5::jsonb, NOW())
      `,
      randomUUID(),
      input.userId,
      input.albumId,
      row.type,
      metadataJson({
        source: 'weekly_drop',
        weeklyDropId: input.weeklyDropId,
        weeklyDropItemId: input.weeklyDropItemId,
      })
    );
  }
}

export async function updateWeeklyDropItemFeedback(
  itemId: string,
  patch: WeeklyDropFeedbackPatch
): Promise<WeeklyDropFeedback> {
  const userId = await requireUserId();
  const context = await getItemContext(itemId, userId);
  if (!context) {
    throw new WeeklyDropItemNotFoundError();
  }

  const weekStart = toDateOnlyString(getLocalIsoWeekStartDate());
  const contextWeekStart =
    context.weekStart instanceof Date ? toDateOnlyString(context.weekStart) : String(context.weekStart);
  if (contextWeekStart !== weekStart) {
    throw new FeedbackLockedError();
  }

  const previous = await getExistingFeedback(itemId, userId);
  const merged = mergeFeedbackState(previous, patch);
  if (merged.changedKeys.size === 0) return previous;

  const now = new Date().toISOString();

  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `
      INSERT INTO "WeeklyDropItemFeedback" (
        "id",
        "userId",
        "weeklyDropItemId",
        "liked",
        "disliked",
        "skipped",
        "saved",
        "rating",
        "reviewText",
        "alreadyListened",
        "listenedNotes",
        "notInterestedReason",
        "notInterestedOtherText",
        "createdAt",
        "updatedAt"
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW()
      )
      ON CONFLICT ("userId", "weeklyDropItemId")
      DO UPDATE SET
        "liked" = EXCLUDED."liked",
        "disliked" = EXCLUDED."disliked",
        "skipped" = EXCLUDED."skipped",
        "saved" = EXCLUDED."saved",
        "rating" = EXCLUDED."rating",
        "reviewText" = EXCLUDED."reviewText",
        "alreadyListened" = EXCLUDED."alreadyListened",
        "listenedNotes" = EXCLUDED."listenedNotes",
        "notInterestedReason" = EXCLUDED."notInterestedReason",
        "notInterestedOtherText" = EXCLUDED."notInterestedOtherText",
        "updatedAt" = NOW()
      `,
      randomUUID(),
      userId,
      itemId,
      merged.next.liked,
      merged.next.disliked,
      merged.next.skipped,
      merged.next.saved,
      merged.next.rating,
      merged.next.reviewText,
      merged.next.alreadyListened,
      merged.next.listenedNotes,
      merged.next.notInterestedReason,
      merged.next.notInterestedOtherText
    );

    await syncFavorite(tx, {
      userId,
      albumId: context.albumId,
      saved: merged.next.saved,
    });

    await appendUserEvents(tx, {
      userId,
      albumId: context.albumId,
      weeklyDropId: context.weeklyDropId,
      weeklyDropItemId: itemId,
      previous,
      next: merged.next,
    });
  });

  return {
    ...merged.next,
    updatedAt: now,
  };
}

export async function getWeeklyDropHistory(
  input: { limit?: number; cursor?: string | null } = {}
): Promise<WeeklyDropHistoryPage> {
  const userId = await requireUserId();
  const currentWeekStart = toDateOnlyString(getLocalIsoWeekStartDate());
  const parsedCursor = input.cursor ? decodeHistoryCursor(input.cursor) : null;
  const rawLimit =
    typeof input.limit === 'number' && Number.isFinite(input.limit)
      ? Math.floor(input.limit)
      : 10;
  const limit = Math.max(1, Math.min(30, rawLimit));

  const rows = parsedCursor
    ? await prisma.$queryRawUnsafe<HistoryRow[]>(
        `
        SELECT
          wd."id" AS "id",
          wd."weekStart" AS "weekStart",
          wd."status" AS "status",
          COUNT(wdi."id")::int AS "itemCount"
        FROM "WeeklyDrop" wd
        LEFT JOIN "WeeklyDropItem" wdi ON wdi."weeklyDropId" = wd."id"
        WHERE
          wd."userId" = $1
          AND wd."weekStart" < $2::date
          AND (
            wd."weekStart" < $3::date
            OR (wd."weekStart" = $3::date AND wd."id" < $4)
          )
        GROUP BY wd."id", wd."weekStart", wd."status"
        ORDER BY wd."weekStart" DESC, wd."id" DESC
        LIMIT $5
        `,
        userId,
        currentWeekStart,
        parsedCursor.weekStart,
        parsedCursor.id,
        limit + 1
      )
    : await prisma.$queryRawUnsafe<HistoryRow[]>(
        `
        SELECT
          wd."id" AS "id",
          wd."weekStart" AS "weekStart",
          wd."status" AS "status",
          COUNT(wdi."id")::int AS "itemCount"
        FROM "WeeklyDrop" wd
        LEFT JOIN "WeeklyDropItem" wdi ON wdi."weeklyDropId" = wd."id"
        WHERE
          wd."userId" = $1
          AND wd."weekStart" < $2::date
        GROUP BY wd."id", wd."weekStart", wd."status"
        ORDER BY wd."weekStart" DESC, wd."id" DESC
        LIMIT $3
        `,
        userId,
        currentWeekStart,
        limit + 1
      );

  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const last = pageRows[pageRows.length - 1];

  return {
    entries: pageRows.map((row) => ({
      id: row.id,
      weekStart: row.weekStart instanceof Date ? toDateOnlyString(row.weekStart) : String(row.weekStart),
      status: row.status,
      itemCount: Number(row.itemCount) || 0,
    })),
    nextCursor:
      hasMore && last
        ? encodeHistoryCursor({
            weekStart: last.weekStart instanceof Date ? toDateOnlyString(last.weekStart) : String(last.weekStart),
            id: last.id,
          })
        : null,
  };
}

export async function getWeeklyDropHistoryDetail(dropId: string): Promise<WeeklyDrop> {
  const userId = await requireUserId();
  const currentWeekStart = toDateOnlyString(getLocalIsoWeekStartDate());

  const rows = await prisma.$queryRawUnsafe<DropRow[]>(
    `
    SELECT "id", "weekStart", "status"
    FROM "WeeklyDrop"
    WHERE "id" = $1 AND "userId" = $2 AND "weekStart" < $3::date
    LIMIT 1
    `,
    dropId,
    userId,
    currentWeekStart
  );

  const drop = rows[0];
  if (!drop) {
    throw new WeeklyDropNotFoundError();
  }

  const items = await fetchDropItems(drop.id, userId);

  return {
    id: drop.id,
    weekStart:
      drop.weekStart instanceof Date ? toDateOnlyString(drop.weekStart) : String(drop.weekStart),
    status: drop.status,
    items,
  };
}
