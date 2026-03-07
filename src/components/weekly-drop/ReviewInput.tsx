import styles from './ReviewInput.module.css';

type ReviewInputProps = {
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  onBlur?: () => void;
};

export default function ReviewInput({
  value,
  disabled = false,
  onChange,
  onBlur,
}: ReviewInputProps) {
  return (
    <label className={styles.wrap}>
      <span className={styles.label}>Review</span>
      <textarea
        className={styles.textarea}
        value={value}
        disabled={disabled}
        rows={3}
        maxLength={4000}
        placeholder="Write a short review..."
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
      />
    </label>
  );
}
