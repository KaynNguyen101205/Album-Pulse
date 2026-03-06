'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import ErrorNotice from '@/components/ErrorNotice';
import AlbumSearchInput from '@/components/onboarding/AlbumSearchInput';
import AlbumSearchResults from '@/components/onboarding/AlbumSearchResults';
import ArtistGenreStep from '@/components/onboarding/ArtistGenreStep';
import FinishOnboardingButton from '@/components/onboarding/FinishOnboardingButton';
import ManualAlbumEntryForm from '@/components/onboarding/ManualAlbumEntryForm';
import OnboardingLayout from '@/components/onboarding/OnboardingLayout';
import OnboardingProgress from '@/components/onboarding/OnboardingProgress';
import SelectedAlbumsCounter from '@/components/onboarding/SelectedAlbumsCounter';
import type { OnboardingAlbum, SearchViewState } from '@/components/onboarding/types';

import styles from './page.module.css';

const MINIMUM_ALBUMS = 3;
const TOTAL_STEPS = 2;

type OnboardingGateState = 'checking' | 'ready' | 'error';
type SaveState = 'idle' | 'saving' | 'error';

type OnboardingStatusResponse = {
  isComplete?: boolean;
  error?: string;
};

type SearchApiCandidate = {
  mbid?: string;
  title?: string;
  artistName?: string;
  artistMbid?: string | null;
  releaseYear?: number | null;
  coverUrl?: string | null;
};

