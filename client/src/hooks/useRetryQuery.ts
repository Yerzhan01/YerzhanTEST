import { useQuery, QueryKey, QueryFunction } from '@tanstack/react-query';

interface RetryQueryOptions {
  queryKey: QueryKey;
  queryFn: QueryFunction;
  enabled?: boolean;
  staleTime?: number;
  maxRetries?: number;
}

export function useRetryQuery({
  queryKey,
  queryFn,
  enabled = true,
  staleTime = 300000, // 5 minutes
  maxRetries = 3
}: RetryQueryOptions) {
  return useQuery({
    queryKey,
    queryFn,
    enabled,
    staleTime,
    retry: (failureCount, error: any) => {
      // Don't retry on authentication errors
      if (error?.status === 401 || error?.status === 403) {
        return false;
      }
      
      // Don't retry on client errors (4xx)
      if (error?.status >= 400 && error?.status < 500) {
        return false;
      }
      
      // Retry on server errors (5xx) and network errors
      return failureCount < maxRetries;
    },
    retryDelay: (attemptIndex) => {
      // Exponential backoff with jitter
      const baseDelay = Math.min(1000 * 2 ** attemptIndex, 30000);
      const jitter = Math.random() * 1000;
      return baseDelay + jitter;
    }
  });
}