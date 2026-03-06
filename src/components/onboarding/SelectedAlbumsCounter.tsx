import styles from './SelectedAlbumsCounter.module.css';

type SelectedAlbumsCounterProps = {
  count: number;
  minimum: number;
};

export default function SelectedAlbumsCounter({ count, minimum }: SelectedAlbumsCounterProps) {
  const enough = count >= minimum;

  return (
    <section className={`${styles.counter} ${enough ? styles.ready : styles.pending}`}>
      <p className={styles.text}>
        Selected albums: <strong>{count}</strong> / {minimum}
      </p>
      {!enough ? <p className={styles.hint}>Pick at least {minimum} albums to continue.</p> : null}
    </section>
  );
}
