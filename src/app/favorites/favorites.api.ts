export type Favorite = {
  id: string;
  title: string;
};

type FavoritesGetItem = {
  spotifyId?: string;
  ten?: string;
  anhBiaUrl?: string | null;
};

type FavoritesGetResponse = {
  items?: FavoritesGetItem[];
};

export async function fetchFavorites(signal?: AbortSignal): Promise<Favorite[]> {
  const response = await fetch('/api/favorites', {
    method: 'GET',
    cache: 'no-store',
    signal,
  });

  if (!response.ok) {
    throw new Error('Failed to fetch favorites');
  }

  const payload = (await response.json()) as FavoritesGetResponse;
  const items = Array.isArray(payload?.items) ? payload.items : [];

  return items.map((item, index) => {
    const spotifyId =
      typeof item.spotifyId === 'string' && item.spotifyId.trim() !== ''
        ? item.spotifyId.trim()
        : `favorite-${index + 1}`;

    const title =
      typeof item.ten === 'string' && item.ten.trim() !== '' ? item.ten.trim() : spotifyId;

    return {
      id: spotifyId,
      title,
    };
  });
}

export async function removeFavorite(favoriteId: string): Promise<void> {
  const response = await fetch(
    `/api/favorites?albumSpotifyId=${encodeURIComponent(favoriteId)}`,
    { method: 'DELETE' }
  );

  if (!response.ok) {
    throw new Error('Failed to remove favorite');
  }
}
