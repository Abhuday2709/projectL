"use client";

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import { trpc } from '../app/_trpc/client';
const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <trpc.Provider
            client={trpc.createClient({
                links: [
                    httpBatchLink({
                        url: '/api/trpc',
                    }),
                ],
            })}
            queryClient={queryClient}
        >
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        </trpc.Provider>
    );
}