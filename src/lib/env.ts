import 'server-only';

type RequiredEnvKey = 'DATABASE_URL' | 'SPOTIFY_CLIENT_ID' | 'SPOTIFY_REDIRECT_URI';

const requiredEnv: Record<RequiredEnvKey, string | undefined> = {
  DATABASE_URL: process.env.DATABASE_URL,
  SPOTIFY_CLIENT_ID: process.env.SPOTIFY_CLIENT_ID,
  SPOTIFY_REDIRECT_URI: process.env.SPOTIFY_REDIRECT_URI,
};

const missingKeys = Object.entries(requiredEnv)
  .filter(([, value]) => !value)
  .map(([key]) => key as RequiredEnvKey);

if (missingKeys.length > 0) {
  throw new Error(
    [
      'Missing required environment variables:',
      missingKeys.join(', '),
      '',
      'Set these in your local `.env.local` and in your Vercel project settings (Environment Variables).',
    ].join(' '),
  );
}

export const env = {
  DATABASE_URL: requiredEnv.DATABASE_URL as string,
  SPOTIFY_CLIENT_ID: requiredEnv.SPOTIFY_CLIENT_ID as string,
  SPOTIFY_REDIRECT_URI: requiredEnv.SPOTIFY_REDIRECT_URI as string,

  // Optional, but commonly used on the server for the Authorization Code flow with refresh tokens.
  SPOTIFY_CLIENT_SECRET: process.env.SPOTIFY_CLIENT_SECRET,
} as const;

export type Env = typeof env;
