import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET() {
  const jar = await cookies();
  const preview = jar.get('sa_preview')?.value;
  const session = jar.get('sa_session')?.value;
  const expected = process.env.SUPER_ADMIN_SESSION_TOKEN;

  const ok = !!expected && preview === expected && session === expected;
  return NextResponse.json({ ok });
}
