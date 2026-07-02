import { useCallback, useEffect, useRef } from 'react';
import { throttle } from './performance';

/**
 * Custom hook for throttled callback
 */
export function useThrottledCallback<T extends (...args: any[]) => any>(
    callback: T,
    limit: number,
    deps: React.DependencyList = [],
): (...args: Parameters<T>) => void {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const memoizedCallback = useCallback(callback, deps);
    const throttledCallback = useRef<(...args: Parameters<T>) => void>();

    useEffect(() => {
        throttledCallback.current = throttle(memoizedCallback, limit);
    }, [memoizedCallback, limit]);

    return useCallback((...args: Parameters<T>) => {
        throttledCallback.current?.(...args);
    }, []);
}
