import Link from 'next/link';
import styles from './page.module.css';

export default function HomePage() {
  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <h1 className={styles.title}>AlbumPulse</h1>
        <p className={styles.subtitle}>
          Discover album picks and weekly recommendations.
        </p>

        <Link className={styles.cta} href="/login" aria-label="Sign in">
          Sign in
        </Link>

        <p className={styles.privacy}>
          We store only minimal data needed to sign in and personalize recommendations.
        </p>
      </section>
    </main>
  );
}
