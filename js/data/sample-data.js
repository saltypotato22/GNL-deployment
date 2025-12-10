/**
 * Sample Data Module
 * Initializes the data namespace and provides helper function for demo files
 *
 * Demo files are loaded separately from js/data/demos/*.js
 * To add a new demo:
 * 1. Create js/data/demos/my-demo.js using the node() helper
 * 2. Add <script src="js/data/demos/my-demo.js"></script> to index.html
 */

(function(window) {
    'use strict';

    // Initialize data namespace with demos container and helper function
    window.GraphApp.data = {
        // Container for demos (populated by individual demo files)
        demos: {},

        // Helper function to create node objects (used by demo files)
        node: (group, nodeName, linkedTo, label) => ({
            Group_xA: group,
            Node_xA: nodeName,
            ID_xA: `${group}-${nodeName}`,
            Linked_Node_ID_xA: linkedTo || '',
            Hidden_Node_xB: 0,
            Hidden_Link_xB: 0,
            Link_Label_xB: label || '',
            Link_Arrow_xB: 'To'
        })
    };

})(window);
