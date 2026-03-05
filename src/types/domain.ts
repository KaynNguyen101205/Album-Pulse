export type ArtistId = string;
export type AlbumId = string;

export type Artist = {
  id: ArtistId;
  name: string;
};

export type Album = {
  id: AlbumId;
  spotifyId: string;
  name: string;
  artistId: ArtistId;
  artistName: string;
  releaseDate: string; // ISO date string (YYYY-MM-DD)
  spotifyUrl?: string;
  images?: Array<{
    url: string;
    width?: number;
    height?: number;
  }>;
};

export type RecommendedAlbum = {
  album: Album;
  score: number;
  viTri: number;
  lyDo: string;
  reason: string;
};

