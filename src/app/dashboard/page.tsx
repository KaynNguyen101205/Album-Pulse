'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import Link from 'next/link';

import AlbumCard from '@/components/AlbumCard';
import EmptyState from '@/components/EmptyState';
import ErrorNotice from '@/components/ErrorNotice';
import FilterBar, { type SortFilter, type TimeRangeFilter } from '@/components/FilterBar';
import LoadingSkeleton from '@/components/LoadingSkeleton';
import { fetchFavorites as fetchFavoriteAlbums } from '@/lib/favorites/client';

import styles from './page.module.css';

type ApiAlbum = {
  id?: string;
  spotifyId?: string;
  name?: string;
  ten?: string;
  artistName?: string;
  releaseDate?: string;
  ngayPhatHanh?: string;
  spotifyUrl?: string | null;
  anhBiaUrl?: string | null;
  images?: Array<{ url?: string }>;
};

type ApiRecommendationItem = {
  score?: number;
  diem?: number;
  viTri?: number;
  lyDo?: string;
  reason?: string;
  album?: ApiAlbum;
};

type SuggestResponse = {
  ok?: boolean;
  dotGoiYId?: string;
  items?: ApiRecommendationItem[];
  hasFavorites?: boolean;
  error?: string;
  message?: string;
};

type DashboardItem = {
  id: string;
  albumSpotifyId: string | null;
  title: string;
  artistName: string;
  coverUrl: string | null;
  releaseDate: string | null;
  score: number;
  reason: string | null;
  rank: number | null;
  spotifyUrl: string | null;
};

type DashboardLoadState = 'loading' | 'success' | 'empty' | 'error';
type OnboardingGateState = 'checking' | 'allowed' | 'error';

function toNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function toStringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function parseReleaseTime(value: string | null): number {
  if (!value) return Number.NEGATIVE_INFINITY;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
}

function normalizeItems(items: ApiRecommendationItem[] | undefined): DashboardItem[] {
  if (!Array.isArray(items)) return [];

  return items.map((item, index) => {
    const album = item.album ?? {};
    const albumSpotifyId = toStringOrNull(album.spotifyId);
    const title = toStringOrNull(album.name) ?? toStringOrNull(album.ten) ?? 'Unknown album';
    const artistName = toStringOrNull(album.artistName) ?? 'Unknown artist';
    const coverFromImages = Array.isArray(album.images)
      ? toStringOrNull(album.images[0]?.url)
      : null;

    return {
      id: albumSpotifyId ?? toStringOrNull(album.id) ?? `recommendation-${index + 1}`,
      albumSpotifyId,
      title,
      artistName,
      coverUrl: coverFromImages ?? toStringOrNull(album.anhBiaUrl),
      releaseDate: toStringOrNull(album.releaseDate) ?? toStringOrNull(album.ngayPhatHanh),
      score: toNumber(item.score) ?? toNumber(item.diem) ?? 0,
      reason: toStringOrNull(item.lyDo) ?? toStringOrNull(item.reason),
      rank: toNumber(item.viTri),
      spotifyUrl: toStringOrNull(album.spotifyUrl),
    };
  });
}

function buildErrorMessage(status: number, payload: SuggestResponse | null): string {
  if (status === 401) return 'Your session expired. Please sign in again.';
  if (status === 400 && payload?.error === 'invalid_time_range') {
    return payload.message ?? 'Invalid time range filter.';
  }
  if (status === 429) return 'Too many requests. Please wait and try again.';
  return payload?.message ?? 'Could not load recommendations. Please try again.';
}

