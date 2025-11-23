/**
 * Accessibility Utilities
 * Helper functions for creating accessible UI elements
 */

(function(window) {
    'use strict';

    /**
     * Create an accessible icon button
     * @param {Object} props - Button properties
     * @param {String} props.label - Accessible label (required)
     * @param {Object} props.icon - Icon component
     * @param {Function} props.onClick - Click handler
     * @param {String} props.className - Additional CSS classes
     * @param {Boolean} props.disabled - Disabled state
     * @param {String} props.title - Tooltip text (defaults to label)
     * @returns {Object} React element
     */
    const IconButton = function(props) {
        const { label, icon, onClick, className = '', disabled = false, title } = props;

        return React.createElement('button', {
            type: 'button',
            'aria-label': label,
            title: title || label,
            onClick: onClick,
            disabled: disabled,
            className: `icon-button ${className} ${disabled ? 'btn-disabled' : ''}`.trim()
        }, icon);
    };

    /**
     * Create screen-reader only text
     * @param {String} text - Text to announce
     * @returns {Object} React element
     */
    const SrOnly = function(text) {
        return React.createElement('span', {
            className: 'sr-only'
        }, text);
    };

    /**
     * Announce message to screen readers
     * @param {String} message - Message to announce
     * @param {String} priority - 'polite' or 'assertive'
     */
    const announce = function(message, priority = 'polite') {
        // Create or get announcer element
        let announcer = document.getElementById('a11y-announcer');

        if (!announcer) {
            announcer = document.createElement('div');
            announcer.id = 'a11y-announcer';
            announcer.className = 'sr-only';
            announcer.setAttribute('aria-live', priority);
            announcer.setAttribute('aria-atomic', 'true');
            document.body.appendChild(announcer);
        }

        // Update priority if different
        announcer.setAttribute('aria-live', priority);

        // Clear and set message (required for re-announcement)
        announcer.textContent = '';
        setTimeout(() => {
            announcer.textContent = message;
        }, 100);
    };

    /**
     * Trap focus within a container (for modals)
     * @param {HTMLElement} container - Container element
     * @returns {Function} Cleanup function
     */
    const trapFocus = function(container) {
        const focusableElements = container.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        const handleKeyDown = function(e) {
            if (e.key !== 'Tab') return;

            if (e.shiftKey) {
                if (document.activeElement === firstElement) {
                    e.preventDefault();
                    lastElement.focus();
                }
            } else {
                if (document.activeElement === lastElement) {
                    e.preventDefault();
                    firstElement.focus();
                }
            }
        };

        container.addEventListener('keydown', handleKeyDown);

        // Focus first element
        if (firstElement) firstElement.focus();

        // Return cleanup function
        return function() {
            container.removeEventListener('keydown', handleKeyDown);
        };
    };

    /**
     * Keyboard shortcut helper
     * Common shortcuts used in the app
     */
    const SHORTCUTS = {
        UNDO: 'Ctrl+Z',
        REDO: 'Ctrl+Shift+Z',
        ZOOM_IN: 'Ctrl++',
        ZOOM_OUT: 'Ctrl+-',
        FIT_TO_SCREEN: 'Ctrl+0',
        ADD_ROW: 'Ctrl+Enter',
        DELETE_ROW: 'Delete',
        ESCAPE: 'Escape',
        ENTER: 'Enter'
    };

    // Expose utilities to global namespace
    window.GraphApp = window.GraphApp || {};
    window.GraphApp.utils = window.GraphApp.utils || {};
    window.GraphApp.utils.a11y = {
        IconButton,
        SrOnly,
        announce,
        trapFocus,
        SHORTCUTS
    };

})(window);
