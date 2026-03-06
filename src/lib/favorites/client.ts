export type FavoriteAlbum = {
  spotifyId: string;
  ten?: string;
  anhBiaUrl?: string | null;
};

type FavoritesResponse = {
  items?: Array<{
    spotifyId?: string;
    ten?: string;
    anhBiaUrl?: string | null;
  }>;
};

export type SaveFavoriteInput = {
  albumSpotifyId: string;
  title?: string | null;
  artistName?: string | null;
  releaseDate?: string | null;
  coverUrl?: string | null;
  spotifyUrl?: string | null;
};

export async function fetchFavorites(signal?: AbortSignal): Promise<FavoriteAlbum[]> {
  const response = await fetch('/api/favorites', {
    method: 'GET',
    cache: 'no-store',
    signal,
  });

  if (!response.ok) {
    throw new Error('Failed to fetch favorites');
  }

  const payload = (await response.json()) as FavoritesResponse;
  const rawItems = Array.isArray(payload?.items) ? payload.items : [];

  const favorites: FavoriteAlbum[] = [];

  for (const item of rawItems) {
    const spotifyId =
      typeof item.spotifyId === 'string' && item.spotifyId.trim() !== ''
        ? item.spotifyId.trim()
        : null;

    if (!spotifyId) continue;

    favorites.push({
      spotifyId,
      ten: typeof item.ten === 'string' && item.ten.trim() !== '' ? item.ten.trim() : undefined,
      anhBiaUrl:
        typeof item.anhBiaUrl === 'string' && item.anhBiaUrl.trim() !== ''
          ? item.anhBiaUrl.trim()
          : null,
    });
  }

  return favorites;
}

export async function saveFavorite(input: SaveFavoriteInput): Promise<void> {
  const albumSpotifyId =
    typeof input.albumSpotifyId === 'string' ? input.albumSpotifyId.trim() : '';

  if (!albumSpotifyId) {
    throw new Error('albumSpotifyId is required');
  }

  const response = await fetch('/api/favorites', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      albumSpotifyId,
      title: input.title ?? null,
      artistName: input.artistName ?? null,
      releaseDate: input.releaseDate ?? null,
      coverUrl: input.coverUrl ?? null,
      spotifyUrl: input.spotifyUrl ?? null,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to save favorite');
  }
}

export async function removeFavorite(albumSpotifyId: string): Promise<void> {
  const normalized = typeof albumSpotifyId === 'string' ? albumSpotifyId.trim() : '';
  if (!normalized) {
    throw new Error('albumSpotifyId is required');
  }

  const response = await fetch(
    `/api/favorites?albumSpotifyId=${encodeURIComponent(normalized)}`,
    { method: 'DELETE' }
  );

  if (!response.ok) {
    throw new Error('Failed to remove favorite');
  }
}
