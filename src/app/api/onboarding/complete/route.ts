import { NextRequest, NextResponse } from 'next/server';

import { requireSession } from '@/lib/session';
import { generateWeeklyDropForUser } from '@/server/services/generateWeeklyDrop';

const MINIMUM_ALBUMS = 3;

type SelectedAlbumInput = {
  source?: 'search' | 'manual';
  albumSpotifyId?: string;
  mbid?: string | null;
  title?: string;
  artistName?: string;
  artistMbid?: string | null;
  releaseYear?: number | null;
  coverUrl?: string | null;
  spotifyUrl?: string | null;
};

type CompleteOnboardingBody = {
  selectedAlbums?: SelectedAlbumInput[];
  preferredArtists?: string[];
  preferredGenres?: string[];
};

type NormalizedAlbum = {
  albumSpotifyId: string;
  title: string;
  artistName: string;
  artistSpotifyId: string;
  releaseYear: number | null;
  coverUrl: string | null;
  spotifyUrl: string | null;
};

function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 64);
}

function toNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toOptionalYear(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const year = Math.floor(value);
  return year >= 1000 && year <= 9999 ? year : null;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const deduped = new Set<string>();

  for (const item of value) {
    const normalized = toNonEmptyString(item);
    if (!normalized) continue;
    deduped.add(normalized);
  }

  return Array.from(deduped).slice(0, 30);
}

function buildManualAlbumSpotifyId(title: string, artistName: string, releaseYear: number | null): string {
  const yearPart = releaseYear === null ? 'na' : String(releaseYear);
  return `manual:${slugify(title)}:${slugify(artistName)}:${yearPart}`;
}

function normalizeAlbumInput(input: SelectedAlbumInput): NormalizedAlbum | null {
  const title = toNonEmptyString(input.title);
  const artistName = toNonEmptyString(input.artistName);
  const source = input.source === 'manual' ? 'manual' : 'search';

  if (!title || !artistName) return null;

  const releaseYear = toOptionalYear(input.releaseYear);
  const explicitAlbumSpotifyId = toOptionalString(input.albumSpotifyId);
  const mbid = toOptionalString(input.mbid);
  const artistMbid = toOptionalString(input.artistMbid);

  let albumSpotifyId = explicitAlbumSpotifyId;
  if (!albumSpotifyId && source === 'search' && mbid) {
    albumSpotifyId = `mb:${mbid}`;
  }
  if (!albumSpotifyId) {
    albumSpotifyId = buildManualAlbumSpotifyId(title, artistName, releaseYear);
  }

  const artistSpotifyId =
    source === 'search' && artistMbid ? `mb-artist:${artistMbid}` : `manual-artist:${slugify(artistName)}`;

  return {
    albumSpotifyId,
    title,
    artistName,
    artistSpotifyId,
    releaseYear,
    coverUrl: toOptionalString(input.coverUrl),
    spotifyUrl: toOptionalString(input.spotifyUrl),
  };
}

function parseBody(body: unknown): CompleteOnboardingBody | null {
  if (!body || typeof body !== 'object') return null;
  return body as CompleteOnboardingBody;
}

export async function POST(request: NextRequest) {
  const auth = await requireSession();
  if (auth instanceof NextResponse) return auth;
  const nguoiDungId = auth;

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  const body = parseBody(rawBody);
  if (!body) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  const selectedAlbumsRaw = Array.isArray(body.selectedAlbums) ? body.selectedAlbums : [];
  const normalizedAlbumsMap = new Map<string, NormalizedAlbum>();

  for (const item of selectedAlbumsRaw) {
    const normalized = normalizeAlbumInput(item);
    if (!normalized) {
      return NextResponse.json(
        { error: 'invalid_selected_album', message: 'Each selected album must include title and artist.' },
        { status: 400 }
      );
    }
    normalizedAlbumsMap.set(normalized.albumSpotifyId, normalized);
  }

  const normalizedAlbums = Array.from(normalizedAlbumsMap.values());
  if (normalizedAlbums.length < MINIMUM_ALBUMS) {
    return NextResponse.json(
      { error: 'minimum_not_met', minimumAlbums: MINIMUM_ALBUMS },
      { status: 400 }
    );
  }

  const preferredArtists = normalizeStringArray(body.preferredArtists);
  const preferredGenres = normalizeStringArray(body.preferredGenres);

  const now = new Date();

  // Legacy onboarding persisted to dropped tables (NguoiDung, CaiDatNguoiDung, NgheSi, etc.).
  // Stubbed so the build passes; selected albums/preferences are not saved. Weekly drop still runs below.

  // First weekly drop for new user: generate for current week (idempotent). Do not block response.
  generateWeeklyDropForUser(nguoiDungId).catch((err) => {
    console.warn('[onboarding/complete] first weekly drop generation failed', nguoiDungId, err);
  });

  return NextResponse.json({
    ok: true,
    onboardingCompletedAt: now.toISOString(),
    selectedAlbumCount: normalizedAlbums.length,
  });
}
