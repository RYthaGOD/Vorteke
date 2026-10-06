import { QueryClient, isServer } from '@tanstack/react-query';

const makeQueryClient = () => new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 1000 * 60 * 5, // 5 minutes
            gcTime: 1000 * 60 * 60 * 24, // 24 hours
            retry: 2,
            refetchOnWindowFocus: true,
        },
    },
});

let browserQueryClient: QueryClient | undefined;

/** One client per server render, so no cache is shared between visitors; one for the browser's lifetime. */
export function getQueryClient() {
    if (isServer) return makeQueryClient();
    return (browserQueryClient ??= makeQueryClient());
}
