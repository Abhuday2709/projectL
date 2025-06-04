
import { getAuth } from '@clerk/nextjs/server';
import { NextRequest } from 'next/server';

export async function createContext({ req }: { req: NextRequest }) {

    const { userId, sessionId } = getAuth(req);
    return {
        userId,   
        sessionId,
    };
}

export type Context = Awaited<ReturnType<typeof createContext>>;