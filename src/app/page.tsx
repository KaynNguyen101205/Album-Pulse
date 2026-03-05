import styles from './page.module.css';

export default function HomePage() {
  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <h1 className={styles.title}>AlbumPulse</h1>
        <p className={styles.subtitle}>
          Discover album picks shaped by your Spotify listening habits.
        </p>

        <a className={styles.cta} href="/api/auth/login" aria-label="Continue with Spotify">
          Continue with Spotify
        </a>

        <p className={styles.privacy}>
          We store only minimal data needed to sign in and personalize recommendations.
        </p>
      </section>
    </main>
  );
}
