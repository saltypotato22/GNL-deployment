/**
 * Sample Data Module
 * META example: The app explains itself
 */

(function(window) {
    'use strict';

    // Welcome to Slim Graph - A self-documenting introduction
    const sampleData = [
        // === START HERE ===
        {
            Group_xA: 'Start Here',
            Node_xA: 'Try This First',
            ID_xA: 'Start Here-Try This First',
            Linked_Node_ID_xA: 'Core Features-Visual Link Mode',
            Hidden_Node_xB: 0,
            Hidden_Link_xB: 0,
            Link_Label_xB: 'click the',
            Link_Arrow_xB: 'To'
        },
        {
            Group_xA: 'Start Here',
            Node_xA: 'Import Your Data',
            ID_xA: 'Start Here-Import Your Data',
            Linked_Node_ID_xA: 'Core Features-See It Visualized',
            Hidden_Node_xB: 0,
            Hidden_Link_xB: 0,
            Link_Label_xB: 'to instantly',
            Link_Arrow_xB: 'To'
        },
        {
            Group_xA: 'Start Here',
            Node_xA: 'Edit Any Cell',
            ID_xA: 'Start Here-Edit Any Cell',
            Linked_Node_ID_xA: 'Core Features-Graph Updates Live',
            Hidden_Node_xB: 0,
            Hidden_Link_xB: 0,
            Link_Label_xB: 'and watch',
            Link_Arrow_xB: 'To'
        },

        // === CORE FEATURES ===
        {
            Group_xA: 'Core Features',
            Node_xA: 'Visual Link Mode',
            ID_xA: 'Core Features-Visual Link Mode',
            Linked_Node_ID_xA: 'Core Features-Click Any ID',
            Hidden_Node_xB: 0,
            Hidden_Link_xB: 0,
            Link_Label_xB: 'then',
            Link_Arrow_xB: 'To'
        },
        {
            Group_xA: 'Core Features',
            Node_xA: 'Click Any ID',
            ID_xA: 'Core Features-Click Any ID',
            Linked_Node_ID_xA: 'Core Features-Nodes Connect',
            Hidden_Node_xB: 0,
            Hidden_Link_xB: 0,
            Link_Label_xB: 'and',
            Link_Arrow_xB: 'To'
        },
        {
            Group_xA: 'Core Features',
            Node_xA: 'Nodes Connect',
            ID_xA: 'Core Features-Nodes Connect',
            Linked_Node_ID_xA: '',
            Hidden_Node_xB: 0,
            Hidden_Link_xB: 0,
            Link_Label_xB: '',
            Link_Arrow_xB: 'To'
        },
        {
            Group_xA: 'Core Features',
            Node_xA: 'See It Visualized',
            ID_xA: 'Core Features-See It Visualized',
            Linked_Node_ID_xA: '',
            Hidden_Node_xB: 0,
            Hidden_Link_xB: 0,
            Link_Label_xB: '',
            Link_Arrow_xB: 'To'
        },
        {
            Group_xA: 'Core Features',
            Node_xA: 'Graph Updates Live',
            ID_xA: 'Core Features-Graph Updates Live',
            Linked_Node_ID_xA: '',
            Hidden_Node_xB: 0,
            Hidden_Link_xB: 0,
            Link_Label_xB: '',
            Link_Arrow_xB: 'To'
        },
        {
            Group_xA: 'Core Features',
            Node_xA: 'Group Controls',
            ID_xA: 'Core Features-Group Controls',
            Linked_Node_ID_xA: 'Core Features-Hide or Collapse',
            Hidden_Node_xB: 0,
            Hidden_Link_xB: 0,
            Link_Label_xB: 'to',
            Link_Arrow_xB: 'To'
        },
        {
            Group_xA: 'Core Features',
            Node_xA: 'Hide or Collapse',
            ID_xA: 'Core Features-Hide or Collapse',
            Linked_Node_ID_xA: '',
            Hidden_Node_xB: 0,
            Hidden_Link_xB: 0,
            Link_Label_xB: '',
            Link_Arrow_xB: 'To'
        },
        {
            Group_xA: 'Core Features',
            Node_xA: 'Export Options',
            ID_xA: 'Core Features-Export Options',
            Linked_Node_ID_xA: 'Core Features-PNG Excel Mermaid',
            Hidden_Node_xB: 0,
            Hidden_Link_xB: 0,
            Link_Label_xB: 'include',
            Link_Arrow_xB: 'To'
        },
        {
            Group_xA: 'Core Features',
            Node_xA: 'PNG Excel Mermaid',
            ID_xA: 'Core Features-PNG Excel Mermaid',
            Linked_Node_ID_xA: '',
            Hidden_Node_xB: 0,
            Hidden_Link_xB: 0,
            Link_Label_xB: '',
            Link_Arrow_xB: 'To'
        },

        // === DATA FORMAT ===
        {
            Group_xA: 'Data Format',
            Node_xA: 'Just 4 Columns',
            ID_xA: 'Data Format-Just 4 Columns',
            Linked_Node_ID_xA: 'Data Format-Group Node Link Label',
            Hidden_Node_xB: 0,
            Hidden_Link_xB: 0,
            Link_Label_xB: 'which are',
            Link_Arrow_xB: 'To'
        },
        {
            Group_xA: 'Data Format',
            Node_xA: 'Group Node Link Label',
            ID_xA: 'Data Format-Group Node Link Label',
            Linked_Node_ID_xA: '',
            Hidden_Node_xB: 0,
            Hidden_Link_xB: 0,
            Link_Label_xB: '',
            Link_Arrow_xB: 'To'
        },
        {
            Group_xA: 'Data Format',
            Node_xA: 'CSV or Excel',
            ID_xA: 'Data Format-CSV or Excel',
            Linked_Node_ID_xA: 'Data Format-Import and Export',
            Hidden_Node_xB: 0,
            Hidden_Link_xB: 0,
            Link_Label_xB: 'for easy',
            Link_Arrow_xB: 'To'
        },
        {
            Group_xA: 'Data Format',
            Node_xA: 'Import and Export',
            ID_xA: 'Data Format-Import and Export',
            Linked_Node_ID_xA: '',
            Hidden_Node_xB: 0,
            Hidden_Link_xB: 0,
            Link_Label_xB: '',
            Link_Arrow_xB: 'To'
        },
        {
            Group_xA: 'Data Format',
            Node_xA: 'Rename a Node',
            ID_xA: 'Data Format-Rename a Node',
            Linked_Node_ID_xA: 'Core Features-Graph Updates Live',
            Hidden_Node_xB: 0,
            Hidden_Link_xB: 0,
            Link_Label_xB: 'refs auto-update',
            Link_Arrow_xB: 'To'
        },

        // === PHILOSOPHY ===
        {
            Group_xA: 'Philosophy',
            Node_xA: 'No Build Step',
            ID_xA: 'Philosophy-No Build Step',
            Linked_Node_ID_xA: 'Philosophy-Just Open the HTML',
            Hidden_Node_xB: 0,
            Hidden_Link_xB: 0,
            Link_Label_xB: 'means',
            Link_Arrow_xB: 'To'
        },
        {
            Group_xA: 'Philosophy',
            Node_xA: 'Just Open the HTML',
            ID_xA: 'Philosophy-Just Open the HTML',
            Linked_Node_ID_xA: '',
            Hidden_Node_xB: 0,
            Hidden_Link_xB: 0,
            Link_Label_xB: '',
            Link_Arrow_xB: 'To'
        },
        {
            Group_xA: 'Philosophy',
            Node_xA: '256KB Total',
            ID_xA: 'Philosophy-256KB Total',
            Linked_Node_ID_xA: 'Philosophy-Loads Instantly',
            Hidden_Node_xB: 0,
            Hidden_Link_xB: 0,
            Link_Label_xB: 'so it',
            Link_Arrow_xB: 'To'
        },
        {
            Group_xA: 'Philosophy',
            Node_xA: 'Loads Instantly',
            ID_xA: 'Philosophy-Loads Instantly',
            Linked_Node_ID_xA: '',
            Hidden_Node_xB: 0,
            Hidden_Link_xB: 0,
            Link_Label_xB: '',
            Link_Arrow_xB: 'To'
        },
        {
            Group_xA: 'Philosophy',
            Node_xA: 'Your Data Stays Local',
            ID_xA: 'Philosophy-Your Data Stays Local',
            Linked_Node_ID_xA: 'Philosophy-No Server Needed',
            Hidden_Node_xB: 0,
            Hidden_Link_xB: 0,
            Link_Label_xB: 'because',
            Link_Arrow_xB: 'To'
        },
        {
            Group_xA: 'Philosophy',
            Node_xA: 'No Server Needed',
            ID_xA: 'Philosophy-No Server Needed',
            Linked_Node_ID_xA: '',
            Hidden_Node_xB: 0,
            Hidden_Link_xB: 0,
            Link_Label_xB: '',
            Link_Arrow_xB: 'To'
        },

        // === CROSS-GROUP CONNECTIONS ===
        {
            Group_xA: 'Philosophy',
            Node_xA: 'Open Source',
            ID_xA: 'Philosophy-Open Source',
            Linked_Node_ID_xA: 'Data Format-CSV or Excel',
            Hidden_Node_xB: 0,
            Hidden_Link_xB: 0,
            Link_Label_xB: 'uses standard',
            Link_Arrow_xB: 'To'
        },
        {
            Group_xA: 'Data Format',
            Node_xA: 'Simple Format',
            ID_xA: 'Data Format-Simple Format',
            Linked_Node_ID_xA: 'Philosophy-No Build Step',
            Hidden_Node_xB: 0,
            Hidden_Link_xB: 0,
            Link_Label_xB: 'enables',
            Link_Arrow_xB: 'To'
        }
    ];

    // Expose sample data to global namespace
    window.GraphApp.data = {
        sample: sampleData
    };

})(window);
