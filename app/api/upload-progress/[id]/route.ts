import { NextRequest, NextResponse } from 'next/server';
import { getProgressResponse } from '../../progress-stream';
import { rateLimitUploadProgress } from '@/lib/rate-limit';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  if (!id) return new Response('Bad Request', { status: 400 });

  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';
  const rl = rateLimitUploadProgress(ip);
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Too many connections' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec ?? 60) } }
    );
  }

  return getProgressResponse(id);
} 