import { NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const REGISTER_BODY = z.object({
  email: z.string().email('Invalid email').trim().toLowerCase(),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(20, 'Username must be at most 20 characters')
    .regex(/^[a-z0-9_]+$/, 'Username can only contain lowercase letters, numbers, and underscore')
    .transform((s) => s.trim().toLowerCase()),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body', code: 'bad_request' },
      { status: 400 }
    );
  }

  const parsed = REGISTER_BODY.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.flatten().fieldErrors;
    const message = Object.values(first).flat().join(' ') || 'Validation failed';
    return NextResponse.json(
      { error: message, code: 'validation_error', details: first },
      { status: 400 }
    );
  }

  const { email, username, password } = parsed.data;

  const existingEmail = email ? await prisma.user.findUnique({ where: { email } }) : null;
  if (existingEmail) {
    return NextResponse.json(
      { error: 'An account with this email already exists', code: 'email_taken' },
      { status: 409 }
    );
  }

  const existingUsername = await prisma.userCredential.findUnique({
    where: { username },
  });
  if (existingUsername) {
    return NextResponse.json(
      { error: 'Username is already taken', code: 'username_taken' },
      { status: 409 }
    );
  }

  const passwordHash = await hash(password, 12);

  try {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          name: username,
        },
      });
      await tx.userCredential.create({
        data: {
          userId: user.id,
          username,
          passwordHash,
        },
      });
    });
  } catch (err) {
    console.error('[api/auth/register]', err);
    return NextResponse.json(
      { error: 'Registration failed', code: 'internal_error' },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, message: 'Account created. You can sign in now.' });
}
