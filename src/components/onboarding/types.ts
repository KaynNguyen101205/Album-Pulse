export type OnboardingAlbumSource = 'search' | 'manual';

export type OnboardingAlbum = {
  id: string;
  albumSpotifyId: string;
  source: OnboardingAlbumSource;
  mbid: string | null;
  title: string;
  artistName: string;
  artistMbid: string | null;
  releaseYear: number | null;
  coverUrl: string | null;
  spotifyUrl: string | null;
};

export type SearchViewState = 'initial' | 'loading' | 'results' | 'empty' | 'error';
