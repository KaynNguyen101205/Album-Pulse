'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import styles from '../page.module.css';

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), username: username.trim().toLowerCase(), password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'Registration failed.');
        return;
      }
      router.push('/login');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <h1 className={styles.title}>Create account</h1>
        <p className={styles.subtitle}>
          Username: 3–20 characters, lowercase letters, numbers, and underscore only.
        </p>

        {error && (
          <p className={styles.errorMessage} role="alert">
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} style={{ textAlign: 'left', marginTop: '0.5rem' }}>
          <label htmlFor="email" style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 600 }}>
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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
          <label htmlFor="username" style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 600 }}>
            Username
          </label>
          <input
            id="username"
            name="username"
            type="text"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            pattern="[a-z0-9_]{3,20}"
            title="3–20 characters: lowercase letters, numbers, underscore"
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
            Password (min 8 characters)
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
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
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className={styles.privacy} style={{ marginTop: '1rem' }}>
          Already have an account? <Link href="/login">Sign in</Link>
        </p>
      </section>
    </main>
  );
}
