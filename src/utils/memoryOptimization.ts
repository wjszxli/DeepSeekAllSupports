/**
 * Memory optimization utilities
 */

/**
 * LRU (Least Recently Used) Cache implementation
 * Automatically removes least recently used items when capacity is reached
 */
export class LRUCache<K, V> {
    private capacity: number;
    private cache: Map<K, V>;

    constructor(capacity: number) {
        this.capacity = capacity;
        this.cache = new Map<K, V>();
    }

    /**
     * Get a value from the cache
     * @param key The key to look up
     * @returns The value or undefined if not found
     */
    get(key: K): V | undefined {
        if (!this.cache.has(key)) return undefined;

        // Move the accessed item to the end (most recently used)
        const value = this.cache.get(key)!;
        this.cache.delete(key);
        this.cache.set(key, value);

        return value;
    }

    /**
     * Set a value in the cache
     * @param key The key to store
     * @param value The value to store
     */
    set(key: K, value: V): void {
        // If key exists, delete it first to update its position
        if (this.cache.has(key)) {
            this.cache.delete(key);
        }
        // If cache is full, remove the oldest item (first in Map)
        else if (this.cache.size >= this.capacity) {
            const firstKey = this.cache.keys().next().value;
            if (firstKey !== undefined) {
                this.cache.delete(firstKey);
            }
        }

        // Add new item at the end (most recently used)
        this.cache.set(key, value);
    }

    /**
     * Check if a key exists in the cache
     * @param key The key to check
     * @returns True if the key exists
     */
    has(key: K): boolean {
        return this.cache.has(key);
    }

    /**
     * Remove a key from the cache
     * @param key The key to remove
     * @returns True if the key was removed
     */
    delete(key: K): boolean {
        return this.cache.delete(key);
    }

    /**
     * Clear the cache
     */
    clear(): void {
        this.cache.clear();
    }

    /**
     * Get the current size of the cache
     */
    get size(): number {
        return this.cache.size;
    }

    /**
     * Get all keys in the cache
     */
    keys(): IterableIterator<K> {
        return this.cache.keys();
    }

    /**
     * Get all values in the cache
     */
    values(): IterableIterator<V> {
        return this.cache.values();
    }
}

/**
 * Object pool for reusing objects instead of creating new ones
 * Helps reduce garbage collection
 */
export class ObjectPool<T> {
    private pool: T[];
    private factory: () => T;
    private reset: (obj: T) => void;

    /**
     * Create a new object pool
     * @param factory Function to create new objects
     * @param reset Function to reset objects before reuse
     * @param initialSize Initial size of the pool
     */
    constructor(factory: () => T, reset: (obj: T) => void, initialSize = 0) {
        this.factory = factory;
        this.reset = reset;
        this.pool = new Array(initialSize)
            .fill(null)
            .map(() => this.factory());
    }

    /**
     * Get an object from the pool or create a new one
     * @returns An object from the pool
     */
    acquire(): T {
        if (this.pool.length > 0) {
            return this.pool.pop()!;
        }
        return this.factory();
    }

    /**
     * Return an object to the pool
     * @param obj The object to return
     */
    release(obj: T): void {
        this.reset(obj);
        this.pool.push(obj);
    }

    /**
     * Get the current size of the pool
     */
    get size(): number {
        return this.pool.length;
    }

    /**
     * Clear the pool
     */
    clear(): void {
        this.pool = [];
    }
}

/**
 * Memory usage monitor to track memory consumption
 */
export class MemoryMonitor {
    private static instance: MemoryMonitor;
    private memoryWarningThreshold: number;
    private listeners: Array<(usage: MemoryInfo) => void> = [];
    private intervalId: number | null = null;

    private constructor(memoryWarningThresholdMB = 100) {
        this.memoryWarningThreshold = memoryWarningThresholdMB * 1024 * 1024; // Convert to bytes
    }

    /**
     * Get the singleton instance
     */
    public static getInstance(): MemoryMonitor {
        if (!MemoryMonitor.instance) {
            MemoryMonitor.instance = new MemoryMonitor();
        }
        return MemoryMonitor.instance;
    }

    /**
     * Start monitoring memory usage
     * @param intervalMs Interval in milliseconds between checks
     */
    public startMonitoring(intervalMs = 10000): void {
        if (this.intervalId !== null) return;

        this.intervalId = window.setInterval(() => {
            this.checkMemoryUsage();
        }, intervalMs);
    }

    /**
     * Stop monitoring memory usage
     */
    public stopMonitoring(): void {
        if (this.intervalId !== null) {
            window.clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    /**
     * Add a listener for memory usage updates
     * @param listener Function to call with memory usage info
     */
    public addListener(listener: (usage: MemoryInfo) => void): void {
        this.listeners.push(listener);
    }

    /**
     * Remove a listener
     * @param listener The listener to remove
     */
    public removeListener(listener: (usage: MemoryInfo) => void): void {
        const index = this.listeners.indexOf(listener);
        if (index !== -1) {
            this.listeners.splice(index, 1);
        }
    }

    /**
     * Check current memory usage
     */
    private checkMemoryUsage(): void {
        if ('performance' in window && 'memory' in performance) {
            const memoryInfo = (performance as any).memory as MemoryInfo;

            // Notify listeners
            this.listeners.forEach((listener) => listener(memoryInfo));

            // Check if memory usage is above threshold
            if (memoryInfo.usedJSHeapSize > this.memoryWarningThreshold) {
                console.warn('Memory usage warning: Used JS heap size exceeds threshold', {
                    usedJSHeapSize: `${Math.round(memoryInfo.usedJSHeapSize / (1024 * 1024))} MB`,
                    jsHeapSizeLimit: `${Math.round(memoryInfo.jsHeapSizeLimit / (1024 * 1024))} MB`,
                    threshold: `${Math.round(this.memoryWarningThreshold / (1024 * 1024))} MB`,
                });

                // Suggest garbage collection
                this.suggestGarbageCollection();
            }
        }
    }

    /**
     * Suggest garbage collection to the browser
     */
    private suggestGarbageCollection(): void {
        // Clear any object references that might be causing memory leaks
        // This is just a hint to the garbage collector
        if (window.gc) {
            try {
                window.gc();
            } catch (error) {
                console.error('Failed to suggest garbage collection', error);
            }
        }
    }
}

/**
 * Memory info interface for Chrome's performance.memory
 */
interface MemoryInfo {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
}

/**
 * Detect memory leaks by tracking object references
 * @param objectToTrack Object to track for potential memory leaks
 * @param label Label for the tracked object
 */
export function trackForMemoryLeaks(objectToTrack: any, label: string): void {
    // Use a WeakRef to track the object without preventing garbage collection
    if (typeof WeakRef !== 'undefined') {
        const ref = new WeakRef(objectToTrack);

        // Check if the object is still in memory after some time
        setTimeout(() => {
            const obj = ref.deref();
            if (obj) {
                console.warn(
                    `Potential memory leak detected: ${label} is still in memory after 30 seconds`,
                );
            }
        }, 30000);
    }
}
