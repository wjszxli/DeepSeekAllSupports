/**
 * Performance optimization utilities
 */

/**
 * Debounce function to limit how often a function can be called
 * @param func The function to debounce
 * @param wait Wait time in milliseconds
 * @returns Debounced function
 */
export function debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number,
): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout | null = null;

    return function (...args: Parameters<T>) {
        const later = () => {
            timeout = null;
            func(...args);
        };

        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Throttle function to limit how often a function can be called
 * @param func The function to throttle
 * @param limit Time limit in milliseconds
 * @returns Throttled function
 */
export function throttle<T extends (...args: any[]) => any>(
    func: T,
    limit: number,
): (...args: Parameters<T>) => void {
    let inThrottle = false;
    let lastFunc: NodeJS.Timeout;
    let lastRan: number;

    return function (...args: Parameters<T>) {
        if (!inThrottle) {
            func(...args);
            lastRan = Date.now();
            inThrottle = true;

            setTimeout(() => {
                inThrottle = false;
            }, limit);
        } else {
            clearTimeout(lastFunc);
            lastFunc = setTimeout(() => {
                if (Date.now() - lastRan >= limit) {
                    func(...args);
                    lastRan = Date.now();
                }
            }, limit - (Date.now() - lastRan));
        }
    };
}

/**
 * Memoize function to cache results of expensive function calls
 * @param func The function to memoize
 * @returns Memoized function
 */
export function memoize<T extends (...args: any[]) => any>(
    func: T,
): (...args: Parameters<T>) => ReturnType<T> {
    const cache = new Map<string, ReturnType<T>>();

    return function (...args: Parameters<T>): ReturnType<T> {
        const key = JSON.stringify(args);
        if (cache.has(key)) {
            return cache.get(key) as ReturnType<T>;
        }

        const result = func(...args);
        cache.set(key, result);
        return result;
    };
}

/**
 * Batch DOM updates to reduce reflows and repaints
 * @param updates Array of update functions to execute
 */
export function batchDOMUpdates(updates: Array<() => void>): void {
    requestAnimationFrame(() => {
        // Execute all updates
        updates.forEach((update) => update());
    });
}

/**
 * Set up lazy loading for images
 * @param imageSelector Selector for images to lazy load
 */
export function setupLazyLoading(imageSelector = 'img[data-src]'): void {
    // Check if IntersectionObserver is available
    if ('IntersectionObserver' in window) {
        const lazyImageObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    const lazyImage = entry.target as HTMLImageElement;
                    const src = lazyImage.dataset.src;
                    if (src) {
                        lazyImage.src = src;
                        delete lazyImage.dataset.src;
                        lazyImageObserver.unobserve(lazyImage);
                    }
                }
            });
        });

        const lazyImages = document.querySelectorAll(imageSelector);
        lazyImages.forEach((lazyImage) => {
            lazyImageObserver.observe(lazyImage);
        });
    } else {
        // Fallback for browsers that don't support IntersectionObserver
        function lazyLoad() {
            const lazyImages = document.querySelectorAll(imageSelector);
            lazyImages.forEach((img) => {
                const lazyImage = img as HTMLImageElement;
                const src = lazyImage.dataset.src;
                const windowObj = window as any;
                if (
                    src &&
                    lazyImage.getBoundingClientRect().top <= windowObj.innerHeight &&
                    lazyImage.getBoundingClientRect().bottom >= 0
                ) {
                    lazyImage.src = src;
                    delete lazyImage.dataset.src;
                }
            });
        }

        // Initial load
        lazyLoad();

        // Add event listeners for fallback lazy loading
        document.addEventListener('scroll', throttle(lazyLoad, 200));
        const windowObj = window as any;
        windowObj.addEventListener('resize', throttle(lazyLoad, 200));
        windowObj.addEventListener('orientationchange', throttle(lazyLoad, 200));
    }
}

/**
 * Optimize event listeners by using event delegation
 * @param parentElement Parent element to attach the event listener
 * @param eventType Event type to listen for
 * @param selector CSS selector to filter target elements
 * @param callback Callback function to execute when event is triggered
 */
export function delegateEvent(
    parentElement: HTMLElement | Document,
    eventType: string,
    selector: string,
    callback: (event: Event, targetElement: HTMLElement) => void,
): void {
    parentElement.addEventListener(eventType, (event) => {
        const targetElement = (event.target as HTMLElement).closest(selector);

        if (targetElement) {
            callback(event, targetElement as HTMLElement);
        }
    });
}
