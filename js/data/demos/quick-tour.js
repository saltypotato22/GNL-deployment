/**
 * Quick Tour Demo
 * App feature overview for new users
 */
(function(window) {
    'use strict';

    const n = window.GraphApp.data.node;

    window.GraphApp.data.demos['Quick Tour'] = [
        n('Data Format', 'Group Column', 'Data Format-Node Column', 'contains'),
        n('Data Format', 'Node Column', 'Data Format-Linked To', 'connects via'),
        n('Data Format', 'Linked To', '', ''),
        n('Data Format', 'Label', '', ''),
        n('Group Operations', 'Hide from Canvas', 'Canvas Features-Diagram Updates', 'eye icon'),
        n('Group Operations', 'Collapse in Table', '', ''),
        n('Group Operations', 'Show All Groups', '', ''),
        n('Group Operations', 'Clone Group', '', ''),
        n('Group Operations', 'Delete Entire Group', '', ''),
        n('Node Operations', 'Add New Row', '', ''),
        n('Node Operations', 'Delete Node', '', ''),
        n('Node Operations', 'Duplicate Row', '', ''),
        n('Node Operations', 'Click-to-Link', 'Node Operations-Add New Row', 'then click'),
        n('Node Operations', 'Clear Link', '', ''),
        n('Table Operations', 'Edit Any Cell', 'Canvas Features-Diagram Updates', 'click + type'),
        n('Table Operations', 'Sort by Column', '', ''),
        n('Table Operations', 'Undo and Redo', '', ''),
        n('Table Operations', 'Optimal Fit', '', ''),
        n('Canvas Features', 'Zoom In/Out', '', ''),
        n('Canvas Features', 'Pan Around', '', ''),
        n('Canvas Features', 'Toggle TB/LR', '', ''),
        n('Canvas Features', 'Fit to Screen', '', ''),
        n('Canvas Features', 'Diagram Updates', 'Data Format-Group Column', 'from table'),
        n('Top Menu', 'Import File', 'Data Format-Group Column', 'CSV or Excel'),
        n('Top Menu', 'Export Options', '', ''),
        n('Top Menu', 'Clear Table', '', ''),
        n('Top Menu', 'Help Button', '', ''),
        n('Top Menu', 'Load Example', '', '')
    ];

})(window);
