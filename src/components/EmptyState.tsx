import styles from './EmptyState.module.css';

type EmptyStateProps = {
  title?: string;
  message: string;
};

export default function EmptyState({ title = 'No recommendations yet', message }: EmptyStateProps) {
  return (
    <section className={styles.box} role="status" aria-live="polite">
      <h2 className={styles.title}>{title}</h2>
      <p className={styles.message}>{message}</p>
    </section>
  );
}
