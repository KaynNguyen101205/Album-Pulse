import styles from './AlbumSearchInput.module.css';

type AlbumSearchInputProps = {
  value: string;
  onChange: (value: string) => void;
  isLoading?: boolean;
};

export default function AlbumSearchInput({
  value,
  onChange,
  isLoading = false,
}: AlbumSearchInputProps) {
  return (
    <label className={styles.wrap}>
      <span className={styles.label}>Search albums</span>
      <div className={styles.row}>
        <input
          className={styles.input}
          type="search"
          placeholder="Try: Random Access Memories"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <span className={styles.status} aria-live="polite">
          {isLoading ? 'Searching...' : ''}
        </span>
      </div>
    </label>
  );
}
