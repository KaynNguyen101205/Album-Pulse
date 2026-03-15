'use client';

import { useState, useEffect } from 'react';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import styles from '../page.module.css';

export default function LoginPage() {
  const searchParams = useSearchParams();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const callbackError = searchParams.get('error');
  useEffect(() => {
    if (callbackError === 'Callback') {
      setError(
        'Google sign-in failed. Ensure NEXTAUTH_URL is set to https://album-pulse.vercel.app in Vercel and that the Google redirect URI matches. Check Vercel Function logs for the real error.'
      );
    }
  }, [callbackError]);

  async function handleCredentialsSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); // clear so callback error doesn't persist
    setLoading(true);
    try {
      const res = await signIn('credentials', {
        identifier: identifier.trim(),
        password,
        redirect: false,
      });
      if (res?.error) {
        setError('Invalid email/username or password.');
        return;
      }
      if (res?.ok && res.url) {
        window.location.href = res.url;
        return;
      }
      window.location.href = '/dashboard';
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <h1 className={styles.title}>Sign in</h1>
        <p className={styles.subtitle}>
          Sign in with Google or use your email/username and password.
        </p>

        {error && (
          <p className={styles.errorMessage} role="alert">
            {error}
          </p>
        )}

        <button
          type="button"
          className={styles.cta}
          style={{ marginBottom: '1rem', width: '100%', border: 0, cursor: 'pointer' }}
          onClick={() => signIn('google', { callbackUrl: '/dashboard' })}
        >
          Continue with Google
        </button>

        <form onSubmit={handleCredentialsSubmit} style={{ textAlign: 'left', marginTop: '1rem' }}>
          <label htmlFor="identifier" style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 600 }}>
            Email or username
          </label>
          <input
            id="identifier"
            name="identifier"
            type="text"
            autoComplete="username"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            required
            style={{
              width: '100%',
              padding: '0.5rem 0.75rem',
              marginBottom: '1rem',
              border: '1px solid #d9e0ea',
              borderRadius: '0.5rem',
              boxSizing: 'border-box',
            }}
          />
          <label htmlFor="password" style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 600 }}>
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{
              width: '100%',
              padding: '0.5rem 0.75rem',
              marginBottom: '1rem',
              border: '1px solid #d9e0ea',
              borderRadius: '0.5rem',
              boxSizing: 'border-box',
            }}
          />
          <button
            type="submit"
            className={styles.cta}
            disabled={loading}
            style={{ width: '100%', border: 0, cursor: loading ? 'not-allowed' : 'pointer' }}
          >
            {loading ? 'Signing in…' : 'Sign in with password'}
          </button>
        </form>

        <p className={styles.privacy} style={{ marginTop: '1rem' }}>
          Don&apos;t have an account? <Link href="/register">Register</Link>
        </p>
      </section>
    </main>
  );
}
