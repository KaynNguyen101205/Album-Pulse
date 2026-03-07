import type { WeeklyDrop } from '@/types/weekly-drop';
import styles from './WeeklyDropHistoryDetail.module.css';

type WeeklyDropHistoryDetailProps = {
  drop: WeeklyDrop;
};

function formatWeek(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(parsed);
}

function summarizeReaction(input: {
  liked: boolean | null;
  disliked: boolean | null;
  skipped: boolean | null;
}): string {
  if (input.liked === true) return 'Liked';
  if (input.disliked === true) return 'Disliked';
  if (input.skipped === true) return 'Skipped';
  return 'No reaction';
}

export default function WeeklyDropHistoryDetail({ drop }: WeeklyDropHistoryDetailProps) {
  return (
    <section className={styles.wrap}>
      <header className={styles.header}>
        <h2 className={styles.title}>Week of {formatWeek(drop.weekStart)}</h2>
        <p className={styles.subtitle}>{drop.items.length} recommended albums</p>
      </header>

      <div className={styles.grid}>
        {drop.items.map((item) => (
          <article className={styles.card} key={item.id}>
            <div className={styles.coverWrap}>
              {item.album.coverUrl ? (
                <img
                  className={styles.cover}
                  src={item.album.coverUrl}
                  alt={`${item.album.title} cover`}
                  loading="lazy"
                />
              ) : (
                <div className={styles.coverFallback}>No Cover</div>
              )}
            </div>
            <div className={styles.body}>
              <h3 className={styles.albumTitle}>
                #{item.rank} {item.album.title}
              </h3>
              <p className={styles.artist}>{item.album.artistName}</p>
              <p className={styles.reason}>{item.whyRecommended}</p>
              <p className={styles.meta}>
                <span>{summarizeReaction(item.feedback)}</span>
                <span>• Rating: {item.feedback.rating ?? '—'}</span>
                <span>• Saved: {item.feedback.saved === true ? 'Yes' : 'No'}</span>
                <span>• Listened: {item.feedback.alreadyListened === true ? 'Yes' : 'No'}</span>
              </p>
              {item.feedback.reviewText ? (
                <p className={styles.notes}>Review: {item.feedback.reviewText}</p>
              ) : null}
              {item.feedback.listenedNotes ? (
                <p className={styles.notes}>Listened notes: {item.feedback.listenedNotes}</p>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
