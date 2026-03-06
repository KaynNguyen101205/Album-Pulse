import styles from './FilterBar.module.css';

export type TimeRangeFilter = 'short_term' | 'medium_term' | 'long_term';
export type SortFilter = 'score' | 'newest';

type FilterBarProps = {
  timeRange: TimeRangeFilter;
  sort: SortFilter;
  disabled?: boolean;
  onTimeRangeChange: (value: TimeRangeFilter) => void;
  onSortChange: (value: SortFilter) => void;
};

export default function FilterBar({
  timeRange,
  sort,
  disabled = false,
  onTimeRangeChange,
  onSortChange,
}: FilterBarProps) {
  return (
    <section className={styles.wrap} aria-label="Recommendations filters">
      <label className={styles.group}>
        <span className={styles.label}>Time Range</span>
        <select
          className={styles.select}
          value={timeRange}
          disabled={disabled}
          onChange={(event) => onTimeRangeChange(event.target.value as TimeRangeFilter)}
        >
          <option value="short_term">Last 4 weeks</option>
          <option value="medium_term">Last 6 months</option>
          <option value="long_term">All time</option>
        </select>
      </label>

      <label className={styles.group}>
        <span className={styles.label}>Sort</span>
        <select
          className={styles.select}
          value={sort}
          disabled={disabled}
          onChange={(event) => onSortChange(event.target.value as SortFilter)}
        >
          <option value="score">Top score</option>
          <option value="newest">Newest release</option>
        </select>
      </label>
    </section>
  );
}
