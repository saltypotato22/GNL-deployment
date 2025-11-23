/**
 * Slim Graph - Main Application
 * Network Diagram Visualizer
 * Matching Slim Gantt design system
 */

(function(window) {
    'use strict';

    function SlimGraphApp() {
        const { useState, useMemo, useEffect, useCallback, useRef } = React;

        // Get icons from namespace
        const { Upload, Download, Plus, Trash2, ZoomIn, ZoomOut, Info, AlertCircle, FileText, Image, File, Link, X, Eye, EyeOff, Maximize2, ChevronDown, ChevronRight, RotateCcw, RotateCw, Copy, LayoutCanvasPriority, LayoutBalanced, LayoutTablePriority } = window.GraphApp.Icons;

        // State Management
        const [nodes, setNodes] = useState([]);
        const [errors, setErrors] = useState([]);
        const [settings, setSettings] = useState({
            direction: 'TB', // TB, BT, LR, or RL
            zoom: 100,
            showTooltips: true,
            curve: 'basis' // basis (curved), linear (straight), or step (orthogonal)
        });
        const [sortColumn, setSortColumn] = useState(null);
        const [sortDirection, setSortDirection] = useState('asc');
        const [showExportModal, setShowExportModal] = useState(false);
        const [deleteConfirm, setDeleteConfirm] = useState(null);
        const [isRendering, setIsRendering] = useState(false);
        const [linkingMode, setLinkingMode] = useState({ active: false, targetRowIndex: null });
        const [showIDColumn, setShowIDColumn] = useState(false);
        const [hiddenGroups, setHiddenGroups] = useState(new Set());
        const [collapsedGroups, setCollapsedGroups] = useState(new Set());
        const [hideUnlinkedNodes, setHideUnlinkedNodes] = useState(false);
        const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
        const [isPanning, setIsPanning] = useState(false);
        const [panStart, setPanStart] = useState({ x: 0, y: 0 });
        const [prevDirection, setPrevDirection] = useState('TB');
        const [tablePanelWidth, setTablePanelWidth] = useState(
            parseInt(localStorage.getItem('tablePanelWidth')) || 33
        );
        const [isResizing, setIsResizing] = useState(false);

        // Refs
        const canvasRef = useRef(null);
        const fileInputRef = useRef(null);
        const panOffsetRef = useRef({ x: 0, y: 0 });
        const zoomRef = useRef(100);

        // History Manager for undo/redo
        const historyRef = useRef(new window.GraphApp.SnapshotHistory(50));
        const [canUndo, setCanUndo] = useState(false);
        const [canRedo, setCanRedo] = useState(false);

        // Keep refs in sync with state
        useEffect(() => {
            panOffsetRef.current = panOffset;
        }, [panOffset]);

        useEffect(() => {
            zoomRef.current = settings.zoom;
        }, [settings.zoom]);

        // Save table panel width to localStorage
        useEffect(() => {
            localStorage.setItem('tablePanelWidth', tablePanelWidth);
        }, [tablePanelWidth]);

        // Calculate incoming links count for each node
        const incomingLinksCount = useMemo(() => {
            const counts = {};
            nodes.forEach(node => {
                if (node.Linked_Node_ID_xA && !node.Hidden_Link_xB) {
                    const targetID = node.Linked_Node_ID_xA;
                    counts[targetID] = (counts[targetID] || 0) + 1;
                }
            });
            return counts;
        }, [nodes]);

        // Map errors to row indices for highlighting
        const errorRowMap = useMemo(() => {
            const map = {};

            errors.forEach(errorMsg => {
                // Parse "Row X: ..." errors
                const rowMatch = errorMsg.match(/Row (\d+)/);
                if (rowMatch) {
                    const rowIndex = parseInt(rowMatch[1]) - 1; // Convert to 0-based index
                    if (!map[rowIndex]) map[rowIndex] = [];
                    map[rowIndex].push(errorMsg);
                }

                // Handle "Duplicate ID: ..." errors - find all rows with this ID
                const dupMatch = errorMsg.match(/Duplicate ID: (.+)/);
                if (dupMatch) {
                    const dupID = dupMatch[1];
                    nodes.forEach((node, idx) => {
                        if (node.ID_xA === dupID) {
                            if (!map[idx]) map[idx] = [];
                            if (!map[idx].includes(errorMsg)) {
                                map[idx].push(errorMsg);
                            }
                        }
                    });
                }
            });

            return map;
        }, [errors, nodes]);

        // Load sample data on mount
        useEffect(() => {
            const sampleNodes = window.GraphApp.data.sample;
            setNodes(sampleNodes);

            // Validate on initial load
            const validationErrors = window.GraphApp.utils.validateNodes(sampleNodes);
            setErrors(validationErrors);

            // Initialize history with first state
            historyRef.current.push(sampleNodes);
            setCanUndo(historyRef.current.canUndo());
            setCanRedo(historyRef.current.canRedo());
        }, []);

        // Helper to save nodes to history
        const saveToHistory = useCallback((newNodes) => {
            historyRef.current.push(newNodes);
            setCanUndo(historyRef.current.canUndo());
            setCanRedo(historyRef.current.canRedo());
        }, []);

        // Undo function
        const handleUndo = useCallback(() => {
            const previousState = historyRef.current.undo();
            if (previousState) {
                setNodes(previousState);
                setCanUndo(historyRef.current.canUndo());
                setCanRedo(historyRef.current.canRedo());

                // Re-validate
                const validationErrors = window.GraphApp.utils.validateNodes(previousState);
                setErrors(validationErrors);
            }
        }, []);

        // Redo function
        const handleRedo = useCallback(() => {
            const nextState = historyRef.current.redo();
            if (nextState) {
                setNodes(nextState);
                setCanUndo(historyRef.current.canUndo());
                setCanRedo(historyRef.current.canRedo());

                // Re-validate
                const validationErrors = window.GraphApp.utils.validateNodes(nextState);
                setErrors(validationErrors);
            }
        }, []);

        // Keyboard shortcuts for undo/redo
        useEffect(() => {
            const handleKeyDown = (e) => {
                // Ctrl+Z or Cmd+Z for undo
                if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                    e.preventDefault();
                    handleUndo();
                }
                // Ctrl+Shift+Z or Cmd+Shift+Z or Ctrl+Y for redo
                if (((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) ||
                    ((e.ctrlKey || e.metaKey) && e.key === 'y')) {
                    e.preventDefault();
                    handleRedo();
                }
            };

            document.addEventListener('keydown', handleKeyDown);
            return () => document.removeEventListener('keydown', handleKeyDown);
        }, [handleUndo, handleRedo]);

        // Apply zoom and pan to diagram
        const applyTransform = useCallback((zoomPercent, panX, panY) => {
            const container = document.getElementById('mermaid-container');
            if (!container) return;

            const svg = container.querySelector('svg');
            if (svg) {
                const scale = zoomPercent / 100;
                svg.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
                svg.style.transformOrigin = '0 0'; // Top-left origin for simple math
            }
        }, []);

        // Fit diagram to screen with optimal zoom and centering
        const fitDiagramToScreen = useCallback(() => {
            const container = document.getElementById('mermaid-container');
            if (!container) return;

            const svg = container.querySelector('svg');
            if (!svg) return;

            try {
                // Get SVG's true content size from viewBox (never changes)
                const viewBox = svg.getAttribute('viewBox');
                let svgWidth, svgHeight;

                if (viewBox) {
                    const parts = viewBox.split(' ');
                    svgWidth = parseFloat(parts[2]);
                    svgHeight = parseFloat(parts[3]);
                } else {
                    // Fallback to attributes
                    svgWidth = parseFloat(svg.getAttribute('width')) || 800;
                    svgHeight = parseFloat(svg.getAttribute('height')) || 600;
                }

                // Reset transform before applying new one
                svg.style.transform = 'none';

                // Get container size
                const containerWidth = container.clientWidth;
                const containerHeight = container.clientHeight;

                // Leave 10% margin for breathing room
                const margin = 0.9;
                const availableWidth = containerWidth * margin;
                const availableHeight = containerHeight * margin;

                // Calculate zoom to fit
                const scaleX = availableWidth / svgWidth;
                const scaleY = availableHeight / svgHeight;
                const scale = Math.min(scaleX, scaleY);

                // Round to nearest 5% for clean values
                let fitZoom = Math.round(scale * 100 / 5) * 5;
                fitZoom = Math.max(10, Math.min(500, fitZoom));

                // Calculate pan to center (simple with top-left positioning)
                const finalScale = fitZoom / 100;
                const scaledWidth = svgWidth * finalScale;
                const scaledHeight = svgHeight * finalScale;

                const panX = (containerWidth - scaledWidth) / 2;
                const panY = (containerHeight - scaledHeight) / 2;

                // Apply
                setSettings({ ...settings, zoom: fitZoom });
                setPanOffset({ x: panX, y: panY });
                applyTransform(fitZoom, panX, panY);
            } catch (error) {
                console.error('Fit to screen failed:', error);
            }
        }, [settings, applyTransform]);

        // Render Mermaid diagram
        const renderDiagram = useCallback(async () => {
            setIsRendering(true);

            // Detect if direction changed
            const directionChanged = settings.direction !== prevDirection;

            try{
                const mermaidSyntax = window.GraphApp.core.generateMermaid(nodes, settings, hiddenGroups, hideUnlinkedNodes);
                await window.GraphApp.core.renderMermaid(mermaidSyntax, 'mermaid-container');

                // Position cluster labels at top-left corner (skip compact padding to preserve edges)
                setTimeout(() => {
                    // Position cluster labels at top-left corner
                    const clusters = document.querySelectorAll('#mermaid-container .cluster');
                    clusters.forEach(cluster => {
                        const rect = cluster.querySelector('rect');
                        const label = cluster.querySelector('.cluster-label');
                        if (rect && label) {
                            const rectBox = rect.getBBox();
                            const newX = rectBox.x + 10;
                            const newY = rectBox.y;
                            label.setAttribute('transform', `translate(${newX}, ${newY})`);
                        }
                    });
                }, 100);

                // If direction changed, auto-fit with slight delay for Mermaid to finish
                if (directionChanged) {
                    setPrevDirection(settings.direction);
                    setTimeout(() => {
                        fitDiagramToScreen();
                    }, 100);
                } else {
                    // Normal: reapply current zoom/pan
                    applyTransform(zoomRef.current, panOffsetRef.current.x, panOffsetRef.current.y);
                }

                setIsRendering(false);
            } catch (error) {
                console.error('Error rendering diagram:', error);
                setErrors([...errors, 'Failed to render diagram: ' + error.message]);
                setIsRendering(false);
            }
        }, [nodes, settings, hiddenGroups, hideUnlinkedNodes, applyTransform, fitDiagramToScreen, prevDirection]);

        // Render diagram when nodes or settings change
        useEffect(() => {
            if (nodes.length > 0) {
                renderDiagram();
            }
        // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [nodes, settings.direction, settings.curve, hiddenGroups, hideUnlinkedNodes]);

        // Zoom controls
        const handleZoomIn = useCallback(() => {
            const newZoom = Math.min(settings.zoom + 25, 500);
            setSettings({ ...settings, zoom: newZoom });
            applyTransform(newZoom, panOffset.x, panOffset.y);
        }, [settings, applyTransform, panOffset]);

        const handleZoomOut = useCallback(() => {
            const newZoom = Math.max(settings.zoom - 25, 10);
            setSettings({ ...settings, zoom: newZoom });
            applyTransform(newZoom, panOffset.x, panOffset.y);
        }, [settings, applyTransform, panOffset]);

        const handleResetZoom = useCallback(() => {
            setSettings({ ...settings, zoom: 100 });
            setPanOffset({ x: 0, y: 0 });
            applyTransform(100, 0, 0);
        }, [settings, applyTransform]);

        // Mouse wheel zoom
        const handleWheel = useCallback((e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -25 : 25;
            const newZoom = Math.max(10, Math.min(500, settings.zoom + delta));
            setSettings({ ...settings, zoom: newZoom });
            applyTransform(newZoom, panOffset.x, panOffset.y);
        }, [settings, applyTransform, panOffset]);

        // Pan controls
        const handleMouseDown = useCallback((e) => {
            if (e.button === 0) { // Left mouse button
                setIsPanning(true);
                setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
                e.currentTarget.style.cursor = 'grabbing';
            }
        }, [panOffset]);

        const handleMouseMove = useCallback((e) => {
            if (isPanning) {
                const newX = e.clientX - panStart.x;
                const newY = e.clientY - panStart.y;
                setPanOffset({ x: newX, y: newY });
                applyTransform(settings.zoom, newX, newY);
            }
        }, [isPanning, panStart, settings.zoom, applyTransform]);

        const handleMouseUp = useCallback((e) => {
            if (isPanning) {
                setIsPanning(false);
                e.currentTarget.style.cursor = 'grab';
            }
        }, [isPanning]);

        const handleMouseLeave = useCallback((e) => {
            if (isPanning) {
                setIsPanning(false);
                e.currentTarget.style.cursor = 'grab';
            }
        }, [isPanning]);

        // File upload handler
        const handleFileUpload = useCallback(async (event) => {
            const file = event.target.files[0];
            if (!file) return;

            const fileExt = file.name.split('.').pop().toLowerCase();

            try {
                let importedNodes = [];

                if (fileExt === 'xlsx' || fileExt === 'xls') {
                    importedNodes = await window.GraphApp.core.importExcel(file);
                } else if (fileExt === 'csv') {
                    importedNodes = await window.GraphApp.exports.importCSV(file);
                } else if (fileExt === 'mmd') {
                    importedNodes = await window.GraphApp.exports.importMermaid(file);
                } else {
                    alert('Unsupported file format. Please use .xlsx, .csv, or .mmd files.');
                    return;
                }

                setNodes(importedNodes);
                setErrors([]);

                // Validate imported data
                const validationErrors = window.GraphApp.utils.validateNodes(importedNodes);
                if (validationErrors.length > 0) {
                    setErrors(validationErrors);
                }

                // Reset file input
                if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                }
            } catch (error) {
                alert('Error importing file: ' + error.message);
                console.error(error);
            }
        }, []);

        // Add new node
        const handleAddNode = useCallback(() => {
            const newNode = {
                Group_xA: 'New Group',
                Node_xA: 'New Node',
                ID_xA: 'New Group-New Node',
                Linked_Node_ID_xA: '',
                Hidden_Node_xB: 0,
                Hidden_Link_xB: 0,
                Link_Label_xB: '',
                Link_Arrow_xB: 'To'
            };

            const newNodes = [...nodes, newNode];
            setNodes(newNodes);

            // Validate after adding
            const validationErrors = window.GraphApp.utils.validateNodes(newNodes);
            setErrors(validationErrors);

            // Save to history
            saveToHistory(newNodes);
        }, [nodes, saveToHistory]);

        // Delete node
        const handleDeleteNode = useCallback((index) => {
            const nodeToDelete = nodes[index];

            // Check if any nodes reference this one
            const referencingNodes = nodes.filter(n =>
                n.Linked_Node_ID_xA === nodeToDelete.ID_xA
            );

            // Always show confirmation, but with different styling/message for referenced nodes
            if (referencingNodes.length > 0) {
                setDeleteConfirm({
                    index,
                    message: `"${nodeToDelete.ID_xA}" is referenced by ${referencingNodes.length} node(s). Confirm delete?`,
                    isReferenced: true
                });
            } else {
                setDeleteConfirm({
                    index,
                    message: `"${nodeToDelete.ID_xA}". Confirm delete?`,
                    isReferenced: false
                });
            }
        }, [nodes]);

        // Duplicate node
        const handleDuplicateRow = useCallback((index) => {
            const nodeToDuplicate = nodes[index];
            const group = nodeToDuplicate.Group_xA;

            // Find unique name by appending "_?" until ID doesn't exist
            let newNodeName = nodeToDuplicate.Node_xA + '_?';
            let newID = `${group}-${newNodeName}`;

            while (nodes.some(n => n.ID_xA === newID)) {
                newNodeName += '_?';
                newID = `${group}-${newNodeName}`;
            }

            const duplicatedNode = {
                Group_xA: group,
                Node_xA: newNodeName,
                ID_xA: newID,
                Linked_Node_ID_xA: nodeToDuplicate.Linked_Node_ID_xA,
                Hidden_Node_xB: nodeToDuplicate.Hidden_Node_xB,
                Hidden_Link_xB: nodeToDuplicate.Hidden_Link_xB,
                Link_Label_xB: nodeToDuplicate.Link_Label_xB,
                Link_Arrow_xB: nodeToDuplicate.Link_Arrow_xB
            };

            // Insert the duplicated row right after the original
            const newNodes = [
                ...nodes.slice(0, index + 1),
                duplicatedNode,
                ...nodes.slice(index + 1)
            ];

            setNodes(newNodes);

            // Validate after duplication
            const validationErrors = window.GraphApp.utils.validateNodes(newNodes);
            setErrors(validationErrors);

            // Save to history
            saveToHistory(newNodes);
        }, [nodes, saveToHistory]);

        // Resize panel handlers
        const handleResizeMouseDown = useCallback(() => {
            setIsResizing(true);
        }, []);

        useEffect(() => {
            const handleMouseMove = (e) => {
                if (!isResizing) return;
                const container = document.querySelector('.flex.overflow-hidden');
                if (!container) return;
                const newWidth = (e.clientX / container.clientWidth) * 100;
                setTablePanelWidth(Math.max(20, Math.min(80, newWidth)));
            };

            const handleMouseUp = () => {
                setIsResizing(false);
            };

            if (isResizing) {
                document.addEventListener('mousemove', handleMouseMove);
                document.addEventListener('mouseup', handleMouseUp);
                return () => {
                    document.removeEventListener('mousemove', handleMouseMove);
                    document.removeEventListener('mouseup', handleMouseUp);
                };
            }
        }, [isResizing]);

        // Confirm delete
        const confirmDelete = useCallback(() => {
            if (deleteConfirm) {
                const newNodes = nodes.filter((_, i) => i !== deleteConfirm.index);
                setNodes(newNodes);
                setDeleteConfirm(null);

                // Validate after deletion
                const validationErrors = window.GraphApp.utils.validateNodes(newNodes);
                setErrors(validationErrors);

                // Save to history
                saveToHistory(newNodes);
            }
        }, [deleteConfirm, nodes, saveToHistory]);

        // Edit cell
        const handleCellEdit = useCallback((index, field, value) => {
            const newNodes = [...nodes];
            const oldNode = { ...newNodes[index] };
            newNodes[index][field] = value;

            // Auto-update ID if Group or Node changed AND track references
            if (field === 'Group_xA' || field === 'Node_xA') {
                const oldID = oldNode.ID_xA;
                const newID = window.GraphApp.utils.generateID(
                    newNodes[index].Group_xA,
                    newNodes[index].Node_xA
                );
                newNodes[index].ID_xA = newID;

                // Excel-style reference tracking: update all references to old ID
                if (oldID !== newID) {
                    newNodes.forEach((node, i) => {
                        if (node.Linked_Node_ID_xA === oldID) {
                            newNodes[i].Linked_Node_ID_xA = newID;
                        }
                    });
                }
            }

            setNodes(newNodes);

            // Revalidate
            const validationErrors = window.GraphApp.utils.validateNodes(newNodes);
            setErrors(validationErrors);

            // Save to history
            saveToHistory(newNodes);
        }, [nodes, saveToHistory]);

        // Linking mode handlers
        const enterLinkMode = useCallback((rowIndex) => {
            setLinkingMode({ active: true, targetRowIndex: rowIndex });
        }, []);

        const exitLinkMode = useCallback(() => {
            setLinkingMode({ active: false, targetRowIndex: null });
        }, []);

        const handleIDClick = useCallback((clickedRowIndex) => {
            if (!linkingMode.active) return;

            // Get the clicked node's ID
            const targetID = nodes[clickedRowIndex].ID_xA;

            // Set it in the linking cell
            handleCellEdit(linkingMode.targetRowIndex, 'Linked_Node_ID_xA', targetID);

            // Exit linking mode
            exitLinkMode();
        }, [linkingMode, nodes, handleCellEdit]);

        // Group visibility handlers
        const toggleGroup = useCallback((groupName) => {
            const newHiddenGroups = new Set(hiddenGroups);
            if (newHiddenGroups.has(groupName)) {
                newHiddenGroups.delete(groupName);
            } else {
                newHiddenGroups.add(groupName);
            }
            setHiddenGroups(newHiddenGroups);
        }, [hiddenGroups]);

        const toggleGroupCollapse = useCallback((groupName) => {
            const newCollapsedGroups = new Set(collapsedGroups);
            if (newCollapsedGroups.has(groupName)) {
                newCollapsedGroups.delete(groupName);
            } else {
                newCollapsedGroups.add(groupName);
            }
            setCollapsedGroups(newCollapsedGroups);
        }, [collapsedGroups]);

        const collapseAllGroups = useCallback(() => {
            // Get all unique group names
            const allGroups = new Set(nodes.map(n => n.Group_xA).filter(g => g));
            setCollapsedGroups(allGroups);
        }, [nodes]);

        const expandAllGroups = useCallback(() => {
            setCollapsedGroups(new Set());
        }, []);

        const showAllGroups = useCallback(() => {
            setHiddenGroups(new Set());
        }, []);

        const hideAllGroups = useCallback(() => {
            // Get all unique group names
            const allGroups = new Set(nodes.map(n => n.Group_xA).filter(g => g));
            setHiddenGroups(allGroups);
        }, [nodes]);

        // Sort table
        const handleSort = useCallback((column) => {
            const newDirection = sortColumn === column && sortDirection === 'asc' ? 'desc' : 'asc';
            setSortColumn(column);
            setSortDirection(newDirection);

            const sorted = window.GraphApp.utils.sortNodes(nodes, column, newDirection);
            setNodes(sorted);
        }, [nodes, sortColumn, sortDirection]);

        // Export handlers
        const handleExportCSV = useCallback(() => {
            window.GraphApp.exports.exportCSV(nodes, 'graph-data.csv');
            setShowExportModal(false);
        }, [nodes]);

        const handleExportExcel = useCallback(async () => {
            await window.GraphApp.core.exportExcel(nodes, 'graph-data.xlsx');
            setShowExportModal(false);
        }, [nodes]);

        const handleExportMermaid = useCallback(() => {
            const mermaidSyntax = window.GraphApp.core.generateMermaid(nodes, settings, hiddenGroups);
            window.GraphApp.exports.exportMermaid(mermaidSyntax, 'graph.mmd');
            setShowExportModal(false);
        }, [nodes, settings, hiddenGroups]);

        const handleExportPNG = useCallback(async () => {
            try {
                await window.GraphApp.exports.exportPNG('mermaid-container', 'graph.png');
                setShowExportModal(false);
            } catch (error) {
                alert('Error exporting PNG: ' + error.message);
            }
        }, []);

        const handleExportSVG = useCallback(() => {
            try {
                window.GraphApp.exports.exportSVG('mermaid-container', 'graph.svg');
                setShowExportModal(false);
            } catch (error) {
                alert('Error exporting SVG: ' + error.message);
            }
        }, []);

        const handleExportJSON = useCallback(() => {
            window.GraphApp.exports.exportJSON(nodes, 'graph-data.json');
            setShowExportModal(false);
        }, [nodes]);

        const handleExportGraphML = useCallback(() => {
            window.GraphApp.exports.exportGraphML(nodes, 'graph.graphml');
            setShowExportModal(false);
        }, [nodes]);

        const handleExportPDF = useCallback(async () => {
            try {
                await window.GraphApp.exports.exportPDF('mermaid-container', 'graph.pdf');
                setShowExportModal(false);
            } catch (error) {
                alert('Error exporting PDF: ' + error.message);
            }
        }, []);

        // Load example
        const loadExample = useCallback(() => {
            const sampleNodes = window.GraphApp.data.sample;
            setNodes(sampleNodes);

            // Validate example data
            const validationErrors = window.GraphApp.utils.validateNodes(sampleNodes);
            setErrors(validationErrors);
        }, []);

        // Render main UI
        return React.createElement('div', {
            className: "h-screen flex flex-col bg-gray-100 overflow-hidden"
        }, [
            // Toolbar
            React.createElement('div', {
                key: 'toolbar',
                className: "bg-white shadow-sm border-b"
            }, [
                React.createElement('div', {
                    key: 'toolbar-content',
                    className: "px-3 py-1.5"
                }, [
                    React.createElement('div', {
                        key: 'toolbar-flex',
                        className: "flex items-center gap-2"
                    }, [
                        // Title
                        React.createElement('div', {
                            key: 'title',
                            className: "flex items-center gap-2 mr-4"
                        }, [
                            React.createElement('h1', {
                                key: 'h1',
                                className: "text-lg font-semibold text-gray-800"
                            }, "Slim Graph")
                        ]),

                        // File operations
                        React.createElement('div', {
                            key: 'file-ops',
                            className: "flex gap-1"
                        }, [
                            React.createElement('label', {
                                key: 'import',
                                className: "flex items-center px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 cursor-pointer"
                            }, [
                                React.createElement(Upload, {
                                    key: 'icon',
                                    size: 12,
                                    className: "mr-1"
                                }),
                                "Import",
                                React.createElement('input', {
                                    key: 'input',
                                    ref: fileInputRef,
                                    type: "file",
                                    accept: ".csv,.xlsx,.xls,.mmd",
                                    onChange: handleFileUpload,
                                    className: "hidden"
                                })
                            ]),

                            React.createElement('button', {
                                key: 'add',
                                onClick: handleAddNode,
                                className: "flex items-center px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
                            }, [
                                React.createElement(Plus, {
                                    key: 'icon',
                                    size: 12,
                                    className: "mr-1"
                                }),
                                "Add Node"
                            ])
                        ]),

                        React.createElement('div', {
                            key: 'div1',
                            className: "w-px h-6 bg-gray-300"
                        }),

                        // Export button
                        React.createElement('button', {
                            key: 'export',
                            onClick: () => setShowExportModal(true),
                            disabled: nodes.length === 0,
                            className: `flex items-center px-2 py-1 text-xs rounded ${nodes.length > 0 ? 'bg-blue-500 text-white hover:bg-blue-600' : 'bg-gray-400 text-gray-200'}`
                        }, [
                            React.createElement(Download, {
                                key: 'icon',
                                size: 12,
                                className: "mr-1"
                            }),
                            "Export"
                        ]),

                        React.createElement('div', {
                            key: 'div-layout',
                            className: "w-px h-6 bg-gray-300"
                        }),

                        // Panel layout controls
                        React.createElement('div', {
                            key: 'panel-layout',
                            className: "flex items-center"
                        }, [
                            React.createElement('button', {
                                key: 'layout-canvas',
                                onClick: () => setTablePanelWidth(20),
                                className: `w-8 h-8 flex items-center justify-center ${tablePanelWidth <= 25 ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100 text-gray-600'}`,
                                title: "Maximize canvas (20% table)"
                            }, [
                                React.createElement(LayoutCanvasPriority, { size: 20 })
                            ]),
                            React.createElement('button', {
                                key: 'layout-balanced',
                                onClick: () => setTablePanelWidth(33),
                                className: `w-8 h-8 flex items-center justify-center ${tablePanelWidth > 25 && tablePanelWidth < 60 ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100 text-gray-600'}`,
                                title: "Balanced layout (33% table)"
                            }, [
                                React.createElement(LayoutBalanced, { size: 20 })
                            ]),
                            React.createElement('button', {
                                key: 'layout-table',
                                onClick: () => setTablePanelWidth(80),
                                className: `w-8 h-8 flex items-center justify-center ${tablePanelWidth >= 60 ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100 text-gray-600'}`,
                                title: "Maximize table (80% table)"
                            }, [
                                React.createElement(LayoutTablePriority, { size: 20 })
                            ])
                        ]),

                        // Example button (only when no data)
                        ...(nodes.length === 0 ? [
                            React.createElement('div', {
                                key: 'div2',
                                className: "w-px h-6 bg-gray-300"
                            }),
                            React.createElement('button', {
                                key: 'example',
                                onClick: loadExample,
                                className: "flex items-center px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600"
                            }, "Load Example")
                        ] : []),

                        React.createElement('div', {
                            key: 'div3',
                            className: "w-px h-6 bg-gray-300"
                        }),

                        // Direction selector
                        React.createElement('select', {
                            key: 'direction',
                            value: settings.direction,
                            onChange: (e) => setSettings({ ...settings, direction: e.target.value }),
                            className: "px-2 py-1 text-xs border border-gray-300 rounded",
                            title: "Graph direction"
                        }, [
                            React.createElement('option', { key: 'tb', value: 'TB' }, "↓ Top → Bottom"),
                            React.createElement('option', { key: 'bt', value: 'BT' }, "↑ Bottom → Top"),
                            React.createElement('option', { key: 'lr', value: 'LR' }, "→ Left → Right"),
                            React.createElement('option', { key: 'rl', value: 'RL' }, "← Right → Left")
                        ]),

                        React.createElement('div', {
                            key: 'div-curve-sep',
                            className: "w-px h-6 bg-gray-300"
                        }),

                        // Edge Style selector
                        React.createElement('select', {
                            key: 'curve-selector',
                            value: settings.curve,
                            onChange: (e) => setSettings({ ...settings, curve: e.target.value }),
                            className: "px-2 py-1 text-xs border border-gray-300 rounded",
                            title: "Edge style"
                        }, [
                            React.createElement('option', { key: 'basis', value: 'basis' }, "⌇ Curved"),
                            React.createElement('option', { key: 'linear', value: 'linear' }, "⟋ Straight"),
                            React.createElement('option', { key: 'step', value: 'step' }, "⊏ Orthogonal")
                        ]),

                        React.createElement('div', {
                            key: 'div4',
                            className: "w-px h-6 bg-gray-300"
                        }),

                        // Group visibility controls
                        React.createElement('div', {
                            key: 'group-visibility',
                            className: "flex items-center gap-1"
                        }, [
                            React.createElement('button', {
                                key: 'show-all',
                                onClick: showAllGroups,
                                className: "flex items-center gap-1 px-2 py-1 text-xs text-green-600 hover:bg-green-50 rounded",
                                title: "Show all groups"
                            }, [
                                React.createElement(Eye, { key: 'icon', size: 12 }),
                                'Show All'
                            ]),
                            React.createElement('button', {
                                key: 'hide-all',
                                onClick: hideAllGroups,
                                className: "flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded",
                                title: "Hide all groups"
                            }, [
                                React.createElement(EyeOff, { key: 'icon', size: 12 }),
                                'Hide All'
                            ])
                        ]),

                        React.createElement('div', {
                            key: 'div6',
                            className: "w-px h-6 bg-gray-300"
                        }),

                        // Zoom controls
                        React.createElement('div', {
                            key: 'zoom',
                            className: "flex items-center gap-1"
                        }, [
                            React.createElement('button', {
                                key: 'zoom-out',
                                onClick: handleZoomOut,
                                disabled: settings.zoom <= 10,
                                className: "p-1 hover:bg-gray-100 rounded disabled:opacity-50",
                                title: "Zoom out (10% min)"
                            }, [
                                React.createElement(ZoomOut, { size: 12 })
                            ]),
                            React.createElement('span', {
                                key: 'zoom-value',
                                className: "text-xs text-gray-600 w-14 text-center",
                                title: "Zoom level (10%-500%)"
                            }, settings.zoom + '%'),
                            React.createElement('button', {
                                key: 'zoom-in',
                                onClick: handleZoomIn,
                                disabled: settings.zoom >= 500,
                                className: "p-1 hover:bg-gray-100 rounded disabled:opacity-50",
                                title: "Zoom in (500% max)"
                            }, [
                                React.createElement(ZoomIn, { size: 12 })
                            ]),
                            React.createElement('button', {
                                key: 'fit-screen',
                                onClick: fitDiagramToScreen,
                                className: "px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center gap-1",
                                title: "Fit diagram to screen"
                            }, [
                                React.createElement(Maximize2, { key: 'icon', size: 12 }),
                                'Fit'
                            ]),
                            React.createElement('button', {
                                key: 'hide-unlinked',
                                onClick: () => setHideUnlinkedNodes(!hideUnlinkedNodes),
                                className: `px-2 py-1 text-xs rounded flex items-center gap-1 ${hideUnlinkedNodes ? 'bg-orange-500 text-white hover:bg-orange-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`,
                                title: hideUnlinkedNodes ? "Show all nodes (including unlinked)" : "Hide unlinked nodes from canvas"
                            }, [
                                React.createElement(hideUnlinkedNodes ? Eye : EyeOff, { key: 'icon', size: 12 }),
                                hideUnlinkedNodes ? 'Show Unlinked' : 'Hide Unlinked'
                            ])
                        ])
                    ])
                ])
            ]),

            // Linking mode banner
            ...(linkingMode.active ? [
                React.createElement('div', {
                    key: 'linking-banner',
                    className: "bg-blue-50 border-b border-blue-200 px-4 py-2"
                }, [
                    React.createElement('div', {
                        key: 'linking-message',
                        className: "flex items-center justify-between"
                    }, [
                        React.createElement('div', {
                            key: 'left',
                            className: "flex items-center gap-2 text-sm text-blue-800 font-semibold"
                        }, [
                            React.createElement(Link, { key: 'icon', size: 16 }),
                            React.createElement('span', { key: 'text' }, showIDColumn
                                ? 'Linking Mode Active - Click on any Node ID or Node name to create link'
                                : 'Linking Mode Active - Click on any Node name to create link')
                        ]),
                        React.createElement('button', {
                            key: 'cancel',
                            onClick: exitLinkMode,
                            className: "flex items-center gap-1 px-2 py-1 text-xs bg-gray-200 hover:bg-gray-300 rounded"
                        }, [
                            React.createElement(X, { key: 'icon', size: 12 }),
                            'Cancel'
                        ])
                    ])
                ])
            ] : []),

            // Error banner
            ...(errors.length > 0 ? [
                React.createElement('div', {
                    key: 'errors',
                    className: "bg-red-50 border-b border-red-200 px-4 py-2"
                }, [
                    React.createElement('div', {
                        key: 'error-title',
                        className: "flex items-center gap-2 text-sm text-red-800 font-semibold mb-1"
                    }, [
                        React.createElement(AlertCircle, { key: 'icon', size: 16 }),
                        React.createElement('span', { key: 'text' }, `${errors.length} Error(s) Found`)
                    ]),
                    React.createElement('ul', {
                        key: 'error-list',
                        className: "text-xs text-red-700 list-disc list-inside"
                    }, errors.map((error, i) =>
                        React.createElement('li', { key: i }, error)
                    ))
                ])
            ] : []),

            // Main content area
            React.createElement('div', {
                key: 'main-content',
                className: "flex-1 flex overflow-hidden"
            }, [
                // Left panel - Data table
                React.createElement('div', {
                    key: 'table-panel',
                    className: "bg-white border-r overflow-auto custom-scrollbar",
                    style: { width: `${tablePanelWidth}%` }
                }, nodes.length === 0 ?
                    // Empty state
                    React.createElement('div', {
                        key: 'empty',
                        className: "flex items-center justify-center h-full p-8"
                    }, [
                        React.createElement('div', {
                            key: 'content',
                            className: "text-center text-gray-500"
                        }, [
                            React.createElement('p', { key: 'p', className: "mb-4" },
                                "No data loaded. Import a file or load example to get started."),
                            React.createElement('button', {
                                key: 'btn',
                                onClick: loadExample,
                                className: "px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                            }, "Load Example")
                        ])
                    ]) :
                    // Data table
                    React.createElement('table', {
                        key: 'table',
                        className: "w-full text-sm"
                    }, [
                        React.createElement('thead', {
                            key: 'thead',
                            className: "sticky top-0 bg-gray-100 border-b-2 border-gray-300 z-10"
                        }, [
                            React.createElement('tr', { key: 'tr' }, [
                                React.createElement('th', {
                                    key: 'collapse',
                                    className: "px-2 py-2 text-xs font-semibold text-center cursor-pointer hover:bg-gray-100",
                                    title: "Click to Collapse/Expand All Groups",
                                    onClick: () => {
                                        // Toggle between collapse all and expand all
                                        if (collapsedGroups.size === 0) {
                                            collapseAllGroups();
                                        } else {
                                            expandAllGroups();
                                        }
                                    }
                                }, React.createElement(ChevronDown, { size: 14 })),
                                React.createElement('th', {
                                    key: 'visibility',
                                    className: "px-2 py-2 text-xs font-semibold text-center cursor-pointer hover:bg-gray-100",
                                    title: "Click to Show/Hide All Groups",
                                    onClick: () => {
                                        // Toggle between hide all and show all
                                        if (hiddenGroups.size === 0) {
                                            hideAllGroups();
                                        } else {
                                            showAllGroups();
                                        }
                                    }
                                }, React.createElement(Eye, { size: 14 })),
                                React.createElement('th', {
                                    key: 'group',
                                    onClick: () => handleSort('Group_xA'),
                                    className: "px-2 py-2 text-xs font-semibold text-left sortable-header"
                                }, [
                                    'Group ',
                                    sortColumn === 'Group_xA' && (sortDirection === 'asc' ? '▲' : '▼')
                                ]),
                                React.createElement('th', {
                                    key: 'node',
                                    onClick: () => handleSort('Node_xA'),
                                    className: "px-2 py-2 text-xs font-semibold text-left sortable-header"
                                }, [
                                    'Node ',
                                    sortColumn === 'Node_xA' && (sortDirection === 'asc' ? '▲' : '▼')
                                ]),
                                React.createElement('th', {
                                    key: 'links',
                                    className: "px-2 py-2 text-xs font-semibold text-center",
                                    title: "Number of incoming links to this node"
                                }, "→"),
                                ...(showIDColumn ? [
                                    React.createElement('th', {
                                        key: 'id',
                                        className: "px-2 py-2 text-xs font-semibold text-left"
                                    }, "ID")
                                ] : []),
                                React.createElement('th', {
                                    key: 'linked',
                                    className: "px-2 py-2 text-xs font-semibold text-left"
                                }, "Linked To"),
                                React.createElement('th', {
                                    key: 'label',
                                    className: "px-2 py-2 text-xs font-semibold text-left"
                                }, "Label"),
                                React.createElement('th', {
                                    key: 'duplicate',
                                    className: "px-2 py-2 text-xs font-semibold text-center"
                                }, ''),
                                React.createElement('th', {
                                    key: 'actions',
                                    className: "px-2 py-2 text-xs font-semibold text-center"
                                }, '')
                            ])
                        ]),
                        React.createElement('tbody', { key: 'tbody' },
                            nodes.filter((node, index) => {
                                // Show all rows if group is NOT collapsed
                                if (!collapsedGroups.has(node.Group_xA)) return true;

                                // If collapsed, only show the FIRST node of this group
                                const firstIndexOfGroup = nodes.findIndex(n => n.Group_xA === node.Group_xA);
                                return index === firstIndexOfGroup;
                            }).map((node, filteredIndex) => {
                                // Find original index for edit operations
                                const index = nodes.findIndex(n => n === node);
                                const isCollapsed = collapsedGroups.has(node.Group_xA);
                                const hasError = errorRowMap[index] && errorRowMap[index].length > 0;

                                return React.createElement('tr', {
                                    key: index,
                                    className: `border-b border-gray-200 hover:bg-gray-50 ${hasError ? 'bg-red-100 border-l-4 border-l-red-500' : ''}`,
                                    title: hasError ? errorRowMap[index].join('; ') : ''
                                }, [
                                    React.createElement('td', {
                                        key: 'collapse',
                                        className: "px-2 py-1 text-center"
                                    }, React.createElement('button', {
                                        onClick: () => toggleGroupCollapse(node.Group_xA),
                                        className: "p-1 rounded hover:bg-gray-100 text-gray-600",
                                        title: collapsedGroups.has(node.Group_xA) ? `Expand group "${node.Group_xA}"` : `Collapse group "${node.Group_xA}"`
                                    }, React.createElement(collapsedGroups.has(node.Group_xA) ? ChevronRight : ChevronDown, { size: 14 }))),
                                    React.createElement('td', {
                                        key: 'visibility',
                                        className: "px-2 py-1 text-center"
                                    }, React.createElement('button', {
                                        onClick: () => toggleGroup(node.Group_xA),
                                        className: `p-1 rounded hover:bg-gray-100 ${hiddenGroups.has(node.Group_xA) ? 'text-gray-400' : 'text-blue-600'}`,
                                        title: hiddenGroups.has(node.Group_xA) ? `Show group "${node.Group_xA}"` : `Hide group "${node.Group_xA}"`
                                    }, React.createElement(hiddenGroups.has(node.Group_xA) ? EyeOff : Eye, { size: 14 }))),
                                    React.createElement('td', {
                                        key: 'group',
                                        className: "px-2 py-1"
                                    }, React.createElement('input', {
                                        type: 'text',
                                        value: node.Group_xA,
                                        onChange: (e) => handleCellEdit(index, 'Group_xA', e.target.value),
                                        title: node.Group_xA,
                                        className: "w-full px-1 py-0.5 text-xs border border-gray-300 rounded table-input"
                                    })),
                                    React.createElement('td', {
                                        key: 'node',
                                        className: `px-2 py-1 ${linkingMode.active && !isCollapsed ? 'cursor-pointer hover:bg-blue-50 ring-2 ring-transparent hover:ring-blue-200' : ''} ${isCollapsed ? 'bg-gray-50' : ''}`,
                                        onClick: () => linkingMode.active && !isCollapsed && handleIDClick(index),
                                        title: linkingMode.active ? (isCollapsed ? 'Expand group to link' : 'Click to link') : (isCollapsed ? 'Collapsed group' : '')
                                    }, React.createElement('input', {
                                        type: 'text',
                                        value: isCollapsed ? '' : node.Node_xA,
                                        onChange: (e) => handleCellEdit(index, 'Node_xA', e.target.value),
                                        title: isCollapsed ? 'Collapsed group' : node.Node_xA,
                                        className: `w-full px-1 py-0.5 text-xs border border-gray-300 rounded table-input ${linkingMode.active ? 'pointer-events-none bg-blue-50 text-blue-700 font-semibold' : ''} ${isCollapsed ? 'bg-gray-50' : ''}`,
                                        readOnly: linkingMode.active || isCollapsed,
                                        placeholder: isCollapsed ? '(collapsed)' : ''
                                    })),
                                    React.createElement('td', {
                                        key: 'links',
                                        className: `px-2 py-1 text-center text-xs font-semibold ${(incomingLinksCount[node.ID_xA] || 0) > 0 ? 'text-green-600' : 'text-gray-400'}`,
                                        title: `${incomingLinksCount[node.ID_xA] || 0} node(s) link to this`
                                    }, incomingLinksCount[node.ID_xA] || 0),
                                    ...(showIDColumn ? [
                                        React.createElement('td', {
                                            key: 'id',
                                            className: `px-2 py-1 text-xs ${linkingMode.active && !isCollapsed ? 'cursor-pointer text-blue-600 hover:bg-blue-50 font-semibold' : isCollapsed ? 'text-gray-400' : 'text-gray-600'}`,
                                            onClick: () => !isCollapsed && handleIDClick(index),
                                            title: linkingMode.active ? (isCollapsed ? 'Expand group to link' : 'Click to link') : ''
                                        }, node.ID_xA)
                                    ] : []),
                                    React.createElement('td', {
                                        key: 'linked',
                                        className: "px-2 py-1"
                                    }, React.createElement('div', {
                                        className: `flex items-center gap-1 ${linkingMode.active && linkingMode.targetRowIndex === index ? 'ring-2 ring-blue-500 rounded' : ''} ${isCollapsed ? 'bg-gray-50' : ''}`
                                    }, [
                                        React.createElement('input', {
                                            key: 'input',
                                            type: 'text',
                                            value: isCollapsed ? '' : node.Linked_Node_ID_xA,
                                            onChange: (e) => handleCellEdit(index, 'Linked_Node_ID_xA', e.target.value),
                                            title: isCollapsed ? 'Collapsed group' : node.Linked_Node_ID_xA,
                                            className: `flex-1 px-1 py-0.5 text-xs border border-gray-300 rounded table-input ${isCollapsed ? 'bg-gray-50' : ''}`,
                                            disabled: (linkingMode.active && linkingMode.targetRowIndex === index) || isCollapsed,
                                            readOnly: isCollapsed
                                        }),
                                        // Clear button - shows when there's a value and not in linking mode
                                        ...(node.Linked_Node_ID_xA && !(linkingMode.active && linkingMode.targetRowIndex === index) ? [
                                            React.createElement('button', {
                                                key: 'clear',
                                                onClick: () => handleCellEdit(index, 'Linked_Node_ID_xA', ''),
                                                className: "p-0.5 text-gray-400 hover:text-red-500",
                                                title: "Clear link"
                                            }, React.createElement(X, { size: 14 }))
                                        ] : []),
                                        // Cancel or Link button
                                        linkingMode.active && linkingMode.targetRowIndex === index ?
                                            React.createElement('button', {
                                                key: 'cancel',
                                                onClick: exitLinkMode,
                                                className: "p-0.5 text-gray-500 hover:text-red-500",
                                                title: "Cancel linking"
                                            }, React.createElement(X, { size: 14 })) :
                                            React.createElement('button', {
                                                key: 'link',
                                                onClick: () => enterLinkMode(index),
                                                className: "p-0.5 text-blue-500 hover:text-blue-700",
                                                title: "Click to enter link mode"
                                            }, React.createElement(Link, { size: 14 }))
                                    ])),
                                    React.createElement('td', {
                                        key: 'label',
                                        className: `px-2 py-1 ${isCollapsed ? 'bg-gray-50' : ''}`
                                    }, React.createElement('input', {
                                        type: 'text',
                                        value: isCollapsed ? '' : (node.Link_Label_xB || ''),
                                        onChange: (e) => handleCellEdit(index, 'Link_Label_xB', e.target.value),
                                        title: isCollapsed ? 'Collapsed group' : (node.Link_Label_xB || ''),
                                        className: `w-full px-1 py-0.5 text-xs border border-gray-300 rounded table-input ${isCollapsed ? 'bg-gray-50' : ''}`,
                                        readOnly: isCollapsed
                                    })),
                                    React.createElement('td', {
                                        key: 'duplicate',
                                        className: "px-2 py-1 text-center"
                                    }, React.createElement('button', {
                                        onClick: () => handleDuplicateRow(index),
                                        className: "p-1 text-blue-500 hover:bg-blue-50 rounded",
                                        title: "Duplicate this row"
                                    }, React.createElement(Copy, { size: 14 }))),
                                    React.createElement('td', {
                                        key: 'actions',
                                        className: "px-2 py-1 text-center"
                                    }, React.createElement('button', {
                                        onClick: () => handleDeleteNode(index),
                                        className: "p-1 text-black hover:bg-red-50 rounded flex items-center gap-0.5"
                                    }, [
                                        React.createElement(Trash2, { key: 'icon', size: 14 }),
                                        // Show "*" for referenced nodes
                                        ...(incomingLinksCount[node.ID_xA] > 0 ? [
                                            React.createElement('span', {
                                                key: 'ref',
                                                className: "text-xs font-bold"
                                            }, '*')
                                        ] : [])
                                    ]))
                                ]);
                            })
                        )
                    ])
                ),

                // Resize handle
                React.createElement('div', {
                    key: 'resize-handle',
                    className: "resize-handle",
                    onMouseDown: handleResizeMouseDown,
                    title: "Drag to resize panels"
                }),

                // Right panel - Canvas
                React.createElement('div', {
                    key: 'canvas-panel',
                    className: `flex-1 bg-gray-50 overflow-auto custom-scrollbar relative ${isPanning ? 'panning' : ''}`,
                    style: { cursor: isPanning ? 'grabbing' : 'grab' },
                    ref: canvasRef,
                    onMouseDown: handleMouseDown,
                    onMouseMove: handleMouseMove,
                    onMouseUp: handleMouseUp,
                    onMouseLeave: handleMouseLeave,
                    onWheel: handleWheel
                }, [
                    isRendering && React.createElement('div', {
                        key: 'loading',
                        className: "absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 z-10"
                    }, [
                        React.createElement('div', {
                            key: 'spinner',
                            className: "spinner"
                        })
                    ]),

                    React.createElement('div', {
                        key: 'mermaid',
                        id: 'mermaid-container',
                        className: "w-full h-full flex items-center justify-center p-4"
                    })
                ])
            ]),

            // Export modal
            showExportModal && React.createElement('div', {
                key: 'export-modal',
                className: "fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center modal-overlay",
                onClick: () => setShowExportModal(false)
            }, React.createElement('div', {
                key: 'modal-content',
                className: "bg-white rounded-lg shadow-xl p-6 max-w-sm w-full mx-4",
                onClick: (e) => e.stopPropagation()
            }, [
                React.createElement('h3', {
                    key: 'title',
                    className: "text-lg font-semibold mb-4"
                }, "Export"),

                // Data Formats Section
                React.createElement('div', {
                    key: 'data-section',
                    className: "mb-3"
                }, [
                    React.createElement('div', {
                        key: 'data-label',
                        className: "text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide"
                    }, "Data"),
                    React.createElement('div', {
                        key: 'data-options',
                        className: "grid grid-cols-3 gap-1"
                    }, [
                        React.createElement('button', {
                            key: 'csv',
                            onClick: handleExportCSV,
                            className: "flex flex-col items-center px-2 py-2 text-center bg-gray-50 hover:bg-blue-50 rounded border border-gray-200 hover:border-blue-200"
                        }, [
                            React.createElement(FileText, { key: 'icon', size: 16, className: "mb-1 text-gray-600" }),
                            React.createElement('div', { key: 'name', className: "text-xs font-medium" }, "CSV")
                        ]),
                        React.createElement('button', {
                            key: 'excel',
                            onClick: handleExportExcel,
                            className: "flex flex-col items-center px-2 py-2 text-center bg-gray-50 hover:bg-blue-50 rounded border border-gray-200 hover:border-blue-200"
                        }, [
                            React.createElement(File, { key: 'icon', size: 16, className: "mb-1 text-green-600" }),
                            React.createElement('div', { key: 'name', className: "text-xs font-medium" }, "Excel")
                        ]),
                        React.createElement('button', {
                            key: 'json',
                            onClick: handleExportJSON,
                            className: "flex flex-col items-center px-2 py-2 text-center bg-gray-50 hover:bg-blue-50 rounded border border-gray-200 hover:border-blue-200"
                        }, [
                            React.createElement(FileText, { key: 'icon', size: 16, className: "mb-1 text-yellow-600" }),
                            React.createElement('div', { key: 'name', className: "text-xs font-medium" }, "JSON")
                        ])
                    ])
                ]),

                // Image Formats Section
                React.createElement('div', {
                    key: 'image-section',
                    className: "mb-3"
                }, [
                    React.createElement('div', {
                        key: 'image-label',
                        className: "text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide"
                    }, "Image"),
                    React.createElement('div', {
                        key: 'image-options',
                        className: "grid grid-cols-3 gap-1"
                    }, [
                        React.createElement('button', {
                            key: 'svg',
                            onClick: handleExportSVG,
                            className: "flex flex-col items-center px-2 py-2 text-center bg-gray-50 hover:bg-blue-50 rounded border border-gray-200 hover:border-blue-200"
                        }, [
                            React.createElement(Image, { key: 'icon', size: 16, className: "mb-1 text-purple-600" }),
                            React.createElement('div', { key: 'name', className: "text-xs font-medium" }, "SVG")
                        ]),
                        React.createElement('button', {
                            key: 'png',
                            onClick: handleExportPNG,
                            className: "flex flex-col items-center px-2 py-2 text-center bg-gray-50 hover:bg-blue-50 rounded border border-gray-200 hover:border-blue-200"
                        }, [
                            React.createElement(Image, { key: 'icon', size: 16, className: "mb-1 text-blue-600" }),
                            React.createElement('div', { key: 'name', className: "text-xs font-medium" }, "PNG")
                        ]),
                        React.createElement('button', {
                            key: 'pdf',
                            onClick: handleExportPDF,
                            className: "flex flex-col items-center px-2 py-2 text-center bg-gray-50 hover:bg-blue-50 rounded border border-gray-200 hover:border-blue-200"
                        }, [
                            React.createElement(FileText, { key: 'icon', size: 16, className: "mb-1 text-red-600" }),
                            React.createElement('div', { key: 'name', className: "text-xs font-medium" }, "PDF")
                        ])
                    ])
                ]),

                // Graph Formats Section
                React.createElement('div', {
                    key: 'graph-section',
                    className: "mb-3"
                }, [
                    React.createElement('div', {
                        key: 'graph-label',
                        className: "text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide"
                    }, "Graph Tools"),
                    React.createElement('div', {
                        key: 'graph-options',
                        className: "grid grid-cols-2 gap-1"
                    }, [
                        React.createElement('button', {
                            key: 'mermaid',
                            onClick: handleExportMermaid,
                            className: "flex flex-col items-center px-2 py-2 text-center bg-gray-50 hover:bg-blue-50 rounded border border-gray-200 hover:border-blue-200"
                        }, [
                            React.createElement(FileText, { key: 'icon', size: 16, className: "mb-1 text-pink-600" }),
                            React.createElement('div', { key: 'name', className: "text-xs font-medium" }, "Mermaid")
                        ]),
                        React.createElement('button', {
                            key: 'graphml',
                            onClick: handleExportGraphML,
                            className: "flex flex-col items-center px-2 py-2 text-center bg-gray-50 hover:bg-blue-50 rounded border border-gray-200 hover:border-blue-200"
                        }, [
                            React.createElement(FileText, { key: 'icon', size: 16, className: "mb-1 text-orange-600" }),
                            React.createElement('div', { key: 'name', className: "text-xs font-medium" }, "GraphML")
                        ])
                    ])
                ]),
                React.createElement('button', {
                    key: 'close',
                    onClick: () => setShowExportModal(false),
                    className: "mt-4 w-full px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                }, "Close")
            ])),

            // Delete confirmation modal
            deleteConfirm && React.createElement('div', {
                key: 'delete-modal',
                className: "fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center",
                onClick: () => setDeleteConfirm(null)
            }, React.createElement('div', {
                key: 'modal-content',
                className: `bg-white rounded-lg shadow-xl p-6 max-w-sm w-full mx-4 ${deleteConfirm.isReferenced ? 'border-2 border-red-500' : ''}`,
                onClick: (e) => e.stopPropagation()
            }, [
                React.createElement('h3', {
                    key: 'title',
                    className: `text-lg font-semibold mb-3 ${deleteConfirm.isReferenced ? 'text-red-600' : ''}`
                }, deleteConfirm.message),
                React.createElement('div', {
                    key: 'buttons',
                    className: "flex gap-3 justify-end mt-6"
                }, [
                    React.createElement('button', {
                        key: 'cancel',
                        onClick: () => setDeleteConfirm(null),
                        className: "px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                    }, "Cancel"),
                    React.createElement('button', {
                        key: 'confirm',
                        onClick: confirmDelete,
                        className: "px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                    }, "Delete")
                ])
            ]))
        ]);
    }

    // Mount app with error boundary
    window.addEventListener('DOMContentLoaded', () => {
        const container = document.getElementById('root');
        const root = ReactDOM.createRoot(container);
        const ErrorBoundary = window.GraphApp.components.ErrorBoundary;

        root.render(
            React.createElement(ErrorBoundary, null,
                React.createElement(SlimGraphApp)
            )
        );
    });

})(window);
