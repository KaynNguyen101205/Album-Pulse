import styles from './AlbumCard.module.css';

type AlbumCardProps = {
  title: string;
  artistName: string;
  coverUrl?: string | null;
  releaseDate?: string | null;
  score: number;
  reason?: string | null;
  rank?: number | null;
  spotifyUrl?: string | null;
};

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
  title,
  artistName,
  coverUrl,
  releaseDate,
  score,
  reason,
  rank,
  spotifyUrl,
}: AlbumCardProps) {
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

        {spotifyUrl ? (
          <a className={styles.link} href={spotifyUrl} target="_blank" rel="noreferrer">
            Open in Spotify
          </a>
        ) : null}
      </div>
    </article>
  );
}
