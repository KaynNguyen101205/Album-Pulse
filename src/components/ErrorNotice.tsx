import styles from './ErrorNotice.module.css';

type ErrorNoticeProps = {
  message: string;
  onRetry: () => void | Promise<void>;
  retryLabel?: string;
  className?: string;
};

export default function ErrorNotice({
  message,
  onRetry,
  retryLabel = 'Retry',
  className,
}: ErrorNoticeProps) {
  const classNames = className ? `${styles.notice} ${className}` : styles.notice;

  return (
    <section className={classNames} role="alert">
      <p className={styles.message}>{message}</p>
      <button type="button" className={styles.retryButton} onClick={() => void onRetry()}>
        {retryLabel}
      </button>
    </section>
  );
}
