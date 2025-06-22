import { NextRequest } from 'next/server';
import { getProgressResponse } from '../../progress-stream';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  if (!id) return new Response('Bad Request', { status: 400 });
  return getProgressResponse(id);
} 