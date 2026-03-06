import type { AlbumDTO } from '@/server/normalizers/albumNormalizer';

const MAX_DESC = 800;

export function buildAlbumText(album: AlbumDTO): string {
  const year = album.releaseYear ?? 'unknown';
  const tags = (album.tags ?? []).map((t) => t.toLowerCase()).join(', ');
  const descRaw = (album.description ?? '').replace(/\s+/g, ' ').trim();
  const description =
    descRaw.length > MAX_DESC ? descRaw.slice(0, MAX_DESC) + '…' : descRaw || 'n/a';

  return [
    `Title: ${album.title}`,
    `Artist: ${album.artistName}`,
    `Year: ${year}`,
    `Tags: ${tags || 'none'}`,
    `Description: ${description}`,
  ].join('\n');
}