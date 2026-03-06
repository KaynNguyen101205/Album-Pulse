'use client';

import { useCallback, useEffect, useState } from 'react';

import ErrorNotice from '@/components/ErrorNotice';
import { fetchFavorites, removeFavorite } from '@/lib/favorites/client';
import styles from './page.module.css';

type Favorite = {
  id: string;
  title: string;
};

type FavoriteApiItems = Awaited<ReturnType<typeof fetchFavorites>>;
type FavoritesLoadState = 'loading' | 'success' | 'empty' | 'error';

function normalizeFavorites(items: FavoriteApiItems): Favorite[] {
  return items.map((item) => ({
    id: item.spotifyId,
    title: item.ten ?? item.spotifyId,
  }));
}

type FavoriteItemProps = {
  item: Favorite;
  onRemove: (id: string) => void;
  isRemoving?: boolean;
};

function FavoriteItem({ item, onRemove, isRemoving = false }: FavoriteItemProps) {
  return (
    <article className={styles.favoriteItem}>
      <h2 className={styles.favoriteTitle}>{item.title}</h2>
      <button
        type="button"
        className={styles.removeButton}
        onClick={() => onRemove(item.id)}
        disabled={isRemoving}
      >
        {isRemoving ? 'Removing...' : 'Remove'}
      </button>
    </article>
  );
}

export default function FavoritesPage() {
  const [items, setItems] = useState<Favorite[]>([]);
  const [loadState, setLoadState] = useState<FavoritesLoadState>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());

  const loadFavorites = useCallback(async () => {
    setLoadState('loading');
    setErrorMessage(null);

    try {
      const favorites = await fetchFavorites();
      const normalized = normalizeFavorites(favorites);
      setItems(normalized);
      setLoadState(normalized.length === 0 ? 'empty' : 'success');
    } catch (error) {
      setItems([]);
      setErrorMessage('Failed to load favorites');
      setLoadState('error');
    }
  }, []);

  useEffect(() => {
    void loadFavorites();
  }, [loadFavorites]);

  async function handleRemove(id: string) {
    setRemovingIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });

    try {
      await removeFavorite(id);
      setItems((prev) => {
        const next = prev.filter((item) => item.id !== id);
        setLoadState(next.length === 0 ? 'empty' : 'success');
        return next;
      });
    } catch (error) {
      setErrorMessage('Failed to load favorites');
      setLoadState('error');
    } finally {
      setRemovingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Favorites</h1>
      </header>

      {loadState === 'loading' ? (
        <section className={styles.stateBox} aria-busy="true">
          Loading favorites...
        </section>
      ) : loadState === 'error' ? (
        <ErrorNotice
          className={styles.errorWrap}
          message={errorMessage ?? 'Failed to load favorites'}
          onRetry={loadFavorites}
        />
      ) : loadState === 'empty' ? (
        <section className={styles.stateBox}>No favorites yet</section>
      ) : (
        <section className={styles.list} aria-live="polite">
          {items.map((item) => (
            <FavoriteItem
              key={item.id}
              item={item}
              onRemove={handleRemove}
              isRemoving={removingIds.has(item.id)}
            />
          ))}
        </section>
      )}
    </main>
  );
}