type SearchApiResponse = {
  candidates?: SearchApiCandidate[];
  error?: {
    message?: string;
  };
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

function buildManualAlbumSpotifyId(title: string, artistName: string, releaseYear: number | null): string {
  const yearPart = releaseYear === null ? 'na' : String(releaseYear);
  return `manual:${slugify(title)}:${slugify(artistName)}:${yearPart}`;
}

function normalizeSearchCandidates(raw: SearchApiCandidate[]): OnboardingAlbum[] {
  const normalized: OnboardingAlbum[] = [];

  for (const candidate of raw) {
    const mbid =
      typeof candidate.mbid === 'string' && candidate.mbid.trim() !== ''
        ? candidate.mbid.trim()
        : null;
    const title =
      typeof candidate.title === 'string' && candidate.title.trim() !== ''
        ? candidate.title.trim()
        : null;
    const artistName =
      typeof candidate.artistName === 'string' && candidate.artistName.trim() !== ''
        ? candidate.artistName.trim()
        : null;

    if (!mbid || !title || !artistName) continue;

    normalized.push({
      id: `mb:${mbid}`,
      albumSpotifyId: `mb:${mbid}`,
      source: 'search',
      mbid,
      title,
      artistName,
      artistMbid:
        typeof candidate.artistMbid === 'string' && candidate.artistMbid.trim() !== ''
          ? candidate.artistMbid.trim()
          : null,
      releaseYear:
        typeof candidate.releaseYear === 'number' && Number.isFinite(candidate.releaseYear)
          ? Math.floor(candidate.releaseYear)
          : null,
      coverUrl:
        typeof candidate.coverUrl === 'string' && candidate.coverUrl.trim() !== ''
          ? candidate.coverUrl.trim()
          : null,
      spotifyUrl: null,
    });
  }

  return normalized;
}

export default function OnboardingPage() {
  const router = useRouter();

  const [gateState, setGateState] = useState<OnboardingGateState>('checking');
  const [gateError, setGateError] = useState<string | null>(null);

  const [currentStep, setCurrentStep] = useState(1);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [searchState, setSearchState] = useState<SearchViewState>('initial');
  const [searchResults, setSearchResults] = useState<OnboardingAlbum[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchRetryNonce, setSearchRetryNonce] = useState(0);

  const [selectedAlbums, setSelectedAlbums] = useState<OnboardingAlbum[]>([]);
  const [preferredArtists, setPreferredArtists] = useState<string[]>([]);
  const [preferredGenres, setPreferredGenres] = useState<string[]>([]);

  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);

  const selectedAlbumIds = useMemo(
    () => new Set(selectedAlbums.map((album) => album.albumSpotifyId)),
    [selectedAlbums]
  );

  const canContinue = selectedAlbums.length >= MINIMUM_ALBUMS;

  const checkStatus = useCallback(async () => {
    setGateState('checking');
    setGateError(null);

    try {
      const response = await fetch('/api/onboarding/status', { cache: 'no-store' });
      const payload = (await response.json()) as OnboardingStatusResponse;

      if (!response.ok) {
        throw new Error(payload?.error ?? 'Failed to load onboarding status.');
      }

      if (payload?.isComplete) {
        router.replace('/dashboard');
        return;
      }

      setGateState('ready');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load onboarding status.';
      setGateError(message);
      setGateState('error');
    }
  }, [router]);

  useEffect(() => {
    void checkStatus();
  }, [checkStatus]);

  useEffect(() => {
    if (gateState !== 'ready' || currentStep !== 1) return;

    const trimmed = query.trim();
    if (!trimmed) {
      setDebouncedQuery('');
      setSearchState('initial');
      setSearchResults([]);
      setSearchError(null);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setDebouncedQuery(trimmed);
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [query, gateState, currentStep]);

  useEffect(() => {
    if (gateState !== 'ready' || currentStep !== 1 || !debouncedQuery) return;

    const controller = new AbortController();

    async function runSearch() {
      setSearchState('loading');
      setSearchError(null);

      try {
        const response = await fetch(`/api/albums/search?q=${encodeURIComponent(debouncedQuery)}`, {
          cache: 'no-store',
          signal: controller.signal,
        });
        const payload = (await response.json()) as SearchApiResponse;

        if (!response.ok) {
          const message = payload?.error?.message ?? 'Album search failed.';
          throw new Error(message);
        }

        const normalized = normalizeSearchCandidates(Array.isArray(payload?.candidates) ? payload.candidates : []);
        setSearchResults(normalized);
        setSearchState(normalized.length > 0 ? 'results' : 'empty');
      } catch (error) {
        if ((error as Error).name === 'AbortError') return;
        const message = error instanceof Error ? error.message : 'Album search failed.';
        setSearchError(message);
        setSearchState('error');
      }
    }

    void runSearch();
    return () => controller.abort();
  }, [debouncedQuery, gateState, currentStep, searchRetryNonce]);

  function toggleSelectedAlbum(album: OnboardingAlbum) {
    setSelectedAlbums((prev) => {
      const exists = prev.some((item) => item.albumSpotifyId === album.albumSpotifyId);
      if (exists) {
        return prev.filter((item) => item.albumSpotifyId !== album.albumSpotifyId);
      }
      return [...prev, album];
    });
  }

  function addManualAlbum(input: Pick<OnboardingAlbum, 'title' | 'artistName' | 'releaseYear' | 'coverUrl'>) {
    const albumSpotifyId = buildManualAlbumSpotifyId(input.title, input.artistName, input.releaseYear);
    const manualAlbum: OnboardingAlbum = {
      id: albumSpotifyId,
      albumSpotifyId,
      source: 'manual',
      mbid: null,
      title: input.title,
      artistName: input.artistName,
      artistMbid: null,
      releaseYear: input.releaseYear,
      coverUrl: input.coverUrl,
      spotifyUrl: null,
    };

    setSelectedAlbums((prev) => {
      if (prev.some((item) => item.albumSpotifyId === manualAlbum.albumSpotifyId)) {
        return prev;
      }
      return [...prev, manualAlbum];
    });
  }

  async function finishOnboarding() {
    if (!canContinue || saveState === 'saving') return;

    setSaveState('saving');
    setSaveError(null);

    try {
      const response = await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          selectedAlbums: selectedAlbums.map((album) => ({
            source: album.source,
            albumSpotifyId: album.albumSpotifyId,
            mbid: album.mbid,
            title: album.title,
            artistName: album.artistName,
            artistMbid: album.artistMbid,
            releaseYear: album.releaseYear,
            coverUrl: album.coverUrl,
            spotifyUrl: album.spotifyUrl,
          })),
          preferredArtists,
          preferredGenres,
        }),
      });

      const payload = (await response.json()) as { error?: string; message?: string };

      if (!response.ok) {
        throw new Error(payload?.message ?? payload?.error ?? 'Failed to save onboarding preferences.');
      }

      router.replace('/dashboard');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to save onboarding preferences.';
      setSaveError(message);
      setSaveState('error');
    }
  }

  function retrySearch() {
    if (!debouncedQuery) return;
    setSearchRetryNonce((prev) => prev + 1);
  }

  if (gateState === 'checking') {
    return (
      <OnboardingLayout
        title="Set up your profile"
        subtitle="We're preparing your onboarding steps."
      >
        <section className={styles.loadingBox} aria-busy="true">
          Loading onboarding...
        </section>
      </OnboardingLayout>
    );
  }

  if (gateState === 'error') {
    return (
      <OnboardingLayout
        title="Set up your profile"
        subtitle="We couldn't verify your onboarding status."
      >
        <ErrorNotice message={gateError ?? 'Failed to load onboarding status.'} onRetry={checkStatus} />
      </OnboardingLayout>
    );
  }

  return (
    <OnboardingLayout
      title="Set up your music profile"
      subtitle="Pick at least three favorite albums, then optionally add artists or genres."
    >
      <OnboardingProgress currentStep={currentStep} totalSteps={TOTAL_STEPS} />

      {currentStep === 1 ? (
        <section className={styles.stepSection}>
          <AlbumSearchInput
            value={query}
            onChange={setQuery}
            isLoading={searchState === 'loading'}
          />

          <AlbumSearchResults
            state={searchState}
            results={searchResults}
            selectedAlbumIds={selectedAlbumIds}
            errorMessage={searchError}
            onToggle={toggleSelectedAlbum}
            onRetry={retrySearch}
            emptyFallback={<ManualAlbumEntryForm onAdd={addManualAlbum} />}
          />

          <SelectedAlbumsCounter count={selectedAlbums.length} minimum={MINIMUM_ALBUMS} />

          {selectedAlbums.length > 0 ? (
            <section className={styles.selectedListWrap}>
              <h2 className={styles.selectedTitle}>Selected albums</h2>
              <ul className={styles.selectedList}>
                {selectedAlbums.map((album) => (
                  <li key={album.albumSpotifyId} className={styles.selectedItem}>
                    <div>
                      <p className={styles.selectedName}>{album.title}</p>
                      <p className={styles.selectedMeta}>
                        {album.artistName} · {album.releaseYear ?? 'Unknown year'}
                      </p>
                    </div>
                    <button
                      type="button"
                      className={styles.removeButton}
                      onClick={() => toggleSelectedAlbum(album)}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </section>
      ) : (
        <section className={styles.stepSection}>
          <ArtistGenreStep
            artists={preferredArtists}
            genres={preferredGenres}
            onArtistsChange={setPreferredArtists}
            onGenresChange={setPreferredGenres}
          />
          <p className={styles.optionalHint}>
            This step is optional. You can finish onboarding without adding any preferences.
          </p>
        </section>
      )}

      {saveState === 'error' ? (
        <ErrorNotice
          className={styles.saveError}
          message={saveError ?? 'Failed to save onboarding preferences.'}
          onRetry={finishOnboarding}
        />
      ) : null}

      <footer className={styles.footer}>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={() => setCurrentStep(1)}
          disabled={currentStep === 1 || saveState === 'saving'}
        >
          Back
        </button>

        {currentStep === 1 ? (
          <button
            type="button"
            className={styles.primaryButton}
            onClick={() => setCurrentStep(2)}
            disabled={!canContinue}
          >
            Next
          </button>
        ) : (
          <FinishOnboardingButton
            disabled={!canContinue}
            isSubmitting={saveState === 'saving'}
            onClick={finishOnboarding}
          />
        )}
      </footer>
    </OnboardingLayout>
  );
}
