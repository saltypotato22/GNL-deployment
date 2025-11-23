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

    // ChevronDown icon
    const ChevronDown = function(props) {
        return createIcon([
            React.createElement('polyline', {
                key: 'polyline',
                points: '6 9 12 15 18 9'
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
        ChevronDown,
        ChevronRight,
        Maximize2,
        Link,
        X,
        Eye,
        EyeOff,
        RotateCcw,
        RotateCw,
        Copy,
        LayoutCanvasPriority,
        LayoutBalanced,
        LayoutTablePriority
    };

})(window);
