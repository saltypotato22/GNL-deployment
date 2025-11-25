/**
 * Sample Data Module
 * Multiple demos for Slim Graph
 */

(function(window) {
    'use strict';

    // Helper to create node objects
    const node = (group, nodeName, linkedTo, label) => ({
        Group_xA: group,
        Node_xA: nodeName,
        ID_xA: `${group}-${nodeName}`,
        Linked_Node_ID_xA: linkedTo || '',
        Hidden_Node_xB: 0,
        Hidden_Link_xB: 0,
        Link_Label_xB: label || '',
        Link_Arrow_xB: 'To'
    });

    // === QUICK TOUR (Default) - App feature overview ===
    const quickTour = [
        node('Data Format', 'Group Column', 'Data Format-Node Column', 'contains'),
        node('Data Format', 'Node Column', 'Data Format-Linked To', 'connects via'),
        node('Data Format', 'Linked To', '', ''),
        node('Data Format', 'Label', '', ''),
        node('Group Operations', 'Hide from Canvas', 'Canvas Features-Diagram Updates', 'eye icon'),
        node('Group Operations', 'Collapse in Table', '', ''),
        node('Group Operations', 'Show All Groups', '', ''),
        node('Group Operations', 'Clone Group', '', ''),
        node('Group Operations', 'Delete Entire Group', '', ''),
        node('Node Operations', 'Add New Row', '', ''),
        node('Node Operations', 'Delete Node', '', ''),
        node('Node Operations', 'Duplicate Row', '', ''),
        node('Node Operations', 'Click-to-Link', 'Node Operations-Add New Row', 'then click'),
        node('Node Operations', 'Clear Link', '', ''),
        node('Table Operations', 'Edit Any Cell', 'Canvas Features-Diagram Updates', 'click + type'),
        node('Table Operations', 'Sort by Column', '', ''),
        node('Table Operations', 'Undo and Redo', '', ''),
        node('Table Operations', 'Optimal Fit', '', ''),
        node('Canvas Features', 'Zoom In/Out', '', ''),
        node('Canvas Features', 'Pan Around', '', ''),
        node('Canvas Features', 'Toggle TB/LR', '', ''),
        node('Canvas Features', 'Fit to Screen', '', ''),
        node('Canvas Features', 'Diagram Updates', 'Data Format-Group Column', 'from table'),
        node('Top Menu', 'Import File', 'Data Format-Group Column', 'CSV or Excel'),
        node('Top Menu', 'Export Options', '', ''),
        node('Top Menu', 'Clear Table', '', ''),
        node('Top Menu', 'Help Button', '', ''),
        node('Top Menu', 'Load Example', '', '')
    ];

    // === HOME NETWORK - Practical networking example ===
    const homeNetwork = [
        node('ISP', 'Fiber Entry', 'ISP-ONT', 'fiber optic'),
        node('ISP', 'ONT', 'Network Core-Router WAN', 'Ethernet'),
        node('Network Core', 'Router WAN', 'Network Core-Router', 'Cat6'),
        node('Network Core', 'Router', 'Network Core-Switch', 'Ethernet'),
        node('Network Core', 'Switch', 'Wired Devices-Desktop', 'Cat6'),
        node('Network Core', 'WiFi AP', 'Wireless-MacBook', '5GHz'),
        node('Wired Devices', 'Desktop', 'Network Core-Switch', 'Cat6'),
        node('Wired Devices', 'NAS', 'Network Core-Switch', 'Cat6'),
        node('Wired Devices', 'Smart TV', 'Network Core-Switch', 'Cat6'),
        node('Wired Devices', 'Game Console', 'Network Core-Switch', 'Cat6'),
        node('Wireless', 'MacBook', '', ''),
        node('Wireless', 'iPhone', 'Network Core-WiFi AP', '5GHz'),
        node('Wireless', 'iPad', 'Network Core-WiFi AP', '5GHz'),
        node('Wireless', 'Work Laptop', 'Network Core-WiFi AP', '5GHz'),
        node('Smart Home', 'Hub', 'Network Core-Router', 'Ethernet'),
        node('Smart Home', 'Thermostat', 'Smart Home-Hub', 'Zigbee'),
        node('Smart Home', 'Door Lock', 'Smart Home-Hub', 'Zigbee'),
        node('Smart Home', 'Cameras', 'Smart Home-Hub', 'WiFi'),
        node('Smart Home', 'Light Switches', 'Smart Home-Hub', 'Zigbee'),
        node('Backup', 'UPS', 'Network Core-Router', 'power')
    ];

    // === INDUSTRIAL WIRING - PLC/Sensor wiring diagram ===
    const industrialWiring = [
        node('DC Backbone', '24V', '', ''),
        node('DC Backbone', '0V', '', ''),
        node('PLC Rack', '24V Feed', 'DC Backbone-24V', 'F01-Red'),
        node('PLC Rack', 'Ground', 'DC Backbone-0V', 'F01-Black'),
        node('PLC Rack', 'DO_Start', 'Motor 1-Start Trigger', 'W102'),
        node('PLC Rack', 'DI_Running', 'Motor 1-Status', 'W103'),
        node('PLC Rack', 'AI_Temperature', '', ''),
        node('Motor 1', '24V Supply', 'DC Backbone-24V', 'F02-Red'),
        node('Motor 1', 'Ground', 'DC Backbone-0V', 'F02-Black'),
        node('Motor 1', 'Start Trigger', '', ''),
        node('Motor 1', 'Status', '', ''),
        node('Sensor Array', 'Power +', 'DC Backbone-24V', 'F03-Red'),
        node('Sensor Array', 'Power -', 'DC Backbone-0V', 'F03-Black'),
        node('Sensor Array', 'Signal Out', 'PLC Rack-AI_Temperature', 'SIG-101')
    ];

    // Expose demos to global namespace
    window.GraphApp.data = {
        // Default demo (loads on startup)
        sample: quickTour,

        // All available demos
        demos: {
            'Quick Tour': quickTour,
            'Home Network': homeNetwork,
            'Industrial Wiring': industrialWiring
        }
    };

})(window);
