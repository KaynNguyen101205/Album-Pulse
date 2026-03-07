import type { WeeklyDropHistoryEntry } from '@/types/weekly-drop';
import styles from './WeeklyDropHistoryList.module.css';

type WeeklyDropHistoryListProps = {
  entries: WeeklyDropHistoryEntry[];
  selectedDropId: string | null;
  hasMore: boolean;
  isLoadingMore: boolean;
  onSelectDrop: (dropId: string) => void;
  onLoadMore: () => void;
};

function formatWeek(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(
    parsed
  );
}

export default function WeeklyDropHistoryList({
  entries,
  selectedDropId,
  hasMore,
  isLoadingMore,
  onSelectDrop,
  onLoadMore,
}: WeeklyDropHistoryListProps) {
  return (
    <aside className={styles.wrap}>
      <h2 className={styles.title}>Past Drops</h2>
      <ul className={styles.list}>
        {entries.map((entry) => (
          <li key={entry.id}>
            <button
              type="button"
              className={`${styles.entryButton} ${selectedDropId === entry.id ? styles.active : ''}`}
              onClick={() => onSelectDrop(entry.id)}
            >
              <span className={styles.weekLabel}>Week of {formatWeek(entry.weekStart)}</span>
              <span className={styles.meta}>{entry.itemCount} albums</span>
            </button>
          </li>
        ))}
      </ul>

      {hasMore ? (
        <button
          type="button"
          className={styles.loadMore}
          disabled={isLoadingMore}
          onClick={onLoadMore}
        >
          {isLoadingMore ? 'Loading...' : 'Load more'}
        </button>
      ) : null}
    </aside>
  );
}
