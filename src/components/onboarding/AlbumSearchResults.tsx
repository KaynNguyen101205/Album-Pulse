import ErrorNotice from '@/components/ErrorNotice';

import AlbumPreviewCard from './AlbumPreviewCard';
import type { OnboardingAlbum, SearchViewState } from './types';

import styles from './AlbumSearchResults.module.css';

type AlbumSearchResultsProps = {
  state: SearchViewState;
  results: OnboardingAlbum[];
  selectedAlbumIds: Set<string>;
  errorMessage?: string | null;
  onToggle: (album: OnboardingAlbum) => void;
  onRetry: () => void;
  emptyFallback?: React.ReactNode;
};

export default function AlbumSearchResults({
  state,
  results,
  selectedAlbumIds,
  errorMessage,
  onToggle,
  onRetry,
  emptyFallback,
}: AlbumSearchResultsProps) {
  if (state === 'initial') {
    return <section className={styles.stateBox}>Search for albums to start selecting favorites.</section>;
  }

  if (state === 'loading') {
    return <section className={styles.stateBox}>Loading search results...</section>;
  }

  if (state === 'error') {
    return (
      <ErrorNotice
        className={styles.errorWrap}
        message={errorMessage ?? 'Album search failed.'}
        onRetry={onRetry}
      />
    );
  }

  if (state === 'empty') {
    return (
      <section className={styles.stateBox}>
        <p className={styles.emptyText}>No results found for this query.</p>
        {emptyFallback}
      </section>
    );
  }

  return (
    <section className={styles.grid} aria-live="polite">
      {results.map((album) => (
        <AlbumPreviewCard
          key={album.id}
          album={album}
          isSelected={selectedAlbumIds.has(album.albumSpotifyId)}
          onToggle={onToggle}
        />
      ))}
    </section>
  );
}
