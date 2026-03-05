import styles from './page.module.css';

const ERROR_MESSAGES: Record<string, string> = {
  FETCH_PROFILE_FAILED:
    "We couldn't load your Spotify profile. Please try again.",
  TOKEN_EXCHANGE_FAILED:
    "We couldn't complete sign-in with Spotify. Please try again.",
};

type HomePageProps = { searchParams: { error?: string } };

export default function HomePage({ searchParams }: HomePageProps) {
  const { error } = searchParams;
  const message = error ? ERROR_MESSAGES[error] ?? 'Something went wrong. Please try again.' : null;

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <h1 className={styles.title}>AlbumPulse</h1>
        <p className={styles.subtitle}>
          Discover album picks shaped by your Spotify listening habits.
        </p>

        {message && (
          <p className={styles.errorMessage} role="alert">
            {message}
          </p>
        )}

        <a className={styles.cta} href="/api/auth/login" aria-label="Continue with Spotify">
          {message ? 'Try again with Spotify' : 'Continue with Spotify'}
        </a>

        <p className={styles.privacy}>
          We store only minimal data needed to sign in and personalize recommendations.
        </p>
      </section>
    </main>
  );
}
