/**
 * UI Labels and Text Configuration
 * Centralized text for easy internationalization
 */

(function(window) {
    'use strict';

    window.GraphApp.config.labels = {
        buttons: {
            import: 'Import',
            export: 'Export',
            add: 'Add Node',
            delete: 'Delete',
            zoomIn: 'Zoom In',
            zoomOut: 'Zoom Out',
            resetZoom: 'Reset Zoom',
            toggleTooltips: 'Tooltips',
            settings: 'Settings'
        },
        toolbar: {
            title: 'Slim Graph',
            subtitle: 'Network Diagram Visualizer'
        },
        table: {
            headers: {
                group: 'Group',
                node: 'Node',
                id: 'ID',
                linkedNodeID: 'Linked Node ID',
                hiddenNode: 'Hidden',
                hiddenLink: 'Hide Link',
                linkLabel: 'Link Label',
                linkArrow: 'Arrow',
                actions: 'Actions'
            }
        },
        export: {
            title: 'Export Data',
            formats: {
                csv: {
                    name: 'CSV',
                    description: 'Export as comma-separated values'
                },
                excel: {
                    name: 'Excel',
                    description: 'Export with formulas preserved'
                },
                mermaid: {
                    name: 'Mermaid',
                    description: 'Export as Mermaid diagram'
                },
                png: {
                    name: 'PNG Image',
                    description: 'Export diagram as PNG'
                }
            }
        },
        settings: {
            layoutDirection: 'Layout Direction',
            zoom: 'Zoom',
            showTooltips: 'Show Tooltips'
        },
        messages: {
            noData: 'No data loaded. Import a file or add nodes to get started.',
            loading: 'Loading...',
            rendering: 'Rendering diagram...',
            errorTitle: 'Errors Found',
            warningTitle: 'Warnings',
            deleteConfirm: 'Are you sure you want to delete this node?',
            unsavedChanges: 'You have unsaved changes. Continue?'
        },
        validation: {
            duplicateID: 'Duplicate node ID',
            missingField: 'Required field is missing',
            brokenReference: 'Reference to undefined node',
            cycleDetected: 'Circular reference detected'
        }
    };

})(window);
