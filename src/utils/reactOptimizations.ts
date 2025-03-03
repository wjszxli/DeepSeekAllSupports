import { useCallback, useEffect, useRef, useState } from 'react';
import { debounce, throttle } from './performance';

/**
 * Custom hook for using a stable callback that never changes identity
 * but always calls the latest function passed to it
 * @param callback The callback function
 * @returns A stable callback function
 */
export function useStableCallback<T extends (...args: any[]) => any>(callback: T): T {
    const callbackRef = useRef(callback);

    useEffect(() => {
        callbackRef.current = callback;
    }, [callback]);

    // @ts-ignore - the types are correct but TypeScript doesn't know it
    return useCallback((...args: Parameters<T>) => {
        return callbackRef.current(...args);
    }, []);
}

/**
 * Custom hook for debounced values
 * @param value The value to debounce
 * @param delay Delay in milliseconds
 * @returns The debounced value
 */
export function useDebouncedValue<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => {
            clearTimeout(timer);
        };
    }, [value, delay]);

    return debouncedValue;
}

/**
 * Custom hook for debounced callback
 * @param callback The callback to debounce
 * @param delay Delay in milliseconds
 * @param deps Dependencies array
 * @returns Debounced callback
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
    callback: T,
    delay: number,
    deps: React.DependencyList = [],
): (...args: Parameters<T>) => void {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const memoizedCallback = useCallback(callback, deps);
    const debouncedCallback = useRef<(...args: Parameters<T>) => void>();

    useEffect(() => {
        debouncedCallback.current = debounce(memoizedCallback, delay);
    }, [memoizedCallback, delay]);

    return useCallback((...args: Parameters<T>) => {
        debouncedCallback.current?.(...args);
    }, []);
}

/**
 * Custom hook for throttled callback
 * @param callback The callback to throttle
 * @param limit Time limit in milliseconds
 * @param deps Dependencies array
 * @returns Throttled callback
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

/**
 * Custom hook for detecting when a component is visible in the viewport
 * @param options IntersectionObserver options
 * @returns [ref, isVisible] tuple
 */
export function useInView<T extends HTMLElement = HTMLDivElement>(
    options: IntersectionObserverInit = { threshold: 0 },
): [React.RefObject<T>, boolean] {
    const ref = useRef<T>(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const element = ref.current;
        if (!element) return;

        const observer = new IntersectionObserver(([entry]) => {
            setIsVisible(entry.isIntersecting);
        }, options);

        observer.observe(element);

        return () => {
            observer.disconnect();
        };
    }, [options]);

    return [ref, isVisible];
}

/**
 * Custom hook for lazy loading components
 * @param factory Factory function that returns a promise resolving to a component
 * @returns [Component, isLoading] tuple
 */
export function useLazyComponent<T>(
    factory: () => Promise<{ default: React.ComponentType<T> }>,
): [React.ComponentType<T> | null, boolean] {
    const [Component, setComponent] = useState<React.ComponentType<T> | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;

        factory()
            .then(({ default: LoadedComponent }) => {
                if (isMounted) {
                    setComponent(() => LoadedComponent);
                    setIsLoading(false);
                }
            })
            .catch((error) => {
                console.error('Error loading component:', error);
                if (isMounted) {
                    setIsLoading(false);
                }
            });

        return () => {
            isMounted = false;
        };
    }, [factory]);

    return [Component, isLoading];
}

/**
 * Custom hook for preventing re-renders when props haven't changed
 * @param props The props object to check
 * @returns A stable props object that only changes when values change
 */
export function useStableProps<T extends object>(props: T): T {
    const propsRef = useRef<T>(props);

    // Check if any props have changed
    let hasChanged = false;
    const currentProps = propsRef.current;

    for (const key in props) {
        if (props[key] !== currentProps[key]) {
            hasChanged = true;
            break;
        }
    }

    // Update ref if props have changed
    if (hasChanged) {
        propsRef.current = { ...props };
    }

    return propsRef.current;
}

/**
 * Custom hook for measuring component render performance
 * @param componentName Name of the component to measure
 * @param enabled Whether measurement is enabled
 */
export function useRenderPerformance(componentName: string, enabled = true): void {
    const renderCount = useRef(0);
    const lastRenderTime = useRef(performance.now());

    if (enabled) {
        const now = performance.now();
        const timeSinceLastRender = now - lastRenderTime.current;
        renderCount.current += 1;

        console.log(
            `[Performance] ${componentName} rendered #${renderCount.current} ` +
                `(+${timeSinceLastRender.toFixed(2)}ms)`,
        );

        lastRenderTime.current = now;
    }
}
