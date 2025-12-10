/**
 * Industrial Wiring Demo
 * PLC/Sensor wiring diagram example
 */
(function(window) {
    'use strict';

    const n = window.GraphApp.data.node;

    window.GraphApp.data.demos['Industrial Wiring'] = [
        n('DC Backbone', '24V', '', ''),
        n('DC Backbone', '0V', '', ''),
        n('PLC Rack', '24V Feed', 'DC Backbone-24V', 'F01-Red'),
        n('PLC Rack', 'Ground', 'DC Backbone-0V', 'F01-Black'),
        n('PLC Rack', 'DO_Start', 'Motor 1-Start Trigger', 'W102'),
        n('PLC Rack', 'DI_Running', 'Motor 1-Status', 'W103'),
        n('PLC Rack', 'AI_Temperature', '', ''),
        n('Motor 1', '24V Supply', 'DC Backbone-24V', 'F02-Red'),
        n('Motor 1', 'Ground', 'DC Backbone-0V', 'F02-Black'),
        n('Motor 1', 'Start Trigger', '', ''),
        n('Motor 1', 'Status', '', ''),
        n('Sensor Array', 'Power +', 'DC Backbone-24V', 'F03-Red'),
        n('Sensor Array', 'Power -', 'DC Backbone-0V', 'F03-Black'),
        n('Sensor Array', 'Signal Out', 'PLC Rack-AI_Temperature', 'SIG-101')
    ];

})(window);
