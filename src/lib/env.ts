import 'server-only';

type RequiredEnvKey =
  | 'DATABASE_URL'
  | 'NEXTAUTH_URL'
  | 'NEXTAUTH_SECRET'
  | 'GOOGLE_CLIENT_ID'
  | 'GOOGLE_CLIENT_SECRET';

const requiredEnv: Record<RequiredEnvKey, string | undefined> = {
  DATABASE_URL: process.env.DATABASE_URL,
  NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
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
      'Set these in your local `.env` and in your Vercel project settings (Environment Variables).',
    ].join(' ')
  );
}

export const env = {
  DATABASE_URL: requiredEnv.DATABASE_URL as string,
  NEXTAUTH_URL: requiredEnv.NEXTAUTH_URL as string,
  NEXTAUTH_SECRET: requiredEnv.NEXTAUTH_SECRET as string,
  GOOGLE_CLIENT_ID: requiredEnv.GOOGLE_CLIENT_ID as string,
  GOOGLE_CLIENT_SECRET: requiredEnv.GOOGLE_CLIENT_SECRET as string,
} as const;

export type Env = typeof env;
