'use client';

import { useEffect, useState } from 'react';

import { fetchFavorites, removeFavorite, type Favorite } from './favorites.api';
import styles from './page.module.css';

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
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const controller = new AbortController();

    async function loadFavorites() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const favorites = await fetchFavorites(controller.signal);
        setItems(favorites);
      } catch (error) {
        if ((error as Error).name === 'AbortError') return;
        setErrorMessage('Failed to load favorites');
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    loadFavorites();
    return () => controller.abort();
  }, []);

  async function handleRemove(id: string) {
    setRemovingIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });

    try {
      await removeFavorite(id);
      setItems((prev) => prev.filter((item) => item.id !== id));
    } catch (error) {
      console.error('Failed to remove favorite', error);
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

      {isLoading ? (
        <section className={styles.stateBox} aria-busy="true">
          Loading favorites...
        </section>
      ) : errorMessage ? (
        <section className={styles.errorBox} role="alert">
          Failed to load favorites
        </section>
      ) : items.length === 0 ? (
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
