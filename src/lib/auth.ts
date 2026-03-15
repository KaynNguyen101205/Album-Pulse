import type { NextAuthOptions } from 'next-auth';
import type { Adapter } from 'next-auth/adapters';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { compare } from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { env } from '@/lib/env';

/** Wraps the adapter to log any error (e.g. in Vercel) so we see the real cause of error=Callback. */
function withAdapterErrorLogging(adapter: Adapter): Adapter {
  const wrap =
    <A extends unknown[], R>(name: string, fn: ((...args: A) => R) | undefined) =>
    (...args: A): Promise<R> => {
      if (!fn) throw new Error(`Adapter.${name} is not implemented`);
      return Promise.resolve(fn(...args)).catch((e: unknown) => {
        console.error('[NextAuth adapter]', name, e);
        throw e;
      });
    };

  return {
    ...adapter,
    createUser: adapter.createUser ? wrap('createUser', adapter.createUser) : undefined,
    linkAccount: adapter.linkAccount ? wrap('linkAccount', adapter.linkAccount) : undefined,
  };
}

export const authOptions: NextAuthOptions = {
  adapter: withAdapterErrorLogging(PrismaAdapter(prisma)),
  providers: [
    GoogleProvider({
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      // Link Google to existing user when email already exists (e.g. credentials signup).
      // Prevents "Another account already exists with the same e-mail" / error=Callback.
      allowDangerousEmailAccountLinking: true,
    }),
    CredentialsProvider({
      id: 'credentials',
      name: 'Email or username',
      credentials: {
        identifier: { label: 'Email or username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.identifier || !credentials?.password) return null;
        const identifier = credentials.identifier.trim().toLowerCase();
        const password = credentials.password;

        const isEmail = identifier.includes('@');
        const user = isEmail
          ? await prisma.user.findUnique({ where: { email: identifier }, include: { credential: true } })
          : await prisma.user.findFirst({
              where: { credential: { username: identifier } },
              include: { credential: true },
            });

        if (!user?.credential) return null;
        const valid = await compare(password, user.credential.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email ?? undefined,
          name: user.name ?? undefined,
          image: user.image ?? undefined,
        };
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60, // 24 hours
  },
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async redirect({ url, baseUrl }) {
      // Prefer canonical base URL from env so redirects work on Vercel (no wrong host).
      const canonicalBase = env.NEXTAUTH_URL.replace(/\/$/, '');
      const effectiveBase = canonicalBase || baseUrl;
      if (url.startsWith('/')) return `${effectiveBase}${url}`;
      try {
        if (new URL(url).origin === effectiveBase) return url;
      } catch {
        // ignore invalid URL
      }
      return effectiveBase;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  events: {
    async signIn({ user }) {
      void user;
    },
  },
  secret: env.NEXTAUTH_SECRET,
  // Surface OAuth callback errors in server logs (e.g. Vercel) instead of only redirecting with error=Callback
  logger: {
    error(code, metadata) {
      console.error('[NextAuth]', code, metadata);
    },
    warn(code) {
      console.warn('[NextAuth]', code);
    },
    debug(code, metadata) {
      if (process.env.NODE_ENV === 'development') {
        console.debug('[NextAuth]', code, metadata);
      }
    },
  },
};
