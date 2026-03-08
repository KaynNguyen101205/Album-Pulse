import type { NotInterestedReason } from '@/types/weekly-drop';
import styles from './NotInterestedInput.module.css';

type NotInterestedInputProps = {
  itemId: string;
  reason: NotInterestedReason | null;
  otherText: string;
  disabled?: boolean;
  onReasonChange: (reason: NotInterestedReason | null) => void;
  onOtherTextChange: (value: string) => void;
  onOtherTextBlur?: () => void;
};

const REASON_OPTIONS: Array<{ value: NotInterestedReason; label: string }> = [
  { value: 'NOT_MY_GENRE', label: 'Not my genre' },
  { value: 'DONT_LIKE_ARTIST', label: "Don't like this artist" },
  { value: 'ALREADY_KNOW_ALBUM', label: 'Already know this album' },
  { value: 'TOO_SIMILAR_RECENT', label: 'Too similar to recent picks' },
  { value: 'MOOD_MISMATCH', label: 'Mood mismatch' },
  { value: 'OTHER', label: 'Other' },
];

function parseReason(value: string): NotInterestedReason | null {
  if (
    value === 'NOT_MY_GENRE' ||
    value === 'DONT_LIKE_ARTIST' ||
    value === 'ALREADY_KNOW_ALBUM' ||
    value === 'TOO_SIMILAR_RECENT' ||
    value === 'MOOD_MISMATCH' ||
    value === 'OTHER'
  ) {
    return value;
  }
  return null;
}

export default function NotInterestedInput({
  itemId,
  reason,
  otherText,
  disabled = false,
  onReasonChange,
  onOtherTextChange,
  onOtherTextBlur,
}: NotInterestedInputProps) {
  const selectId = `not-interested-${itemId}`;

  return (
    <section className={styles.wrap}>
      <label className={styles.label} htmlFor={selectId}>
        Not interested reason (optional)
      </label>
      <select
        id={selectId}
        className={styles.select}
        value={reason ?? ''}
        disabled={disabled}
        onChange={(event) => onReasonChange(parseReason(event.target.value))}
      >
        <option value="">None</option>
        {REASON_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      {reason === 'OTHER' ? (
        <label className={styles.otherWrap}>
          <span className={styles.otherLabel}>Other reason</span>
          <textarea
            className={styles.otherInput}
            value={otherText}
            disabled={disabled}
            rows={2}
            maxLength={500}
            placeholder="Tell us what felt off..."
            onChange={(event) => onOtherTextChange(event.target.value)}
            onBlur={onOtherTextBlur}
          />
        </label>
      ) : null}
    </section>
  );
}