export default function DashboardPage() {
  const router = useRouter();
  const [timeRange, setTimeRange] = useState<TimeRangeFilter>('medium_term');
  const [sort, setSort] = useState<SortFilter>('score');
  const [items, setItems] = useState<DashboardItem[]>([]);
  const [dotGoiYId, setDotGoiYId] = useState<string | null>(null);
  const [loadState, setLoadState] = useState<DashboardLoadState>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const [favoriteSpotifyIds, setFavoriteSpotifyIds] = useState<Set<string>>(new Set());
  const [onboardingGateState, setOnboardingGateState] = useState<OnboardingGateState>('checking');
  const [onboardingGateError, setOnboardingGateError] = useState<string | null>(null);
  const [hasFavoritesFromSuggest, setHasFavoritesFromSuggest] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refreshFavorites = useCallback(async () => {
    try {
      const favorites = await fetchFavoriteAlbums();
      setFavoriteSpotifyIds(new Set(favorites.map((item) => item.spotifyId)));
    } catch (error) {
      console.error('Failed to refresh favorites', error);
    }
  }, []);

  const handleFavoriteStateSync = useCallback((albumSpotifyId: string, isFavorite: boolean) => {
    setFavoriteSpotifyIds((prev) => {
      const next = new Set(prev);
      if (isFavorite) {
        next.add(albumSpotifyId);
      } else {
        next.delete(albumSpotifyId);
      }
      return next;
    });
  }, []);

  const checkOnboardingStatus = useCallback(async () => {
    setOnboardingGateState('checking');
    setOnboardingGateError(null);
    try {
      const response = await fetch('/api/onboarding/status', { cache: 'no-store' });
      const payload = (await response.json()) as { isComplete?: boolean; error?: string };

      if (!response.ok) {
        throw new Error(payload?.error ?? 'Failed to verify onboarding state.');
      }

      if (!payload?.isComplete) {
        router.replace('/onboarding');
        return;
      }

      setOnboardingGateState('allowed');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to verify onboarding state.';
      setOnboardingGateError(message);
      setOnboardingGateState('error');
    }
  }, [router]);

  useEffect(() => {
    void checkOnboardingStatus();
  }, [checkOnboardingStatus]);

  useEffect(() => {
    if (onboardingGateState !== 'allowed') return;
    void refreshFavorites();
  }, [refreshFavorites, onboardingGateState]);

  const retryRecommendations = useCallback(() => {
    setRetryNonce((prev) => prev + 1);
  }, []);

  const [refreshError, setRefreshError] = useState<string | null>(null);

  const refreshRecommendations = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setRefreshError(null);
    try {
      const res = await fetch('/api/recommendations/refresh', { method: 'POST', cache: 'no-store' });
      const data = (await res.json()) as { ok?: boolean; generated?: boolean; error?: string; message?: string };
      retryRecommendations();
      if (!data.ok || data.error) {
        setRefreshError(data.message ?? data.error ?? 'Could not generate recommendations.');
      }
    } catch {
      setRefreshError('Request failed. Try again.');
      retryRecommendations();
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, retryRecommendations]);

  useEffect(() => {
    if (onboardingGateState !== 'allowed') return;

    const controller = new AbortController();

    async function loadRecommendations() {
      setLoadState('loading');
      setErrorMessage(null);

      try {
        const response = await fetch(`/api/albums/suggest?timeRange=${encodeURIComponent(timeRange)}`, {
          cache: 'no-store',
          signal: controller.signal,
        });

        let payload: SuggestResponse | null = null;
        try {
          payload = (await response.json()) as SuggestResponse;
        } catch {
          payload = null;
        }

        if (!response.ok) {
          throw new Error(buildErrorMessage(response.status, payload));
        }

        const normalized = normalizeItems(payload?.items);
        setItems(normalized);
        setDotGoiYId(toStringOrNull(payload?.dotGoiYId));
        setHasFavoritesFromSuggest(payload?.hasFavorites === true);
        setLoadState(normalized.length === 0 ? 'empty' : 'success');
        if (normalized.length > 0) setRefreshError(null);
      } catch (error) {
        if ((error as Error).name === 'AbortError') return;
        const message = error instanceof Error ? error.message : 'Failed to load recommendations.';
        setItems([]);
        setErrorMessage(message);
        setLoadState('error');
      }
    }

    loadRecommendations();
    return () => controller.abort();
  }, [timeRange, retryNonce, onboardingGateState]);

  const sortedItems = useMemo(() => {
    const sorted = [...items];

    sorted.sort((a, b) => {
      if (sort === 'score') {
        if (b.score !== a.score) return b.score - a.score;

        const rankA = typeof a.rank === 'number' ? a.rank : Number.MAX_SAFE_INTEGER;
        const rankB = typeof b.rank === 'number' ? b.rank : Number.MAX_SAFE_INTEGER;
        if (rankA !== rankB) return rankA - rankB;

        return a.title.localeCompare(b.title);
      }

      const releaseDiff = parseReleaseTime(b.releaseDate) - parseReleaseTime(a.releaseDate);
      if (releaseDiff !== 0) return releaseDiff;
      if (b.score !== a.score) return b.score - a.score;
      return a.title.localeCompare(b.title);
    });

    return sorted;
  }, [items, sort]);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Your Dashboard</h1>
        <p className={styles.subtitle}>
          Fresh album suggestions based on your favorite albums.
        </p>
        <nav className={styles.headerActions} aria-label="Dashboard actions">
          {onboardingGateState === 'allowed' && (
            <button
              type="button"
              className={styles.refreshButtonHeader}
              onClick={refreshRecommendations}
              disabled={isRefreshing}
            >
              {isRefreshing ? 'Refreshing…' : 'Refresh recommendations'}
            </button>
          )}
          <a className={styles.weeklyDropLink} href="/weekly-drop">
            View Weekly Drop
          </a>
        </nav>
        {dotGoiYId ? <p className={styles.runId}>Run: {dotGoiYId}</p> : null}
      </header>

      <FilterBar
        timeRange={timeRange}
        sort={sort}
        disabled={loadState === 'loading' || onboardingGateState !== 'allowed'}
        onTimeRangeChange={setTimeRange}
        onSortChange={setSort}
      />

      {refreshError && (
        <p className={styles.refreshError} role="alert">
          {refreshError}
          <button type="button" className={styles.refreshErrorDismiss} onClick={() => setRefreshError(null)} aria-label="Dismiss">×</button>
        </p>
      )}

      {onboardingGateState === 'checking' ? (
        <LoadingSkeleton count={6} />
      ) : onboardingGateState === 'error' ? (
        <ErrorNotice
          className={styles.errorWrap}
          message={onboardingGateError ?? 'Failed to verify onboarding state.'}
          onRetry={checkOnboardingStatus}
        />
      ) : loadState === 'loading' ? (
        <LoadingSkeleton count={9} />
      ) : loadState === 'error' ? (
        <ErrorNotice
          className={styles.errorWrap}
          message={errorMessage ?? 'Failed to load recommendations.'}
          onRetry={retryRecommendations}
        />
      ) : loadState === 'empty' ? (
        <section className={styles.emptyStateWrap}>
          <EmptyState
            title={hasFavoritesFromSuggest ? 'No recommendations yet' : 'No recommendations yet'}
            message={
              hasFavoritesFromSuggest
                ? "We have your favorite albums. Recommendations may still be generating, or add more favorites to improve suggestions. Check your Weekly Drop for this week's picks."
                : 'Complete onboarding or add favorite albums to get recommendations. Check your Weekly Drop for this week\'s picks.'
            }
          />
          {hasFavoritesFromSuggest && (
            <button
              type="button"
              className={styles.refreshButton}
              onClick={refreshRecommendations}
              disabled={isRefreshing}
            >
              {isRefreshing ? 'Refreshing…' : 'Refresh recommendations'}
            </button>
          )}
          <nav className={styles.emptyStateLinks} aria-label="Get started">
            {!hasFavoritesFromSuggest && (
              <Link href="/onboarding" className={styles.emptyStateLink}>
                Complete onboarding
              </Link>
            )}
            <Link href="/favorites/add" className={styles.emptyStateLink}>
              {hasFavoritesFromSuggest ? 'Add more favorite albums' : 'Add favorite albums'}
            </Link>
          </nav>
          <p className={styles.emptyStateSecondary}>
            <a className={styles.weeklyDropLinkSecondary} href="/weekly-drop">
              View Weekly Drop
            </a>
          </p>
        </section>
      ) : (
        <section className={styles.grid} aria-live="polite">
          {sortedItems.map((item) => (
            <AlbumCard
              key={item.id}
              albumSpotifyId={item.albumSpotifyId}
              title={item.title}
              artistName={item.artistName}
              coverUrl={item.coverUrl}
              releaseDate={item.releaseDate}
              score={item.score}
              reason={item.reason}
              rank={item.rank}
              spotifyUrl={item.spotifyUrl}
              initialIsFavorite={
                item.albumSpotifyId ? favoriteSpotifyIds.has(item.albumSpotifyId) : false
              }
              enableFavoriteActions={Boolean(item.albumSpotifyId)}
              onFavoriteStateSync={handleFavoriteStateSync}
              onRequestFavoritesRefetch={refreshFavorites}
            />
          ))}
        </section>
      )}
    </main>
  );
}
