import styles from './LoadingSkeleton.module.css';

type LoadingSkeletonProps = {
  count?: number;
};

export default function LoadingSkeleton({ count = 9 }: LoadingSkeletonProps) {
  return (
    <section className={styles.grid} aria-label="Loading recommendations" aria-busy="true">
      {Array.from({ length: count }).map((_, index) => (
        <article className={styles.card} key={index}>
          <div className={styles.cover} />
          <div className={styles.lineLarge} />
          <div className={styles.lineMedium} />
          <div className={styles.lineSmall} />
        </article>
      ))}
    </section>
  );
}
