import { NextRequest, NextResponse } from 'next/server';
import { myPodcastQueue } from '@/lib/queue';

export async function POST(req: NextRequest) {
    const body = await req.json();
    const { DocIdList, chatId,user_id,createdAt } = body;

    await myPodcastQueue.add('generatePodcast', { DocIdList, chatId,user_id,createdAt });

    return NextResponse.json({ success: true });
}