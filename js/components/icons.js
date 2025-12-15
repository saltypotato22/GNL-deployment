/**
 * Icon Components Library
 * Lucide-style icons using React.createElement
 * Matching Slim Gantt icon system
 */

(function(window) {
    'use strict';

    // Helper to create SVG element
    const createIcon = function(paths, props) {
        return React.createElement('svg', {
            xmlns: 'http://www.w3.org/2000/svg',
            width: props.size || 24,
            height: props.size || 24,
            viewBox: '0 0 24 24',
            fill: 'none',
            stroke: 'currentColor',
            strokeWidth: 2,
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
            className: props.className || ''
        }, paths);
    };

    // Upload icon
    const Upload = function(props) {
        return createIcon([
            React.createElement('path', {
                key: 'path1',
                d: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4'
            }),
            React.createElement('polyline', {
                key: 'path2',
                points: '17 8 12 3 7 8'
            }),
            React.createElement('line', {
                key: 'path3',
                x1: '12', y1: '3', x2: '12', y2: '15'
            })
        ], props);
    };

    // Download icon
    const Download = function(props) {
        return createIcon([
            React.createElement('path', {
                key: 'path1',
                d: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4'
            }),
            React.createElement('polyline', {
                key: 'path2',
                points: '7 10 12 15 17 10'
            }),
            React.createElement('line', {
                key: 'path3',
                x1: '12', y1: '15', x2: '12', y2: '3'
            })
        ], props);
    };

    // Plus icon
    const Plus = function(props) {
        return createIcon([
            React.createElement('line', {
                key: 'line1',
                x1: '12', y1: '5', x2: '12', y2: '19'
            }),
            React.createElement('line', {
                key: 'line2',
                x1: '5', y1: '12', x2: '19', y2: '12'
            })
        ], props);
    };

    // Trash icon
    const Trash2 = function(props) {
        return createIcon([
            React.createElement('polyline', {
                key: 'path1',
                points: '3 6 5 6 21 6'
            }),
            React.createElement('path', {
                key: 'path2',
                d: 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2'
            }),
            React.createElement('line', {
                key: 'line1',
                x1: '10', y1: '11', x2: '10', y2: '17'
            }),
            React.createElement('line', {
                key: 'line2',
                x1: '14', y1: '11', x2: '14', y2: '17'
            })
        ], props);
    };

    // Zoom In icon
    const ZoomIn = function(props) {
        return createIcon([
            React.createElement('circle', {
                key: 'circle',
                cx: '11', cy: '11', r: '8'
            }),
            React.createElement('line', {
                key: 'line1',
                x1: '21', y1: '21', x2: '16.65', y2: '16.65'
            }),
            React.createElement('line', {
                key: 'line2',
                x1: '11', y1: '8', x2: '11', y2: '14'
            }),
            React.createElement('line', {
                key: 'line3',
                x1: '8', y1: '11', x2: '14', y2: '11'
            })
        ], props);
    };

    // Zoom Out icon
    const ZoomOut = function(props) {
        return createIcon([
            React.createElement('circle', {
                key: 'circle',
                cx: '11', cy: '11', r: '8'
            }),
            React.createElement('line', {
                key: 'line1',
                x1: '21', y1: '21', x2: '16.65', y2: '16.65'
            }),
            React.createElement('line', {
                key: 'line2',
                x1: '8', y1: '11', x2: '14', y2: '11'
            })
        ], props);
    };

    // Info icon
    const Info = function(props) {
        return createIcon([
            React.createElement('circle', {
                key: 'circle',
                cx: '12', cy: '12', r: '10'
            }),
            React.createElement('line', {
                key: 'line1',
                x1: '12', y1: '16', x2: '12', y2: '12'
            }),
            React.createElement('line', {
                key: 'line2',
                x1: '12', y1: '8', x2: '12.01', y2: '8'
            })
        ], props);
    };

    // AlertCircle icon
    const AlertCircle = function(props) {
        return createIcon([
            React.createElement('circle', {
                key: 'circle',
                cx: '12', cy: '12', r: '10'
            }),
            React.createElement('line', {
                key: 'line1',
                x1: '12', y1: '8', x2: '12', y2: '12'
            }),
            React.createElement('line', {
                key: 'line2',
                x1: '12', y1: '16', x2: '12.01', y2: '16'
            })
        ], props);
    };

    // Settings icon
    const Settings = function(props) {
        return createIcon([
            React.createElement('circle', {
                key: 'circle',
                cx: '12', cy: '12', r: '3'
            }),
            React.createElement('path', {
                key: 'path',
                d: 'M12 1v6m0 6v6m5.66-17-3 5.2M6.34 15.8l-3 5.2m11.32-17 3 5.2M6.34 15.8l3 5.2M23 12h-6m-6 0H1m17.66 5.66-5.2-3M6.34 8.2l-5.2-3m17.32 11.32-3-5.2M6.34 8.2l-3-5.2'
            })
        ], props);
    };

    // Image icon (for PNG export)
    const Image = function(props) {
        return createIcon([
            React.createElement('rect', {
                key: 'rect',
                x: '3', y: '3', width: '18', height: '18', rx: '2', ry: '2'
            }),
            React.createElement('circle', {
                key: 'circle',
                cx: '8.5', cy: '8.5', r: '1.5'
            }),
            React.createElement('polyline', {
                key: 'polyline',
                points: '21 15 16 10 5 21'
            })
        ], props);
    };

    // File icon (for file operations)
    const File = function(props) {
        return createIcon([
            React.createElement('path', {
                key: 'path1',
                d: 'M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z'
            }),
            React.createElement('polyline', {
                key: 'path2',
                points: '13 2 13 9 20 9'
            })
        ], props);
    };

    // FileText icon (for Mermaid export)
    const FileText = function(props) {
        return createIcon([
            React.createElement('path', {
                key: 'path1',
                d: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z'
            }),
            React.createElement('polyline', {
                key: 'path2',
                points: '14 2 14 8 20 8'
            }),
            React.createElement('line', {
                key: 'line1',
                x1: '16', y1: '13', x2: '8', y2: '13'
            }),
            React.createElement('line', {
                key: 'line2',
                x1: '16', y1: '17', x2: '8', y2: '17'
            }),
            React.createElement('polyline', {
                key: 'line3',
                points: '10 9 9 9 8 9'
            })
        ], props);
    };

    // ArrowUp icon (for move row up)
    const ArrowUp = function(props) {
        return createIcon([
            React.createElement('line', {
                key: 'line',
                x1: '12', y1: '19', x2: '12', y2: '5'
            }),
            React.createElement('polyline', {
                key: 'arrow',
                points: '5 12 12 5 19 12'
            })
        ], props);
    };

    // ArrowDown icon (for move row down)
    const ArrowDown = function(props) {
        return createIcon([
            React.createElement('line', {
                key: 'line',
                x1: '12', y1: '5', x2: '12', y2: '19'
            }),
            React.createElement('polyline', {
                key: 'arrow',
                points: '19 12 12 19 5 12'
            })
        ], props);
    };

    // ChevronDown icon
    const ChevronDown = function(props) {
        return createIcon([
            React.createElement('polyline', {
                key: 'polyline',
                points: '6 9 12 15 18 9'
            })
        ], props);
    };

    // ChevronUp icon
    const ChevronUp = function(props) {
        return createIcon([
            React.createElement('polyline', {
                key: 'polyline',
                points: '6 15 12 9 18 15'
            })
        ], props);
    };

    // ChevronRight icon
    const ChevronRight = function(props) {
        return createIcon([
            React.createElement('polyline', {
                key: 'polyline',
                points: '9 18 15 12 9 6'
            })
        ], props);
    };

    // Maximize2 icon
    const Maximize2 = function(props) {
        return createIcon([
            React.createElement('polyline', {
                key: 'path1',
                points: '15 3 21 3 21 9'
            }),
            React.createElement('polyline', {
                key: 'path2',
                points: '9 21 3 21 3 15'
            }),
            React.createElement('line', {
                key: 'line1',
                x1: '21', y1: '3', x2: '14', y2: '10'
            }),
            React.createElement('line', {
                key: 'line2',
                x1: '3', y1: '21', x2: '10', y2: '14'
            })
        ], props);
    };

    // Link icon (for linking mode)
    const Link = function(props) {
        return createIcon([
            React.createElement('path', {
                key: 'path1',
                d: 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71'
            }),
            React.createElement('path', {
                key: 'path2',
                d: 'M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71'
            })
        ], props);
    };

    // X icon (for cancel)
    const X = function(props) {
        return createIcon([
            React.createElement('line', {
                key: 'line1',
                x1: '18', y1: '6', x2: '6', y2: '18'
            }),
            React.createElement('line', {
                key: 'line2',
                x1: '6', y1: '6', x2: '18', y2: '18'
            })
        ], props);
    };

    // Eye icon (for show/hide)
    const Eye = function(props) {
        return createIcon([
            React.createElement('path', {
                key: 'path1',
                d: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z'
            }),
            React.createElement('circle', {
                key: 'circle',
                cx: '12', cy: '12', r: '3'
            })
        ], props);
    };

    // EyeOff icon (for hide)
    const EyeOff = function(props) {
        return createIcon([
            React.createElement('path', {
                key: 'path1',
                d: 'M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24'
            }),
            React.createElement('line', {
                key: 'line',
                x1: '1', y1: '1', x2: '23', y2: '23'
            })
        ], props);
    };

    // RotateCcw icon (for undo)
    const RotateCcw = function(props) {
        return createIcon([
            React.createElement('polyline', {
                key: 'polyline',
                points: '1 4 1 10 7 10'
            }),
            React.createElement('path', {
                key: 'path',
                d: 'M3.51 15a9 9 0 1 0 2.13-9.36L1 10'
            })
        ], props);
    };

    // RotateCw icon (for redo)
    const RotateCw = function(props) {
        return createIcon([
            React.createElement('polyline', {
                key: 'polyline',
                points: '23 4 23 10 17 10'
            }),
            React.createElement('path', {
                key: 'path',
                d: 'M20.49 15a9 9 0 1 1-2.12-9.36L23 10'
            })
        ], props);
    };

    // Copy icon (for duplicate row)
    const Copy = function(props) {
        return createIcon([
            React.createElement('rect', {
                key: 'rect1',
                x: '9', y: '9', width: '13', height: '13', rx: '2', ry: '2'
            }),
            React.createElement('path', {
                key: 'path',
                d: 'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1'
            })
        ], props);
    };

    // Sparkles icon (for AI generate)
    const Sparkles = function(props) {
        return createIcon([
            React.createElement('path', {
                key: 'path1',
                d: 'M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z'
            }),
            React.createElement('path', {
                key: 'path2',
                d: 'M19 13l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3z'
            }),
            React.createElement('path', {
                key: 'path3',
                d: 'M5 17l.5 1.5L7 19l-1.5.5L5 21l-.5-1.5L3 19l1.5-.5L5 17z'
            })
        ], props);
    };

    // Panel layout icons - show split proportions
    // LayoutCanvasPriority: small table (left), big canvas (right)
    const LayoutCanvasPriority = function(props) {
        return React.createElement('svg', {
            xmlns: 'http://www.w3.org/2000/svg',
            width: props.size || 24,
            height: props.size || 24,
            viewBox: '0 0 24 24',
            fill: 'currentColor',
            stroke: 'none',
            className: props.className || ''
        }, [
            React.createElement('rect', {
                key: 'left',
                x: '3', y: '4', width: '4', height: '16', rx: '1'
            }),
            React.createElement('rect', {
                key: 'right',
                x: '9', y: '4', width: '12', height: '16', rx: '1'
            })
        ]);
    };

    // LayoutBalanced: equal panels
    const LayoutBalanced = function(props) {
        return React.createElement('svg', {
            xmlns: 'http://www.w3.org/2000/svg',
            width: props.size || 24,
            height: props.size || 24,
            viewBox: '0 0 24 24',
            fill: 'currentColor',
            stroke: 'none',
            className: props.className || ''
        }, [
            React.createElement('rect', {
                key: 'left',
                x: '3', y: '4', width: '8', height: '16', rx: '1'
            }),
            React.createElement('rect', {
                key: 'right',
                x: '13', y: '4', width: '8', height: '16', rx: '1'
            })
        ]);
    };

    // LayoutTablePriority: big table (left), small canvas (right)
    const LayoutTablePriority = function(props) {
        return React.createElement('svg', {
            xmlns: 'http://www.w3.org/2000/svg',
            width: props.size || 24,
            height: props.size || 24,
            viewBox: '0 0 24 24',
            fill: 'currentColor',
            stroke: 'none',
            className: props.className || ''
        }, [
            React.createElement('rect', {
                key: 'left',
                x: '3', y: '4', width: '12', height: '16', rx: '1'
            }),
            React.createElement('rect', {
                key: 'right',
                x: '17', y: '4', width: '4', height: '16', rx: '1'
            })
        ]);
    };

    // Link2 icon (chain icon for group chaining)
    const Link2 = function(props) {
        return createIcon([
            React.createElement('path', {
                key: 'path1',
                d: 'M9 17H7A5 5 0 0 1 7 7h2'
            }),
            React.createElement('path', {
                key: 'path2',
                d: 'M15 7h2a5 5 0 1 1 0 10h-2'
            }),
            React.createElement('line', {
                key: 'line',
                x1: '8', y1: '12', x2: '16', y2: '12'
            })
        ], props);
    };

    // Send icon (for chat input)
    const Send = function(props) {
        return createIcon([
            React.createElement('line', {
                key: 'line1',
                x1: '22', y1: '2', x2: '11', y2: '13'
            }),
            React.createElement('polygon', {
                key: 'polygon',
                points: '22 2 15 22 11 13 2 9 22 2'
            })
        ], props);
    };

    // Sun icon (for light mode indicator / switch to light)
    const Sun = function(props) {
        return createIcon([
            React.createElement('circle', {
                key: 'circle',
                cx: '12', cy: '12', r: '5'
            }),
            React.createElement('line', { key: 'ray1', x1: '12', y1: '1', x2: '12', y2: '3' }),
            React.createElement('line', { key: 'ray2', x1: '12', y1: '21', x2: '12', y2: '23' }),
            React.createElement('line', { key: 'ray3', x1: '4.22', y1: '4.22', x2: '5.64', y2: '5.64' }),
            React.createElement('line', { key: 'ray4', x1: '18.36', y1: '18.36', x2: '19.78', y2: '19.78' }),
            React.createElement('line', { key: 'ray5', x1: '1', y1: '12', x2: '3', y2: '12' }),
            React.createElement('line', { key: 'ray6', x1: '21', y1: '12', x2: '23', y2: '12' }),
            React.createElement('line', { key: 'ray7', x1: '4.22', y1: '19.78', x2: '5.64', y2: '18.36' }),
            React.createElement('line', { key: 'ray8', x1: '18.36', y1: '5.64', x2: '19.78', y2: '4.22' })
        ], props);
    };

    // Moon icon (for dark mode indicator / switch to dark)
    const Moon = function(props) {
        return createIcon([
            React.createElement('path', {
                key: 'path',
                d: 'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z'
            })
        ], props);
    };

    // Expose all icons to global namespace
    window.GraphApp.Icons = {
        Upload,
        Download,
        Plus,
        Trash2,
        ZoomIn,
        ZoomOut,
        Info,
        AlertCircle,
        Settings,
        Image,
        File,
        FileText,
        ArrowUp,
        ArrowDown,
        ChevronDown,
        ChevronUp,
        ChevronRight,
        Maximize2,
        Link,
        X,
        Eye,
        EyeOff,
        RotateCcw,
        RotateCw,
        Copy,
        Sparkles,
        Link2,
        Send,
        Sun,
        Moon,
        LayoutCanvasPriority,
        LayoutBalanced,
        LayoutTablePriority
    };

})(window);
