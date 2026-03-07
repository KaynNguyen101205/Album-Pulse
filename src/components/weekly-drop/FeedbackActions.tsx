import styles from './FeedbackActions.module.css';

type FeedbackActionsProps = {
  liked: boolean;
  disliked: boolean;
  saved: boolean;
  skipped: boolean;
  disabled?: boolean;
  onLike: () => void;
  onDislike: () => void;
  onSave: () => void;
  onSkip: () => void;
};

export default function FeedbackActions({
  liked,
  disliked,
  saved,
  skipped,
  disabled = false,
  onLike,
  onDislike,
  onSave,
  onSkip,
}: FeedbackActionsProps) {
  return (
    <div className={styles.actions}>
      <button
        type="button"
        className={`${styles.actionButton} ${liked ? styles.activePositive : ''}`}
        onClick={onLike}
        disabled={disabled}
        aria-pressed={liked}
      >
        Like
      </button>
      <button
        type="button"
        className={`${styles.actionButton} ${disliked ? styles.activeNegative : ''}`}
        onClick={onDislike}
        disabled={disabled}
        aria-pressed={disliked}
      >
        Dislike
      </button>
      <button
        type="button"
        className={`${styles.actionButton} ${saved ? styles.activeSaved : ''}`}
        onClick={onSave}
        disabled={disabled}
        aria-pressed={saved}
      >
        Save
      </button>
      <button
        type="button"
        className={`${styles.actionButton} ${skipped ? styles.activeNeutral : ''}`}
        onClick={onSkip}
        disabled={disabled}
        aria-pressed={skipped}
      >
        Skip
      </button>
    </div>
  );
}
