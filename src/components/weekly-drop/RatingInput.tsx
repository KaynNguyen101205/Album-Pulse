import styles from './RatingInput.module.css';

type RatingInputProps = {
  value: number | null;
  disabled?: boolean;
  onChange: (value: number) => void;
  onClear: () => void;
};

export default function RatingInput({
  value,
  disabled = false,
  onChange,
  onClear,
}: RatingInputProps) {
  return (
    <div className={styles.wrap}>
      <span className={styles.label}>Rate:</span>
      <div className={styles.buttons}>
        {[1, 2, 3, 4, 5].map((score) => (
          <button
            key={score}
            type="button"
            className={`${styles.button} ${value === score ? styles.active : ''}`}
            onClick={() => onChange(score)}
            disabled={disabled}
            aria-pressed={value === score}
          >
            {score}
          </button>
        ))}
      </div>
      <button
        type="button"
        className={styles.clear}
        onClick={onClear}
        disabled={disabled || value === null}
      >
        Clear
      </button>
    </div>
  );
}
