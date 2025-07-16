"use client";

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import { trpc } from '../app/_trpc/client';

// Initialize global query client for React Query
const queryClient = new QueryClient();

// Global providers wrapper - sets up tRPC and React Query
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