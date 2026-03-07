import styles from './AlreadyListenedToggle.module.css';

type AlreadyListenedToggleProps = {
  checked: boolean;
  notes: string;
  disabled?: boolean;
  onToggle: (checked: boolean) => void;
  onNotesChange: (value: string) => void;
  onNotesBlur?: () => void;
};

export default function AlreadyListenedToggle({
  checked,
  notes,
  disabled = false,
  onToggle,
  onNotesChange,
  onNotesBlur,
}: AlreadyListenedToggleProps) {
  return (
    <section className={styles.wrap}>
      <label className={styles.toggleRow}>
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onToggle(event.target.checked)}
        />
        <span className={styles.label}>Already listened?</span>
      </label>

      {checked ? (
        <label className={styles.notesWrap}>
          <span className={styles.notesLabel}>Notes (optional)</span>
          <textarea
            className={styles.notesInput}
            value={notes}
            disabled={disabled}
            rows={2}
            maxLength={2000}
            placeholder="Any context about your previous listen..."
            onChange={(event) => onNotesChange(event.target.value)}
            onBlur={onNotesBlur}
          />
        </label>
      ) : null}
    </section>
  );
}
