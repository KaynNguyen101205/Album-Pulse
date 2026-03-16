'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useCallback, useEffect, useState } from 'react';

import ErrorNotice from '@/components/ErrorNotice';
import styles from './page.module.css';

type SearchCandidate = {
  mbid: string;
  title: string;
  artistName: string;
  artistMbid?: string | null;
  releaseYear?: number | null;
  coverUrl?: string | null;
};

type SearchState = 'idle' | 'loading' | 'results' | 'empty' | 'error';

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 350;

export default function AddFavoritesPage() {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [searchState, setSearchState] = useState<SearchState>('idle');
  const [results, setResults] = useState<SearchCandidate[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [favoriteMbids, setFavoriteMbids] = useState<Set<string>>(new Set());

  useEffect(() => {
    const ac = new AbortController();
    fetch('/api/favorites', { cache: 'no-store', signal: ac.signal })
      .then((res) => res.ok ? res.json() : Promise.reject(new Error('Failed to load')))
      .then((data: { items?: Array<{ spotifyId?: string }> }) => {
        const items = Array.isArray(data?.items) ? data.items : [];
        const mbids = new Set<string>();
        items.forEach((item) => {
          const id = item.spotifyId?.trim();
          if (id) {
            mbids.add(id);
            if (id.startsWith('mb:')) mbids.add(id.slice(3));
            else mbids.add(`mb:${id}`);
          }
        });
        setFavoriteMbids(mbids);
      })
      .catch(() => {});
    return () => ac.abort();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (debouncedQuery.length < MIN_QUERY_LENGTH) {
      setSearchState('idle');
      setResults([]);
      setSearchError(null);
      return;
    }

    const controller = new AbortController();
    setSearchState('loading');
    setSearchError(null);

    fetch(
      `/api/albums/search?q=${encodeURIComponent(debouncedQuery)}`,
      { signal: controller.signal }
    )
      .then((res) => res.json())
      .then((payload: { candidates?: SearchCandidate[]; error?: { message?: string } }) => {
        if (payload.error?.message) {
          setSearchError(payload.error.message);
          setSearchState('error');
          return;
        }
        const list = Array.isArray(payload.candidates) ? payload.candidates : [];
        setResults(list);
        setSearchState(list.length === 0 ? 'empty' : 'results');
      })
      .catch((err) => {
        if ((err as Error).name === 'AbortError') return;
        setSearchError(err instanceof Error ? err.message : 'Search failed.');
        setSearchState('error');
      });

    return () => controller.abort();
  }, [debouncedQuery]);

  const addToFavorites = useCallback(async (candidate: SearchCandidate) => {
    const key = `${candidate.mbid ?? ''}:${candidate.title}:${candidate.artistName}`;
    setAddingId(key);
    setAddError(null);
    try {
      const res = await fetch('/api/favorites/add-from-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mbid: candidate.mbid || undefined,
          title: candidate.title,
          artistName: candidate.artistName,
          artistMbid: candidate.artistMbid ?? undefined,
          releaseYear: candidate.releaseYear ?? undefined,
          coverUrl: candidate.coverUrl ?? undefined,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; added?: boolean; error?: string; message?: string };
      if (!res.ok) {
        throw new Error(data.message ?? data.error ?? 'Failed to add.');
      }
      if (candidate.mbid) {
        const raw = candidate.mbid.replace(/^mb:/, '');
        setFavoriteMbids((prev) => {
          const next = new Set(prev);
          next.add(candidate.mbid);
          next.add(raw);
          next.add(`mb:${raw}`);
          return next;
        });
      }
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to add to favorites.');
    } finally {
      setAddingId(null);
    }
  }, []);

  function isInFavorites(c: SearchCandidate): boolean {
    if (!c.mbid) return false;
    const raw = c.mbid.replace(/^mb:/, '');
    return favoriteMbids.has(c.mbid) || favoriteMbids.has(raw) || favoriteMbids.has(`mb:${raw}`);
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <nav className={styles.backLinks}>
          <Link href="/dashboard" className={styles.backLink}>
            ← Dashboard
          </Link>
          <Link href="/favorites" className={styles.backLink}>
            Favorites
          </Link>
        </nav>
        <h1 className={styles.title}>Add favorite albums</h1>
        <p className={styles.subtitle}>
          Search for albums and add them to your favorites. Use at least 2 characters.
        </p>
      </header>

      <div className={styles.searchWrap}>
        <label htmlFor="add-search" className={styles.label}>
          Search albums
        </label>
        <input
          id="add-search"
          type="search"
          className={styles.input}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Album or artist name..."
          autoComplete="off"
        />
      </div>

      {addError && (
        <ErrorNotice
          className={styles.errorWrap}
          message={addError}
          onRetry={() => setAddError(null)}
        />
      )}

      {searchState === 'loading' && (
        <p className={styles.stateText} aria-busy="true">
          Searching...
        </p>
      )}
      {searchState === 'empty' && debouncedQuery.length >= MIN_QUERY_LENGTH && (
        <p className={styles.stateText}>No albums found. Try a different search.</p>
      )}
      {searchState === 'error' && searchError && (
        <ErrorNotice
          className={styles.errorWrap}
          message={searchError}
          onRetry={() => setDebouncedQuery(debouncedQuery)}
        />
      )}
      {searchState === 'results' && (
        <ul className={styles.results} aria-live="polite">
          {results.map((c) => {
            const key = `${c.mbid ?? ''}:${c.title}:${c.artistName}`;
            const isAdding = addingId === key;
            const inFavorites = isInFavorites(c);
            return (
              <li key={key} className={styles.resultItem}>
                <div className={styles.resultInfo}>
                  {c.coverUrl && (
                    <Image
                      src={c.coverUrl}
                      alt=""
                      className={styles.cover}
                      width={48}
                      height={48}
                      unoptimized
                    />
                  )}
                  <div>
                    <span className={styles.resultTitle}>{c.title}</span>
                    <span className={styles.resultArtist}>{c.artistName}</span>
                    {c.releaseYear != null && (
                      <span className={styles.resultYear}> · {c.releaseYear}</span>
                    )}
                  </div>
                </div>
                {inFavorites ? (
                  <span className={styles.inFavoritesLabel} aria-label="Already in favorites">In favorites</span>
                ) : (
                  <button
                    type="button"
                    className={styles.addButton}
                    onClick={() => addToFavorites(c)}
                    disabled={isAdding}
                  >
                    {isAdding ? 'Adding...' : 'Add to favorites'}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
