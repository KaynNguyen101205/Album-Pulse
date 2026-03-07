import Image from 'next/image';

import type { OnboardingAlbum } from './types';

import styles from './AlbumPreviewCard.module.css';

type AlbumPreviewCardProps = {
  album: OnboardingAlbum;
  isSelected: boolean;
  onToggle: (album: OnboardingAlbum) => void;
};

export default function AlbumPreviewCard({
  album,
  isSelected,
  onToggle,
}: AlbumPreviewCardProps) {
  return (
    <article className={styles.card}>
      <div className={styles.coverWrap}>
        {album.coverUrl ? (
          <Image
            className={styles.cover}
            src={album.coverUrl}
            alt={`${album.title} cover`}
            width={256}
            height={256}
            unoptimized
          />
        ) : (
          <div className={styles.coverFallback}>No Cover</div>
        )}
      </div>

      <div className={styles.body}>
        <h3 className={styles.title}>{album.title}</h3>
        <p className={styles.meta}>{album.artistName || 'Unknown artist'}</p>
        <p className={styles.meta}>Year: {album.releaseYear ?? 'Unknown'}</p>

        <button
          type="button"
          className={`${styles.toggleButton} ${isSelected ? styles.removeMode : styles.addMode}`}
          onClick={() => onToggle(album)}
        >
          {isSelected ? 'Remove' : 'Add to favorites'}
        </button>
      </div>
    </article>
  );
}
