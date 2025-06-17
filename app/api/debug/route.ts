import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    elevenLabsKey: process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY ? 'Key is set' : 'Key is missing',
    nodeEnv: process.env.NODE_ENV,
  });
}
