/**
 * Home Network Demo
 * Practical networking example with ISP, router, switch, and devices
 */
(function(window) {
    'use strict';

    const n = window.GraphApp.data.node;

    window.GraphApp.data.demos['Home Network'] = [
        n('ISP', 'Fiber Entry', 'ISP-ONT', 'fiber optic'),
        n('ISP', 'ONT', 'Network Core-Router WAN', 'Ethernet'),
        n('Network Core', 'Router WAN', 'Network Core-Router', 'Cat6'),
        n('Network Core', 'Router', 'Network Core-Switch', 'Ethernet'),
        n('Network Core', 'Switch', 'Wired Devices-Desktop', 'Cat6'),
        n('Network Core', 'WiFi AP', 'Wireless-MacBook', '5GHz'),
        n('Wired Devices', 'Desktop', 'Network Core-Switch', 'Cat6'),
        n('Wired Devices', 'NAS', 'Network Core-Switch', 'Cat6'),
        n('Wired Devices', 'Smart TV', 'Network Core-Switch', 'Cat6'),
        n('Wired Devices', 'Game Console', 'Network Core-Switch', 'Cat6'),
        n('Wireless', 'MacBook', '', ''),
        n('Wireless', 'iPhone', 'Network Core-WiFi AP', '5GHz'),
        n('Wireless', 'iPad', 'Network Core-WiFi AP', '5GHz'),
        n('Wireless', 'Work Laptop', 'Network Core-WiFi AP', '5GHz'),
        n('Smart Home', 'Hub', 'Network Core-Router', 'Ethernet'),
        n('Smart Home', 'Thermostat', 'Smart Home-Hub', 'Zigbee'),
        n('Smart Home', 'Door Lock', 'Smart Home-Hub', 'Zigbee'),
        n('Smart Home', 'Cameras', 'Smart Home-Hub', 'WiFi'),
        n('Smart Home', 'Light Switches', 'Smart Home-Hub', 'Zigbee'),
        n('Backup', 'UPS', 'Network Core-Router', 'power')
    ];

})(window);
