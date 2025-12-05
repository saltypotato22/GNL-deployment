/**
 * Snapshot-Based History Manager
 * Optimized for memory efficiency with adaptive limits and deduplication
 */

(function(window) {
    'use strict';

    // ===== Configuration Constants =====
    const MAX_MEMORY_BYTES = 10 * 1024 * 1024; // 10MB history limit

    /**
     * Deep clone helper - uses structuredClone when available (faster)
     * Falls back to JSON for older browsers
     */
    const deepClone = function(obj) {
        if (typeof structuredClone === 'function') {
            return structuredClone(obj);
        }
        return JSON.parse(JSON.stringify(obj));
    };

    /**
     * Estimate memory size of nodes array (rough approximation)
     * @param {Array} nodes - Nodes array
     * @returns {Number} Estimated bytes
     */
    const estimateSize = function(nodes) {
        // Rough estimate: ~200 bytes per node
        return nodes.length * 200;
    };

    /**
     * Quick comparison to detect if state changed
     * Compares length and samples a few nodes
     */
    const stateChanged = function(a, b) {
        if (!a || !b) return true;
        if (a.length !== b.length) return true;

        // Sample comparison for large arrays
        const sampleSize = Math.min(5, a.length);
        for (let i = 0; i < sampleSize; i++) {
            const idx = Math.floor(i * a.length / sampleSize);
            if (JSON.stringify(a[idx]) !== JSON.stringify(b[idx])) {
                return true;
            }
        }

        // Full comparison for small arrays or if samples match
        if (a.length <= 50) {
            return JSON.stringify(a) !== JSON.stringify(b);
        }

        return false;
    };

    class SnapshotHistory {
        constructor(maxHistory = 50) {
            this.history = [];
            this.currentIndex = -1;
            this.maxHistory = maxHistory;
            this.maxMemoryBytes = MAX_MEMORY_BYTES;
        }

        /**
         * Calculate adaptive max history based on data size
         */
        getAdaptiveLimit(nodeCount) {
            // Reduce history for large datasets
            if (nodeCount > 500) return 20;
            if (nodeCount > 200) return 30;
            if (nodeCount > 100) return 40;
            return this.maxHistory;
        }

        /**
         * Save current state
         * @param {Array} nodes - Current nodes array
         */
        push(nodes) {
            // Skip if state hasn't changed (deduplication)
            if (this.currentIndex >= 0 && !stateChanged(nodes, this.history[this.currentIndex])) {
                return;
            }

            // Deep clone to prevent reference issues
            const snapshot = deepClone(nodes);

            // Remove any redo history
            this.history = this.history.slice(0, this.currentIndex + 1);

            // Add new snapshot
            this.history.push(snapshot);
            this.currentIndex++;

            // Apply adaptive limit based on node count
            const adaptiveLimit = this.getAdaptiveLimit(nodes.length);

            // Trim history if over limit
            while (this.history.length > adaptiveLimit) {
                this.history.shift();
                this.currentIndex--;
            }

            // Also check total memory estimate
            let totalSize = 0;
            for (const snap of this.history) {
                totalSize += estimateSize(snap);
            }

            // Remove oldest if over memory limit
            while (totalSize > this.maxMemoryBytes && this.history.length > 1) {
                const removed = this.history.shift();
                totalSize -= estimateSize(removed);
                this.currentIndex--;
            }
        }

        /**
         * Check if undo is available
         */
        canUndo() {
            return this.currentIndex > 0;
        }

        /**
         * Check if redo is available
         */
        canRedo() {
            return this.currentIndex < this.history.length - 1;
        }

        /**
         * Get previous state
         * @returns {Array|null} Previous nodes array or null
         */
        undo() {
            if (!this.canUndo()) return null;

            this.currentIndex--;
            return deepClone(this.history[this.currentIndex]);
        }

        /**
         * Get next state
         * @returns {Array|null} Next nodes array or null
         */
        redo() {
            if (!this.canRedo()) return null;

            this.currentIndex++;
            return deepClone(this.history[this.currentIndex]);
        }

        /**
         * Get current state
         * @returns {Array|null} Current nodes array or null
         */
        getCurrent() {
            if (this.currentIndex < 0) return null;
            return deepClone(this.history[this.currentIndex]);
        }

        /**
         * Clear all history
         */
        clear() {
            this.history = [];
            this.currentIndex = -1;
        }

        /**
         * Get info about history state
         */
        getInfo() {
            let memoryEstimate = 0;
            for (const snap of this.history) {
                memoryEstimate += estimateSize(snap);
            }

            return {
                size: this.history.length,
                currentIndex: this.currentIndex,
                canUndo: this.canUndo(),
                canRedo: this.canRedo(),
                memoryEstimateKB: Math.round(memoryEstimate / 1024)
            };
        }
    }

    // Export to global namespace
    window.GraphApp = window.GraphApp || {};
    window.GraphApp.SnapshotHistory = SnapshotHistory;

})(window);
