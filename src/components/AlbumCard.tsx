'use client';

import { useEffect, useState } from 'react';

import { removeFavorite, saveFavorite } from '@/lib/favorites/client';
import styles from './AlbumCard.module.css';

type AlbumCardProps = {
  albumSpotifyId?: string | null;
  title: string;
  artistName: string;
  coverUrl?: string | null;
  releaseDate?: string | null;
  score: number;
  reason?: string | null;
  rank?: number | null;
  spotifyUrl?: string | null;
  initialIsFavorite?: boolean;
  enableFavoriteActions?: boolean;
  onFavoriteStateSync?: (albumSpotifyId: string, isFavorite: boolean) => void;
  onRequestFavoritesRefetch?: () => Promise<void>;
};

type FavoritePendingAction = 'save' | 'remove' | null;

function formatReleaseDate(value?: string | null): string {
  if (!value) return 'Unknown';

  if (/^\d{4}$/.test(value)) return value;

  if (/^\d{4}-\d{2}$/.test(value)) {
    const parsed = new Date(`${value}-01`);
    if (!Number.isNaN(parsed.getTime())) {
      return new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }).format(parsed);
    }
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }).format(parsed);
    }
  }

  return value;
}

export default function AlbumCard({
  albumSpotifyId,
  title,
  artistName,
  coverUrl,
  releaseDate,
  score,
  reason,
  rank,
  spotifyUrl,
  initialIsFavorite = false,
  enableFavoriteActions = false,
  onFavoriteStateSync,
  onRequestFavoritesRefetch,
}: AlbumCardProps) {
  const [isFavorite, setIsFavorite] = useState(Boolean(initialIsFavorite));
  const [favoritePendingAction, setFavoritePendingAction] = useState<FavoritePendingAction>(null);
  const [favoriteError, setFavoriteError] = useState<string | null>(null);

  useEffect(() => {
    setIsFavorite(Boolean(initialIsFavorite));
  }, [initialIsFavorite]);

  async function triggerFavoriteAction() {
    if (!albumSpotifyId || favoritePendingAction !== null) return;

    const previousValue = isFavorite;
    const nextValue = !isFavorite;
    const action: FavoritePendingAction = nextValue ? 'save' : 'remove';

    setFavoriteError(null);
    setFavoritePendingAction(action);
    setIsFavorite(nextValue);
    onFavoriteStateSync?.(albumSpotifyId, nextValue);

    try {
      if (action === 'save') {
        await saveFavorite({
          albumSpotifyId,
          title,
          artistName,
          releaseDate,
          coverUrl,
          spotifyUrl,
        });
      } else {
        await removeFavorite(albumSpotifyId);
      }
    } catch (error) {
      setIsFavorite(previousValue);
      onFavoriteStateSync?.(albumSpotifyId, previousValue);
      setFavoriteError(action === 'save' ? 'Failed to save favorite.' : 'Failed to remove favorite.');

      if (onRequestFavoritesRefetch) {
        try {
          await onRequestFavoritesRefetch();
        } catch (refetchError) {
          console.error('Failed to refetch favorites after favorite action error', refetchError);
        }
      }

      console.error('Favorite action failed', error);
    } finally {
      setFavoritePendingAction(null);
    }
  }

  const canRenderFavoriteAction = enableFavoriteActions && Boolean(albumSpotifyId);
  const favoriteButtonLabel =
    favoritePendingAction === 'save'
      ? 'Saving...'
      : favoritePendingAction === 'remove'
        ? 'Removing...'
        : isFavorite
          ? 'Remove'
          : 'Save';

  return (
    <article className={styles.card}>
      <div className={styles.coverWrap}>
        {coverUrl ? (
          <img className={styles.cover} src={coverUrl} alt={`${title} album cover`} loading="lazy" />
        ) : (
          <div className={styles.coverFallback}>No Cover</div>
        )}

        {typeof rank === 'number' && rank > 0 ? <span className={styles.rank}>#{rank}</span> : null}
      </div>

      <div className={styles.body}>
        <h3 className={styles.title}>{title}</h3>
        <p className={styles.artist}>{artistName || 'Unknown artist'}</p>
        <p className={styles.meta}>Released {formatReleaseDate(releaseDate)}</p>
        <p className={styles.meta}>Score {score.toFixed(1)}</p>
        {reason ? <p className={styles.reason}>{reason}</p> : null}

        {(spotifyUrl || canRenderFavoriteAction) ? (
          <div className={styles.actions}>
            {spotifyUrl ? (
              <a className={styles.link} href={spotifyUrl} target="_blank" rel="noreferrer">
                Open in Spotify
              </a>
            ) : (
              <span />
            )}

            {canRenderFavoriteAction ? (
              <button
                type="button"
                className={`${styles.favoriteActionButton} ${isFavorite ? styles.removeButton : styles.saveButton}`}
                onClick={triggerFavoriteAction}
                disabled={favoritePendingAction !== null}
              >
                {favoriteButtonLabel}
              </button>
            ) : null}
          </div>
        ) : null}

        {favoriteError ? (
          <p className={styles.actionError} role="alert">
            {favoriteError}
          </p>
        ) : null}
      </div>
    </article>
  );
}
