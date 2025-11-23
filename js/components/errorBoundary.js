/**
 * Error Boundary Component
 * Catches JavaScript errors anywhere in child component tree
 * Displays fallback UI instead of crashing the whole app
 */

(function(window) {
    'use strict';

    const { Component, createElement } = React;

    class ErrorBoundary extends Component {
        constructor(props) {
            super(props);
            this.state = {
                hasError: false,
                error: null,
                errorInfo: null
            };
        }

        static getDerivedStateFromError(error) {
            // Update state so the next render will show the fallback UI
            return { hasError: true };
        }

        componentDidCatch(error, errorInfo) {
            // Log error details for debugging
            console.error('Slim Graph Error:', error);
            console.error('Component Stack:', errorInfo.componentStack);

            this.setState({
                error: error,
                errorInfo: errorInfo
            });
        }

        handleReload() {
            window.location.reload();
        }

        handleReset() {
            this.setState({
                hasError: false,
                error: null,
                errorInfo: null
            });
        }

        render() {
            if (this.state.hasError) {
                // Fallback UI
                return createElement('div', {
                    className: 'min-h-screen bg-gray-50 flex items-center justify-center p-4'
                }, [
                    createElement('div', {
                        key: 'error-card',
                        className: 'bg-white rounded-lg shadow-lg p-6 max-w-lg w-full'
                    }, [
                        // Error icon
                        createElement('div', {
                            key: 'icon',
                            className: 'flex justify-center mb-4'
                        }, [
                            createElement('svg', {
                                key: 'svg',
                                className: 'w-16 h-16 text-red-500',
                                fill: 'none',
                                viewBox: '0 0 24 24',
                                stroke: 'currentColor'
                            }, [
                                createElement('path', {
                                    key: 'path',
                                    strokeLinecap: 'round',
                                    strokeLinejoin: 'round',
                                    strokeWidth: 2,
                                    d: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'
                                })
                            ])
                        ]),

                        // Title
                        createElement('h2', {
                            key: 'title',
                            className: 'text-xl font-semibold text-gray-900 text-center mb-2'
                        }, 'Something went wrong'),

                        // Description
                        createElement('p', {
                            key: 'desc',
                            className: 'text-gray-600 text-center mb-4'
                        }, 'An unexpected error occurred. Your data may still be safe.'),

                        // Error details (collapsed by default)
                        this.state.error && createElement('details', {
                            key: 'details',
                            className: 'mb-4 bg-gray-50 rounded p-3 text-sm'
                        }, [
                            createElement('summary', {
                                key: 'summary',
                                className: 'cursor-pointer text-gray-500 font-medium'
                            }, 'Technical details'),
                            createElement('pre', {
                                key: 'pre',
                                className: 'mt-2 text-xs text-red-600 overflow-auto max-h-32'
                            }, this.state.error.toString()),
                            this.state.errorInfo && createElement('pre', {
                                key: 'stack',
                                className: 'mt-2 text-xs text-gray-500 overflow-auto max-h-32'
                            }, this.state.errorInfo.componentStack)
                        ]),

                        // Action buttons
                        createElement('div', {
                            key: 'actions',
                            className: 'flex gap-3'
                        }, [
                            createElement('button', {
                                key: 'retry',
                                onClick: () => this.handleReset(),
                                className: 'flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors'
                            }, 'Try Again'),
                            createElement('button', {
                                key: 'reload',
                                onClick: () => this.handleReload(),
                                className: 'flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors'
                            }, 'Reload Page')
                        ]),

                        // Help text
                        createElement('p', {
                            key: 'help',
                            className: 'text-xs text-gray-400 text-center mt-4'
                        }, 'If this keeps happening, try exporting your data first, then reload.')
                    ])
                ]);
            }

            // Render children normally
            return this.props.children;
        }
    }

    // Export to global namespace
    window.GraphApp = window.GraphApp || {};
    window.GraphApp.components = window.GraphApp.components || {};
    window.GraphApp.components.ErrorBoundary = ErrorBoundary;

})(window);
