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
        const { Upload, Download, Plus, Trash2, ZoomIn, ZoomOut, Info, AlertCircle, FileText, Image, File, Link, X, Eye, EyeOff, Maximize2, ArrowUp, ArrowDown, ChevronDown, ChevronRight, RotateCcw, RotateCw, Copy, Sparkles, Send, Settings, LayoutCanvasPriority, LayoutBalanced, LayoutTablePriority } = window.GraphApp.Icons;

        // State Management - Load sample data by default
        const [nodes, setNodes] = useState(() => window.GraphApp.data.sample || []);
        const [errors, setErrors] = useState([]);
        const [settings, setSettings] = useState({
            direction: 'TB', // TB, BT, LR, or RL (used by compact layout)
            layout: 'fcose', // fcose (smart), compact-TB, compact-LR
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
        const [hideLinkedNodes, setHideLinkedNodes] = useState(false);
        const [hideLinks, setHideLinks] = useState(false);
        const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
        const [isPanning, setIsPanning] = useState(false);
        const [panStart, setPanStart] = useState({ x: 0, y: 0 });
        const [prevDirection, setPrevDirection] = useState('TB');
        const [prevHideUnlinked, setPrevHideUnlinked] = useState(false);
        const [tablePanelWidth, setTablePanelWidth] = useState(33); // Will be auto-calculated on load
        const [isResizing, setIsResizing] = useState(false);
        const [showReadmeModal, setShowReadmeModal] = useState(false);
        const [showHelpModal, setShowHelpModal] = useState(false);
        const [showDemoMenu, setShowDemoMenu] = useState(false);
        const [selectedRowIndex, setSelectedRowIndex] = useState(null);
        const [currentFileName, setCurrentFileName] = useState('');
        const [colWidths, setColWidths] = useState({
            Group_xA: 60,
            Node_xA: 60,
            ID_xA: 60,
            Linked_Node_ID_xA: 90,
            Link_Label_xB: 70
        });

        // AI Generate state
        const [showSettingsModal, setShowSettingsModal] = useState(false);
        const [apiKey, setApiKey] = useState(() => {
            try { return localStorage.getItem('anthropic_api_key') || ''; }
            catch { return ''; }
        });
        const [aiModel, setAiModel] = useState(() => {
            try { return localStorage.getItem('anthropic_model') || 'claude-sonnet-4-5-20250929'; }
            catch { return 'claude-sonnet-4-5-20250929'; }
        });
        const [showAIModal, setShowAIModal] = useState(false);
        const [aiPrompt, setAiPrompt] = useState('');
        const [aiLoading, setAiLoading] = useState(false);
        const [aiError, setAiError] = useState('');
        const [aiConversation, setAiConversation] = useState([]);
        // Format: [{ role: 'user'|'assistant', content: string, type: 'message'|'delta'|'full', timestamp: Date }]

        // AI Modal position and size (draggable/resizable)
        const [aiModalPos, setAiModalPos] = useState({ x: 100, y: 50 });
        const [aiModalSize, setAiModalSize] = useState({ width: 400, height: 500 });
        const [aiDragging, setAiDragging] = useState(false);
        const [aiResizing, setAiResizing] = useState(false);
        const aiDragStart = useRef({ x: 0, y: 0 });

        // Refs
        const canvasRef = useRef(null);
        const fileInputRef = useRef(null);
        const panOffsetRef = useRef({ x: 0, y: 0 });
        const zoomRef = useRef(100);
        const colWidthsRef = useRef(colWidths);

        // Utility: Calculate dynamic input size (min: 3 chars, max: 40 chars)
        const calcInputSize = useCallback((value, min = 3, max = 40) => {
            const len = (value || '').length;
            return Math.max(min, Math.min(max, len || min));
        }, []);

        // History Manager for undo/redo
        const historyRef = useRef(new window.GraphApp.SnapshotHistory(50));
        const [canUndo, setCanUndo] = useState(false);
        const [canRedo, setCanRedo] = useState(false);

        // Track first render to auto-fit on load
        const isFirstRenderRef = useRef(true);

        // Keep refs in sync with state
        useEffect(() => {
            panOffsetRef.current = panOffset;
        }, [panOffset]);

        useEffect(() => {
            zoomRef.current = settings.zoom;
        }, [settings.zoom]);

        useEffect(() => {
            colWidthsRef.current = colWidths;
        }, [colWidths]);

        // Close demo menu when clicking outside
        useEffect(() => {
            if (!showDemoMenu) return;
            const handleClick = (e) => {
                if (!e.target.closest('[data-demos-dropdown]')) {
                    setShowDemoMenu(false);
                }
            };
            document.addEventListener('click', handleClick);
            return () => document.removeEventListener('click', handleClick);
        }, [showDemoMenu]);

        // PERFORMANCE: O(1) lookup map for node IDs - used by multiple computations
        const nodeIdMap = useMemo(() => {
            const map = new Map();
            nodes.forEach((node, index) => {
                if (node.ID_xA) map.set(node.ID_xA, index);
            });
            return map;
        }, [nodes]);

        // PERFORMANCE: Pre-compute first index of each group for table filtering
        const groupFirstIndex = useMemo(() => {
            const map = new Map();
            nodes.forEach((node, index) => {
                if (!map.has(node.Group_xA)) {
                    map.set(node.Group_xA, index);
                }
            });
            return map;
        }, [nodes]);

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

        // Calculate which groups have external references - O(n) with nodeIdMap
        const groupsWithExternalRefs = useMemo(() => {
            const groups = new Set();
            nodes.forEach(sourceNode => {
                if (sourceNode.Linked_Node_ID_xA && !sourceNode.Hidden_Link_xB) {
                    // O(1) lookup instead of O(n) find()
                    const targetIndex = nodeIdMap.get(sourceNode.Linked_Node_ID_xA);
                    if (targetIndex !== undefined) {
                        const targetNode = nodes[targetIndex];
                        if (targetNode.Group_xA !== sourceNode.Group_xA) {
                            groups.add(targetNode.Group_xA);
                        }
                    }
                }
            });
            return groups;
        }, [nodes, nodeIdMap]);

        // Map errors to row indices for highlighting - O(n) with nodeIdMap
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

                // Handle "Duplicate ID: ..." errors - O(1) lookup instead of O(n) loop
                const dupMatch = errorMsg.match(/Duplicate ID: (.+)/);
                if (dupMatch) {
                    const dupID = dupMatch[1];
                    // Use nodeIdMap for O(1) lookup of first occurrence
                    const idx = nodeIdMap.get(dupID);
                    if (idx !== undefined) {
                        if (!map[idx]) map[idx] = [];
                        if (!map[idx].includes(errorMsg)) {
                            map[idx].push(errorMsg);
                        }
                    }
                    // Also find duplicates by scanning once (they share the same ID)
                    nodes.forEach((node, nodeIdx) => {
                        if (node.ID_xA === dupID && nodeIdx !== idx) {
                            if (!map[nodeIdx]) map[nodeIdx] = [];
                            if (!map[nodeIdx].includes(errorMsg)) {
                                map[nodeIdx].push(errorMsg);
                            }
                        }
                    });
                }
            });

            return map;
        }, [errors, nodes, nodeIdMap]);

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

        // Helper: Find group boundaries (first and last index of a group in nodes array)
        const getGroupBounds = useCallback((groupName) => {
            let start = -1, end = -1;
            nodes.forEach((node, i) => {
                if (node.Group_xA === groupName) {
                    if (start === -1) start = i;
                    end = i;
                }
            });
            return { start, end };
        }, [nodes]);

        // Move row up handler
        const handleMoveUp = useCallback(() => {
            if (selectedRowIndex === null || selectedRowIndex <= 0) return;

            const currentNode = nodes[selectedRowIndex];
            const isCollapsed = collapsedGroups.has(currentNode.Group_xA);

            if (isCollapsed) {
                // Move entire group up
                const groupName = currentNode.Group_xA;
                const { start, end } = getGroupBounds(groupName);
                if (start === 0) return; // Already at top

                // Find previous group's start
                const prevGroupName = nodes[start - 1].Group_xA;
                const prevBounds = getGroupBounds(prevGroupName);

                // Swap group blocks
                const newNodes = [...nodes];
                const currentGroup = newNodes.splice(start, end - start + 1);
                newNodes.splice(prevBounds.start, 0, ...currentGroup);

                setNodes(newNodes);
                saveToHistory(newNodes);
                setSelectedRowIndex(prevBounds.start); // Update selection to new position
            } else {
                // Move single node within group
                const { start } = getGroupBounds(currentNode.Group_xA);
                if (selectedRowIndex === start) return; // At top of group

                const newNodes = [...nodes];
                [newNodes[selectedRowIndex - 1], newNodes[selectedRowIndex]] =
                    [newNodes[selectedRowIndex], newNodes[selectedRowIndex - 1]];

                setNodes(newNodes);
                saveToHistory(newNodes);
                setSelectedRowIndex(selectedRowIndex - 1);
            }
        }, [selectedRowIndex, nodes, collapsedGroups, getGroupBounds, saveToHistory]);

        // Move row down handler
        const handleMoveDown = useCallback(() => {
            if (selectedRowIndex === null || selectedRowIndex >= nodes.length - 1) return;

            const currentNode = nodes[selectedRowIndex];
            const isCollapsed = collapsedGroups.has(currentNode.Group_xA);

            if (isCollapsed) {
                // Move entire group down
                const groupName = currentNode.Group_xA;
                const { start, end } = getGroupBounds(groupName);
                if (end === nodes.length - 1) return; // Already at bottom

                // Find next group's end
                const nextGroupName = nodes[end + 1].Group_xA;
                const nextBounds = getGroupBounds(nextGroupName);

                // Swap group blocks
                const newNodes = [...nodes];
                const nextGroup = newNodes.splice(nextBounds.start, nextBounds.end - nextBounds.start + 1);
                newNodes.splice(start, 0, ...nextGroup);

                setNodes(newNodes);
                saveToHistory(newNodes);
                setSelectedRowIndex(start + nextGroup.length); // Update selection
            } else {
                // Move single node within group
                const { end } = getGroupBounds(currentNode.Group_xA);
                if (selectedRowIndex === end) return; // At bottom of group

                const newNodes = [...nodes];
                [newNodes[selectedRowIndex], newNodes[selectedRowIndex + 1]] =
                    [newNodes[selectedRowIndex + 1], newNodes[selectedRowIndex]];

                setNodes(newNodes);
                saveToHistory(newNodes);
                setSelectedRowIndex(selectedRowIndex + 1);
            }
        }, [selectedRowIndex, nodes, collapsedGroups, getGroupBounds, saveToHistory]);

        // Compute disabled states for move buttons
        const canMoveUp = useMemo(() => {
            if (selectedRowIndex === null || selectedRowIndex <= 0) return false;
            const currentNode = nodes[selectedRowIndex];
            if (!currentNode) return false;
            const isCollapsed = collapsedGroups.has(currentNode.Group_xA);

            if (isCollapsed) {
                const { start } = getGroupBounds(currentNode.Group_xA);
                return start > 0;
            } else {
                const { start } = getGroupBounds(currentNode.Group_xA);
                return selectedRowIndex > start;
            }
        }, [selectedRowIndex, nodes, collapsedGroups, getGroupBounds]);

        const canMoveDown = useMemo(() => {
            if (selectedRowIndex === null || selectedRowIndex >= nodes.length - 1) return false;
            const currentNode = nodes[selectedRowIndex];
            if (!currentNode) return false;
            const isCollapsed = collapsedGroups.has(currentNode.Group_xA);

            if (isCollapsed) {
                const { end } = getGroupBounds(currentNode.Group_xA);
                return end < nodes.length - 1;
            } else {
                const { end } = getGroupBounds(currentNode.Group_xA);
                return selectedRowIndex < end;
            }
        }, [selectedRowIndex, nodes, collapsedGroups, getGroupBounds]);

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

        // Escape key handler for modals and linking mode
        useEffect(() => {
            const handleEscape = (e) => {
                if (e.key === 'Escape') {
                    setShowExportModal(false);
                    setDeleteConfirm(null);
                    setShowHelpModal(false);
                    setShowReadmeModal(false);
                    setLinkingMode({ active: false, targetRowIndex: null });
                }
            };

            document.addEventListener('keydown', handleEscape);
            return () => document.removeEventListener('keydown', handleEscape);
        }, []);

        // Compute column widths dynamically based on content
        useEffect(() => {
            // Debounce to avoid jitter during rapid edits
            const timeoutId = setTimeout(() => {
                if (nodes.length > 0) {
                    const newWidths = window.GraphApp.utils.computeColumnWidths(nodes, showIDColumn);
                    setColWidths(newWidths);
                }
            }, 50);

            return () => clearTimeout(timeoutId);
        }, [nodes, showIDColumn]);

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
            // Use Cytoscape's native fit method
            window.GraphApp.core.fitCytoscapeToScreen(40);

            // Update zoom state to reflect actual Cytoscape zoom
            const currentZoom = window.GraphApp.core.getCytoscapeZoom();
            setSettings(prev => ({ ...prev, zoom: currentZoom }));
            setPanOffset({ x: 0, y: 0 });
        }, []);

        // Render diagram using Cytoscape
        const renderDiagram = useCallback(async () => {
            setIsRendering(true);

            // Detect if hide-unlinked changed (requires fit to screen)
            const hideUnlinkedChanged = hideUnlinkedNodes !== prevHideUnlinked;
            const isFirstRender = isFirstRenderRef.current;
            const needsFitToScreen = hideUnlinkedChanged || isFirstRender;

            // Clear first render flag
            if (isFirstRender) {
                isFirstRenderRef.current = false;
            }

            try {
                // Render using Cytoscape (incremental layout - existing nodes keep positions)
                window.GraphApp.core.renderCytoscape(
                    nodes,
                    settings,
                    hiddenGroups,
                    hideUnlinkedNodes,
                    hideLinkedNodes,
                    hideLinks,
                    'mermaid-container'
                );

                // Update tracking state
                if (hideUnlinkedChanged) {
                    setPrevHideUnlinked(hideUnlinkedNodes);
                }

                // Fit to screen on first render or major changes
                if (needsFitToScreen) {
                    setTimeout(() => {
                        window.GraphApp.core.fitCytoscapeToScreen(40);
                        // Sync zoom state with actual Cytoscape zoom
                        const currentZoom = window.GraphApp.core.getCytoscapeZoom();
                        setSettings(prev => ({ ...prev, zoom: currentZoom }));
                    }, 350); // After layout animation completes
                }

                setIsRendering(false);
            } catch (error) {
                console.error('Error rendering diagram:', error);
                setErrors(prev => [...prev, 'Failed to render diagram: ' + error.message]);
                setIsRendering(false);
            }
        }, [nodes, settings, hiddenGroups, hideUnlinkedNodes, hideLinkedNodes, hideLinks, prevHideUnlinked]);

        // PERFORMANCE: Debounce diagram rendering (300ms) - table stays responsive
        useEffect(() => {
            if (nodes.length > 0) {
                const timeoutId = setTimeout(() => {
                    renderDiagram();
                }, 300);
                return () => clearTimeout(timeoutId);
            }
        // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [nodes, settings.direction, settings.curve, hiddenGroups, hideUnlinkedNodes, hideLinkedNodes, hideLinks]);

        // Zoom controls - use Cytoscape's built-in zoom
        const handleZoomIn = useCallback(() => {
            const cy = window.GraphApp.core.getCytoscapeInstance();
            if (cy) {
                const currentZoom = cy.zoom();
                const newZoom = Math.min(currentZoom * 1.25, 5);
                cy.zoom(newZoom);
                setSettings(prev => ({ ...prev, zoom: Math.round(newZoom * 100) }));
            }
        }, []);

        const handleZoomOut = useCallback(() => {
            const cy = window.GraphApp.core.getCytoscapeInstance();
            if (cy) {
                const currentZoom = cy.zoom();
                const newZoom = Math.max(currentZoom * 0.8, 0.1);
                cy.zoom(newZoom);
                setSettings(prev => ({ ...prev, zoom: Math.round(newZoom * 100) }));
            }
        }, []);

        const handleResetZoom = useCallback(() => {
            window.GraphApp.core.fitCytoscapeToScreen(40);
            // Sync zoom state with actual Cytoscape zoom
            const currentZoom = window.GraphApp.core.getCytoscapeZoom();
            setSettings(prev => ({ ...prev, zoom: currentZoom }));
            setPanOffset({ x: 0, y: 0 });
        }, []);

        // Mouse wheel zoom is handled by Cytoscape natively
        const handleWheel = useCallback((e) => {
            // Cytoscape handles wheel zoom internally
            // Just update our state to match
            const cy = window.GraphApp.core.getCytoscapeInstance();
            if (cy) {
                setSettings(prev => ({ ...prev, zoom: Math.round(cy.zoom() * 100) }));
            }
        }, []);

        // Pan controls - Cytoscape handles panning natively via drag
        // These handlers are no-ops but kept for compatibility
        const handleMouseDown = useCallback((e) => {
            // Cytoscape handles pan via native drag
        }, []);

        const handleMouseMove = useCallback((e) => {
            // Cytoscape handles pan via native drag
        }, []);

        const handleMouseUp = useCallback((e) => {
            // Cytoscape handles pan via native drag
        }, []);

        // Calculate optimal table width to fit all content without truncation
        const calculateOptimalTableWidth = useCallback(() => {
            // Sum fixed icon column widths (px)
            const fixedColumnsWidth = 30 + 32 + 32 + 28 + 32 + 32; // Row#, Collapse, Visibility, Links, Duplicate, Delete

            // Use ref to get latest colWidths (avoids stale closure)
            const currentColWidths = colWidthsRef.current;

            // Sum dynamic text column widths from state
            const textColumnsWidth =
                currentColWidths.Group_xA +
                currentColWidths.Node_xA +
                (showIDColumn ? currentColWidths.ID_xA : 0) +
                currentColWidths.Linked_Node_ID_xA +
                currentColWidths.Link_Label_xB;

            // Add buffer for table padding, margins, scrollbar
            const tablePadding = 40;

            // Calculate minimum table width needed
            const minTableWidth = fixedColumnsWidth + textColumnsWidth + tablePadding;

            // Get viewport width
            const viewportWidth = window.innerWidth;

            // Calculate percentage
            let percentage = Math.round((minTableWidth / viewportWidth) * 100);

            // Clamp between 20% and 80%
            percentage = Math.max(20, Math.min(80, percentage));

            setTablePanelWidth(percentage);
        }, [showIDColumn]); // Uses colWidthsRef instead of colWidths to avoid stale closures

        // Auto-calculate optimal table width on initial load
        const hasAutoFitRef = useRef(false);
        useEffect(() => {
            // Run once when we have data, with a small delay to ensure DOM is ready
            if (!hasAutoFitRef.current && nodes.length > 0) {
                hasAutoFitRef.current = true;
                // Use requestAnimationFrame + setTimeout to ensure layout is complete
                requestAnimationFrame(() => {
                    setTimeout(() => {
                        calculateOptimalTableWidth();
                    }, 100);
                });
            }
        }, [nodes.length, calculateOptimalTableWidth]);

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

                // Clear Cytoscape positions for fresh layout on new file
                window.GraphApp.core.clearCytoscapePositions();
                isFirstRenderRef.current = true;

                setNodes(importedNodes);
                setErrors([]);
                setCurrentFileName(file.name);

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

        // ============================================================================
        // AI CHAT FEATURE - Iterative Graph Editing via Claude API
        // ============================================================================
        // Features:
        // - Chat-style interface with conversation history
        // - Three response types: Full CSV (new graphs), Delta Ops (edits), Messages (Q&A)
        // - Token-efficient context: Full CSV for ≤30 nodes, summary for larger graphs
        // - Draggable/resizable modal window
        // - Delta operations: ADD, DELETE, UPDATE, RENAME_GROUP, CONNECT, DISCONNECT
        // ============================================================================

        /**
         * AI System Prompt - Defines schema, operations, and conversation behavior
         * {CONTEXT} placeholder is replaced with current graph state before each API call
         */
        const AI_SYSTEM_PROMPT = `You are a graph diagram assistant. You help users create, modify, and understand node-link diagrams.

DATA SCHEMA:
- Group_xA: Container/equipment name (e.g., "Router", "PLC Rack")
- Node_xA: Item within the group (e.g., "WAN Port", "24V Feed")
- ID_xA: Unique identifier in format "Group-Node" (auto-generated)
- Linked_Node_ID_xA: Target node ID to connect to (format: "Group-Node")
- Link_Label_xB: Optional connection label (e.g., "Ethernet", "F01-Red")

CURRENT GRAPH:
{CONTEXT}

RESPONSE FORMATS:

1. For SIMPLE changes (add/delete/rename/connect), use JSON operations:
\`\`\`json
{"operations": [...], "summary": "Brief description of changes"}
\`\`\`

Available operations:
- ADD: {"op": "ADD", "nodes": [{"Group_xA": "...", "Node_xA": "...", "Linked_Node_ID_xA": "...", "Link_Label_xB": "..."}]}
- DELETE: {"op": "DELETE", "ids": ["Group-Node1", "Group-Node2"]}
- UPDATE: {"op": "UPDATE", "id": "Group-Node", "changes": {"Node_xA": "NewName", "Link_Label_xB": "NewLabel"}}
- RENAME_GROUP: {"op": "RENAME_GROUP", "from": "OldGroup", "to": "NewGroup"}
- CONNECT: {"op": "CONNECT", "from": "SourceGroup-Node", "to": "TargetGroup-Node", "label": "optional label"}
- DISCONNECT: {"op": "DISCONNECT", "id": "Group-Node"}

2. For NEW GRAPHS or COMPLEX transformations, output full CSV:
\`\`\`csv
Group_xA,Node_xA,Linked_Node_ID_xA,Link_Label_xB
Router,WAN,,
Router,LAN,Switch-Uplink,Ethernet
...
\`\`\`

3. For QUESTIONS, EXPLANATIONS, or CONVERSATION, respond with plain text (no code blocks).

WHEN TO ASK vs ACT:
- ASK when the request is ambiguous (e.g., "add a server" - which group should it go in?)
- ASK when multiple nodes could match (e.g., "rename Server" but 3 nodes contain "Server")
- EXPLAIN when user asks about the graph (e.g., "what's connected to the router?")
- CONFIRM before large deletions (5+ nodes) - describe what will be deleted and ask for confirmation
- ACT directly when the request is clear and specific

IMPORTANT RULES:
- Every Linked_Node_ID_xA must reference an existing ID (format: "Group-Node")
- When generating full CSV, every node needs its own row (even orphan nodes with no links)
- If a node has multiple connections, include only the primary one
- Be helpful and conversational - you can discuss the graph, suggest improvements, or answer questions`;

        /**
         * Parse AI response into structured format
         * @param {string} text - Raw response from Claude API
         * @returns {Object} Parsed response: { type: 'full'|'delta'|'message', ... }
         *   - type: 'full' → { csv: string, summary: string } - Full graph replacement
         *   - type: 'delta' → { operations: Array, summary: string } - Incremental edits
         *   - type: 'message' → { content: string } - Conversational response
         */
        const parseAIResponse = useCallback((text) => {
            // Try JSON operations first (delta mode)
            const jsonMatch = text.match(/```(?:json)?\n([\s\S]*?)\n```/);
            if (jsonMatch) {
                try {
                    const parsed = JSON.parse(jsonMatch[1]);
                    if (parsed.operations && Array.isArray(parsed.operations)) {
                        return {
                            type: 'delta',
                            operations: parsed.operations,
                            summary: parsed.summary || 'Applied changes'
                        };
                    }
                } catch (e) {
                    // Not valid JSON, fall through to CSV check
                }
            }

            // Try CSV (full replacement mode)
            const csvMatch = text.match(/```(?:csv)?\n([\s\S]*?)\n```/);
            if (csvMatch) {
                return {
                    type: 'full',
                    csv: csvMatch[1].trim(),
                    summary: 'Generated graph'
                };
            }

            // Fallback: look for CSV-like content without code blocks
            const lines = text.split('\n');
            const csvLines = lines.filter(line =>
                line.includes('Group_xA') ||
                (line.includes(',') && !line.startsWith('#') && !line.startsWith('{'))
            );
            if (csvLines.length > 1) {
                return {
                    type: 'full',
                    csv: csvLines.join('\n'),
                    summary: 'Generated graph'
                };
            }

            // No code blocks = conversational message (questions, explanations, etc.)
            return {
                type: 'message',
                content: text.trim()
            };
        }, []);

        /**
         * Apply delta operations to node array (immutably)
         * Supports: ADD, DELETE, UPDATE, RENAME_GROUP, CONNECT, DISCONNECT
         * Automatically maintains referential integrity (updates Linked_Node_ID_xA when IDs change)
         * @param {Array} operations - Array of operation objects
         * @param {Array} currentNodes - Current node array
         * @returns {Object} { nodes: Array, changes: Array<string> } - Updated nodes and change log
         */
        const applyDeltaOperations = useCallback((operations, currentNodes) => {
            let newNodes = currentNodes.map(n => ({ ...n })); // Clone all nodes
            const changes = [];

            operations.forEach(op => {
                switch (op.op) {
                    case 'ADD':
                        if (op.nodes && Array.isArray(op.nodes)) {
                            op.nodes.forEach(node => {
                                const newNode = {
                                    Group_xA: node.Group_xA || '',
                                    Node_xA: node.Node_xA || '',
                                    ID_xA: `${node.Group_xA}-${node.Node_xA}`,
                                    Linked_Node_ID_xA: node.Linked_Node_ID_xA || '',
                                    Link_Label_xB: node.Link_Label_xB || '',
                                    Hidden_Node_xB: 0,
                                    Hidden_Link_xB: 0,
                                    Link_Arrow_xB: 'To'
                                };
                                newNodes.push(newNode);
                                changes.push(`Added ${newNode.ID_xA}`);
                            });
                        }
                        break;

                    case 'DELETE':
                        if (op.ids && Array.isArray(op.ids)) {
                            const idsToDelete = new Set(op.ids);
                            const beforeCount = newNodes.length;
                            newNodes = newNodes.filter(n => !idsToDelete.has(n.ID_xA));
                            // Clear references to deleted nodes
                            newNodes.forEach(n => {
                                if (idsToDelete.has(n.Linked_Node_ID_xA)) {
                                    n.Linked_Node_ID_xA = '';
                                }
                            });
                            changes.push(`Deleted ${beforeCount - newNodes.length} node(s)`);
                        }
                        break;

                    case 'UPDATE':
                        if (op.id && op.changes) {
                            const idx = newNodes.findIndex(n => n.ID_xA === op.id);
                            if (idx !== -1) {
                                const oldID = newNodes[idx].ID_xA;
                                // Apply changes
                                Object.keys(op.changes).forEach(key => {
                                    if (key !== 'ID_xA') { // Don't allow direct ID changes
                                        newNodes[idx][key] = op.changes[key];
                                    }
                                });
                                // Regenerate ID if Group or Node changed
                                if (op.changes.Group_xA || op.changes.Node_xA) {
                                    newNodes[idx].ID_xA = `${newNodes[idx].Group_xA}-${newNodes[idx].Node_xA}`;
                                    // Update all references to old ID
                                    if (oldID && newNodes[idx].ID_xA && oldID !== newNodes[idx].ID_xA) {
                                        newNodes.forEach(n => {
                                            if (n.Linked_Node_ID_xA === oldID) {
                                                n.Linked_Node_ID_xA = newNodes[idx].ID_xA;
                                            }
                                        });
                                    }
                                }
                                changes.push(`Updated ${op.id}`);
                            }
                        }
                        break;

                    case 'RENAME_GROUP':
                        if (op.from && op.to) {
                            let renamedCount = 0;
                            newNodes.forEach(n => {
                                if (n.Group_xA === op.from) {
                                    const oldID = n.ID_xA;
                                    n.Group_xA = op.to;
                                    n.ID_xA = `${op.to}-${n.Node_xA}`;
                                    // Update all references to old ID
                                    newNodes.forEach(ref => {
                                        if (ref.Linked_Node_ID_xA === oldID) {
                                            ref.Linked_Node_ID_xA = n.ID_xA;
                                        }
                                    });
                                    renamedCount++;
                                }
                            });
                            changes.push(`Renamed group "${op.from}" to "${op.to}" (${renamedCount} nodes)`);
                        }
                        break;

                    case 'CONNECT':
                        if (op.from && op.to) {
                            const fromIdx = newNodes.findIndex(n => n.ID_xA === op.from);
                            if (fromIdx !== -1) {
                                newNodes[fromIdx].Linked_Node_ID_xA = op.to;
                                if (op.label) {
                                    newNodes[fromIdx].Link_Label_xB = op.label;
                                }
                                changes.push(`Connected ${op.from} → ${op.to}`);
                            }
                        }
                        break;

                    case 'DISCONNECT':
                        if (op.id) {
                            const discIdx = newNodes.findIndex(n => n.ID_xA === op.id);
                            if (discIdx !== -1) {
                                newNodes[discIdx].Linked_Node_ID_xA = '';
                                changes.push(`Disconnected ${op.id}`);
                            }
                        }
                        break;

                    default:
                        console.warn('Unknown delta operation:', op.op);
                }
            });

            return { nodes: newNodes, changes };
        }, []);

        /**
         * Build context string for AI system prompt (token-efficient)
         * - ≤30 nodes: Full CSV with all columns
         * - >30 nodes: Summary with group names, node counts, and sample nodes
         * @param {Array} nodeArray - Current node array
         * @returns {string} Context string to inject into AI_SYSTEM_PROMPT
         */
        const buildContext = useCallback((nodeArray) => {
            if (!nodeArray || nodeArray.length === 0) {
                return 'Empty graph. Ready to create a new diagram.';
            }

            // For small graphs (≤30 nodes), include full CSV
            if (nodeArray.length <= 30) {
                const lines = ['Group_xA,Node_xA,ID_xA,Linked_Node_ID_xA,Link_Label_xB'];
                nodeArray.forEach(n => {
                    lines.push(`${n.Group_xA},${n.Node_xA},${n.ID_xA},${n.Linked_Node_ID_xA || ''},${n.Link_Label_xB || ''}`);
                });
                return `FULL GRAPH (${nodeArray.length} nodes):\n${lines.join('\n')}`;
            }

            // For larger graphs, provide summary
            const summary = window.GraphApp.utils.generateContextSummary(nodeArray);
            let ctx = `GRAPH SUMMARY: ${summary.totalNodes} nodes, ${summary.totalGroups} groups, ${summary.totalLinks} connections\n\nGROUPS:\n`;
            summary.groups.forEach(g => {
                const nodeList = g.nodeNames.join(', ') + (g.hasMore ? ', ...' : '');
                ctx += `- ${g.name} (${g.nodeCount} nodes, ${g.linkCount} links): ${nodeList}\n`;
            });
            return ctx;
        }, []);

        /**
         * Main AI chat handler - sends user message to Claude API and processes response
         * Maintains conversation history, handles all response types, updates graph state
         * @async
         */
        const generateFromAI = useCallback(async () => {
            if (!apiKey || !aiPrompt.trim()) return;

            setAiLoading(true);
            setAiError('');

            try {
                // Build messages array with conversation history (last 6 messages for token efficiency)
                const messages = [];
                aiConversation.slice(-6).forEach(msg => {
                    messages.push({ role: msg.role, content: msg.content });
                });
                messages.push({ role: 'user', content: aiPrompt });

                // Inject current graph context into system prompt
                const contextString = buildContext(nodes);
                const systemPrompt = AI_SYSTEM_PROMPT.replace('{CONTEXT}', contextString);

                const response = await fetch('https://api.anthropic.com/v1/messages', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': apiKey,
                        'anthropic-version': '2023-06-01',
                        'anthropic-dangerous-direct-browser-access': 'true'
                    },
                    body: JSON.stringify({
                        model: aiModel,
                        max_tokens: 4096,
                        system: systemPrompt,
                        messages: messages
                    })
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    if (response.status === 401) {
                        throw new Error('Invalid API key. Check your key in Settings.');
                    } else if (response.status === 429) {
                        throw new Error('Rate limit exceeded. Please wait a moment and try again.');
                    } else {
                        throw new Error(errorData.error?.message || `API error: ${response.status}`);
                    }
                }

                const data = await response.json();
                const responseText = data.content[0].text;
                const parsed = parseAIResponse(responseText);

                let newNodes = nodes; // Default: no change
                let assistantMessage;
                let responseType = parsed.type;

                if (parsed.type === 'full') {
                    // Full CSV replacement
                    const csvParsed = Papa.parse(parsed.csv, { header: true, skipEmptyLines: true });
                    const importedNodes = csvParsed.data
                        .filter(row => row.Group_xA && row.Node_xA)
                        .map(row => ({
                            Group_xA: row.Group_xA || '',
                            Node_xA: row.Node_xA || '',
                            ID_xA: `${row.Group_xA}-${row.Node_xA}`,
                            Linked_Node_ID_xA: row.Linked_Node_ID_xA || '',
                            Link_Label_xB: row.Link_Label_xB || '',
                            Hidden_Node_xB: 0,
                            Hidden_Link_xB: 0,
                            Link_Arrow_xB: 'To'
                        }));

                    if (importedNodes.length === 0) {
                        throw new Error('No valid nodes in generated data. Try a different description.');
                    }

                    newNodes = importedNodes;
                    assistantMessage = `Created ${newNodes.length} nodes in ${new Set(newNodes.map(n => n.Group_xA)).size} groups`;

                    // Clear positions for fresh layout
                    window.GraphApp.core.clearCytoscapePositions();
                    isFirstRenderRef.current = true;

                    setNodes(newNodes);
                    if (nodes.length === 0) {
                        setCurrentFileName('AI Generated');
                    }

                    // Validate and save to history
                    const validationErrors = window.GraphApp.utils.validateNodes(newNodes);
                    setErrors(validationErrors);
                    saveToHistory(newNodes);

                } else if (parsed.type === 'delta') {
                    // Delta operations
                    const result = applyDeltaOperations(parsed.operations, nodes);
                    newNodes = result.nodes;
                    assistantMessage = result.changes.length > 0
                        ? result.changes.join('; ')
                        : parsed.summary || 'No changes applied';

                    if (result.changes.length > 0) {
                        // Clear positions for fresh layout
                        window.GraphApp.core.clearCytoscapePositions();
                        isFirstRenderRef.current = true;

                        setNodes(newNodes);

                        // Validate and save to history
                        const validationErrors = window.GraphApp.utils.validateNodes(newNodes);
                        setErrors(validationErrors);
                        saveToHistory(newNodes);
                    }

                } else {
                    // Message type - conversational response, no graph changes
                    assistantMessage = parsed.content;
                    // No setNodes() or saveToHistory() - graph unchanged
                }

                // Update conversation history
                setAiConversation(prev => [
                    ...prev,
                    { role: 'user', content: aiPrompt, timestamp: new Date() },
                    { role: 'assistant', content: assistantMessage, type: responseType, timestamp: new Date() }
                ]);

                // Clear prompt but keep modal open for continued conversation
                setAiPrompt('');

            } catch (err) {
                setAiError(err.message);
            } finally {
                setAiLoading(false);
            }
        }, [apiKey, aiModel, aiPrompt, aiConversation, nodes, buildContext, parseAIResponse, applyDeltaOperations, saveToHistory]);

        // AI Modal drag/resize handlers - allow moving and resizing the chat window
        const handleAiDragStart = useCallback((e) => {
            if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;
            setAiDragging(true);
            aiDragStart.current = { x: e.clientX - aiModalPos.x, y: e.clientY - aiModalPos.y };
            e.preventDefault();
        }, [aiModalPos]);

        const handleAiDragMove = useCallback((e) => {
            if (aiDragging) {
                const newX = Math.max(0, Math.min(window.innerWidth - aiModalSize.width, e.clientX - aiDragStart.current.x));
                const newY = Math.max(0, Math.min(window.innerHeight - aiModalSize.height, e.clientY - aiDragStart.current.y));
                setAiModalPos({ x: newX, y: newY });
            }
            if (aiResizing) {
                const newWidth = Math.max(300, Math.min(800, e.clientX - aiModalPos.x));
                const newHeight = Math.max(300, Math.min(700, e.clientY - aiModalPos.y));
                setAiModalSize({ width: newWidth, height: newHeight });
            }
        }, [aiDragging, aiResizing, aiModalPos, aiModalSize]);

        const handleAiDragEnd = useCallback(() => {
            setAiDragging(false);
            setAiResizing(false);
        }, []);

        // Attach global mouse handlers for AI modal drag/resize
        useEffect(() => {
            if (aiDragging || aiResizing) {
                window.addEventListener('mousemove', handleAiDragMove);
                window.addEventListener('mouseup', handleAiDragEnd);
                return () => {
                    window.removeEventListener('mousemove', handleAiDragMove);
                    window.removeEventListener('mouseup', handleAiDragEnd);
                };
            }
        }, [aiDragging, aiResizing, handleAiDragMove, handleAiDragEnd]);

        // Save API settings to localStorage
        const saveAPISettings = useCallback(() => {
            try {
                if (apiKey) {
                    localStorage.setItem('anthropic_api_key', apiKey);
                } else {
                    localStorage.removeItem('anthropic_api_key');
                }
                localStorage.setItem('anthropic_model', aiModel);
            } catch (e) {
                console.warn('Could not save to localStorage:', e);
            }
            setShowSettingsModal(false);
        }, [apiKey, aiModel]);

        // Clear API key
        const clearAPIKey = useCallback(() => {
            setApiKey('');
            try {
                localStorage.removeItem('anthropic_api_key');
            } catch (e) {
                console.warn('Could not clear localStorage:', e);
            }
        }, []);

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

        // Delete entire group
        const handleDeleteGroup = useCallback((groupName) => {
            const groupNodes = nodes.filter(n => n.Group_xA === groupName);
            const nodeCount = groupNodes.length;

            // Check if any nodes in this group are referenced by nodes outside the group
            const externalReferences = nodes.filter(n =>
                n.Group_xA !== groupName &&
                groupNodes.some(gn => gn.ID_xA === n.Linked_Node_ID_xA)
            );

            if (externalReferences.length > 0) {
                setDeleteConfirm({
                    groupName,
                    message: `Delete entire group "${groupName}" (${nodeCount} nodes)? ${externalReferences.length} external reference(s) will break.`,
                    isReferenced: true,
                    isGroup: true
                });
            } else {
                setDeleteConfirm({
                    groupName,
                    message: `Delete entire group "${groupName}" (${nodeCount} nodes)?`,
                    isReferenced: false,
                    isGroup: true
                });
            }
        }, [nodes]);

        // Duplicate node
        const handleDuplicateRow = useCallback((index) => {
            const nodeToDuplicate = nodes[index];
            const group = nodeToDuplicate.Group_xA;
            const baseNodeName = nodeToDuplicate.Node_xA;

            // Find unique name with _N suffix (same pattern as group duplication)
            const escapedBase = baseNodeName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const pattern = new RegExp(`^${escapedBase}_(\\d+)$`);

            let maxSuffix = 0;

            // Check if base name exists
            if (nodes.some(n => n.Node_xA === baseNodeName && n.Group_xA === group)) {
                maxSuffix = 1;
            }

            // Find highest suffix number for this node name in this group
            nodes.forEach(node => {
                if (node.Group_xA === group) {
                    const match = node.Node_xA.match(pattern);
                    if (match) {
                        const suffix = parseInt(match[1]);
                        maxSuffix = Math.max(maxSuffix, suffix);
                    }
                }
            });

            const newNodeName = `${baseNodeName}_${maxSuffix + 1}`;
            const newID = window.GraphApp.utils.generateID(group, newNodeName);

            const duplicatedNode = {
                Group_xA: group,
                Node_xA: newNodeName,
                ID_xA: newID,
                Linked_Node_ID_xA: '',  // NO link cloning
                Hidden_Node_xB: nodeToDuplicate.Hidden_Node_xB,
                Hidden_Link_xB: 0,
                Link_Label_xB: '',  // NO label cloning
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

        // Duplicate entire group
        const handleDuplicateGroup = useCallback((groupName) => {
            // Find all nodes in the group
            const groupNodes = nodes.filter(n => n.Group_xA === groupName);

            if (groupNodes.length === 0) return;

            // Generate unique group name with _N suffix
            const newGroupName = window.GraphApp.utils.generateUniqueGroupName(groupName, nodes);

            // Clone nodes with new group name and NO links
            const clonedNodes = groupNodes.map(node => ({
                Group_xA: newGroupName,
                Node_xA: node.Node_xA,
                ID_xA: window.GraphApp.utils.generateID(newGroupName, node.Node_xA),
                Linked_Node_ID_xA: '',  // NO links
                Hidden_Node_xB: node.Hidden_Node_xB || 0,
                Hidden_Link_xB: 0,
                Link_Label_xB: '',  // NO labels
                Link_Arrow_xB: node.Link_Arrow_xB || 'To'
            }));

            // Find insertion point (after last node of the group)
            const lastGroupIndex = nodes.reduce((lastIdx, node, idx) => {
                return node.Group_xA === groupName ? idx : lastIdx;
            }, -1);

            const newNodes = [
                ...nodes.slice(0, lastGroupIndex + 1),
                ...clonedNodes,
                ...nodes.slice(lastGroupIndex + 1)
            ];

            setNodes(newNodes);

            // Keep the new group collapsed
            setCollapsedGroups(new Set([...collapsedGroups, newGroupName]));

            // Validate after duplication
            const validationErrors = window.GraphApp.utils.validateNodes(newNodes);
            setErrors(validationErrors);

            // Save to history
            saveToHistory(newNodes);
        }, [nodes, collapsedGroups, saveToHistory]);

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
                let newNodes;

                if (deleteConfirm.isGroup) {
                    // Delete entire group
                    newNodes = nodes.filter(n => n.Group_xA !== deleteConfirm.groupName);
                    // Also remove from collapsed groups
                    const newCollapsedGroups = new Set(collapsedGroups);
                    newCollapsedGroups.delete(deleteConfirm.groupName);
                    setCollapsedGroups(newCollapsedGroups);
                } else {
                    // Delete single node
                    newNodes = nodes.filter((_, i) => i !== deleteConfirm.index);
                }

                setNodes(newNodes);
                setDeleteConfirm(null);

                // Validate after deletion
                const validationErrors = window.GraphApp.utils.validateNodes(newNodes);
                setErrors(validationErrors);

                // Save to history
                saveToHistory(newNodes);
            }
        }, [deleteConfirm, nodes, collapsedGroups, saveToHistory]);

        // Edit cell - IMPORTANT: Create new object references to satisfy React immutability
        const handleCellEdit = useCallback((index, field, value) => {
            // Deep-ish clone: new array with new objects (prevents state mutation)
            const newNodes = nodes.map(n => ({ ...n }));
            const oldNode = nodes[index]; // Reference original for comparison

            // Special case: editing Group_xA on a collapsed group
            if (field === 'Group_xA' && collapsedGroups.has(oldNode.Group_xA)) {
                const oldGroupName = oldNode.Group_xA;
                const newGroupName = value;

                // Update ALL nodes in this group
                newNodes.forEach((node, i) => {
                    if (node.Group_xA === oldGroupName) {
                        const oldID = node.ID_xA;
                        newNodes[i].Group_xA = newGroupName;
                        newNodes[i].ID_xA = window.GraphApp.utils.generateID(newGroupName, node.Node_xA);

                        // Update all references to this old ID
                        // IMPORTANT: Only track non-empty IDs - prevents empty Linked_To cells from snapping
                        if (oldID && newNodes[i].ID_xA) {
                            newNodes.forEach((refNode, j) => {
                                if (refNode.Linked_Node_ID_xA === oldID) {
                                    newNodes[j].Linked_Node_ID_xA = newNodes[i].ID_xA;
                                }
                            });
                        }
                    }
                });

                // Update collapsed groups set
                const newCollapsed = new Set(collapsedGroups);
                newCollapsed.delete(oldGroupName);
                newCollapsed.add(newGroupName);
                setCollapsedGroups(newCollapsed);
            } else {
                // Normal cell edit
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
                    // IMPORTANT: Only track non-empty IDs - prevents empty Linked_To cells from snapping
                    if (oldID && newID && oldID !== newID) {
                        newNodes.forEach((node, i) => {
                            if (node.Linked_Node_ID_xA === oldID) {
                                newNodes[i].Linked_Node_ID_xA = newID;
                            }
                        });
                    }
                }
            }

            setNodes(newNodes);

            // Revalidate
            const validationErrors = window.GraphApp.utils.validateNodes(newNodes);
            setErrors(validationErrors);

            // Save to history
            saveToHistory(newNodes);
        }, [nodes, collapsedGroups, saveToHistory]);

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

        // Toggle hide unlinked nodes - with mutual exclusivity
        const toggleHideUnlinked = useCallback(() => {
            if (hideUnlinkedNodes) {
                // Turning OFF - just disable
                setHideUnlinkedNodes(false);
            } else {
                // Turning ON - disable the other first to prevent both hidden
                setHideLinkedNodes(false);
                setHideUnlinkedNodes(true);
            }
        }, [hideUnlinkedNodes]);

        // Toggle hide linked nodes - with mutual exclusivity
        const toggleHideLinked = useCallback(() => {
            if (hideLinkedNodes) {
                // Turning OFF - just disable
                setHideLinkedNodes(false);
            } else {
                // Turning ON - disable the other first to prevent both hidden
                setHideUnlinkedNodes(false);
                setHideLinkedNodes(true);
            }
        }, [hideLinkedNodes]);

        // Toggle hide/show link lines (independent of node visibility)
        const toggleHideLinks = useCallback(() => {
            setHideLinks(!hideLinks);
        }, [hideLinks]);

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

        const handleExportDOT = useCallback(() => {
            window.GraphApp.exports.exportDOT(nodes, 'graph.dot', settings);
            setShowExportModal(false);
        }, [nodes, settings]);

        const handleExportPDF = useCallback(async () => {
            try {
                await window.GraphApp.exports.exportPDF('mermaid-container', 'graph.pdf');
                setShowExportModal(false);
            } catch (error) {
                alert('Error exporting PDF: ' + error.message);
            }
        }, []);

        const handleExportExcalidraw = useCallback(() => {
            window.GraphApp.exports.exportExcalidraw(nodes, 'graph.excalidraw');
            setShowExportModal(false);
        }, [nodes]);

        // Canvas export handlers (visible nodes only)
        const handleExportCSVCanvas = useCallback(() => {
            window.GraphApp.exports.exportCSVCanvas(nodes, 'graph-canvas.csv');
            setShowExportModal(false);
        }, [nodes]);

        const handleExportExcelCanvas = useCallback(async () => {
            const filteredNodes = window.GraphApp.exports.filterVisibleNodes(nodes);
            await window.GraphApp.core.exportExcel(filteredNodes, 'graph-canvas.xlsx');
            setShowExportModal(false);
        }, [nodes]);

        const handleExportJSONCanvas = useCallback(() => {
            window.GraphApp.exports.exportJSONCanvas(nodes, 'graph-canvas.json');
            setShowExportModal(false);
        }, [nodes]);

        const handleExportGraphMLCanvas = useCallback(() => {
            window.GraphApp.exports.exportGraphMLCanvas(nodes, 'graph-canvas.graphml');
            setShowExportModal(false);
        }, [nodes]);

        const handleExportMermaidCanvas = useCallback(() => {
            const filteredNodes = window.GraphApp.exports.filterVisibleNodes(nodes);
            const mermaidSyntax = window.GraphApp.core.generateMermaid(filteredNodes, settings, new Set());
            window.GraphApp.exports.exportMermaid(mermaidSyntax, 'graph-canvas.mmd');
            setShowExportModal(false);
        }, [nodes, settings]);

        const handleExportDOTCanvas = useCallback(() => {
            window.GraphApp.exports.exportDOTCanvas(nodes, 'graph-canvas.dot', settings);
            setShowExportModal(false);
        }, [nodes, settings]);

        const handleExportExcalidrawCanvas = useCallback(() => {
            window.GraphApp.exports.exportExcalidrawCanvas(nodes, 'graph-canvas.excalidraw');
            setShowExportModal(false);
        }, [nodes]);

        // Load demo by name
        const loadDemo = useCallback((demoName) => {
            const demos = window.GraphApp.data.demos;
            const demoData = demos[demoName] || window.GraphApp.data.sample;

            // Clear Cytoscape positions for fresh layout on new demo
            window.GraphApp.core.clearCytoscapePositions();
            isFirstRenderRef.current = true;

            // Spread to create new array reference (forces re-render even if same data)
            setNodes([...demoData]);
            setShowDemoMenu(false);
            setCurrentFileName(demoName);  // Show demo name in toolbar

            // Validate demo data
            const validationErrors = window.GraphApp.utils.validateNodes(demoData);
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
                        // Help button
                        React.createElement('button', {
                            key: 'help-btn',
                            onClick: () => setShowHelpModal(true),
                            className: "flex items-center justify-center w-6 h-6 text-sm font-bold text-blue-600 bg-blue-100 hover:bg-blue-200 rounded-full mr-2",
                            title: "Help"
                        }, "?"),

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
                            ]),

                            // AI Generate button (only shown when API key is configured)
                            ...(apiKey ? [
                                React.createElement('button', {
                                    key: 'ai-generate',
                                    onClick: () => setShowAIModal(true),
                                    className: "flex items-center px-2 py-1 text-xs bg-purple-500 text-white rounded hover:bg-purple-600"
                                }, [
                                    React.createElement(Sparkles, {
                                        key: 'icon',
                                        size: 12,
                                        className: "mr-1"
                                    }),
                                    "AI Generate"
                                ])
                            ] : [])
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

                        // Panel layout control (optimal fit only)
                        React.createElement('button', {
                            key: 'layout-balanced',
                            onClick: calculateOptimalTableWidth,
                            className: "w-8 h-8 flex items-center justify-center hover:bg-gray-100 text-gray-600",
                            title: "Optimal fit (auto-calculate to prevent truncation)"
                        }, [
                            React.createElement(LayoutBalanced, { size: 20 })
                        ]),

                        // Demos dropdown
                        React.createElement('div', {
                            key: 'div2',
                            className: "w-px h-6 bg-gray-300"
                        }),
                        React.createElement('div', {
                            key: 'demos-dropdown',
                            className: "relative",
                            'data-demos-dropdown': true
                        }, [
                            React.createElement('button', {
                                key: 'demos-btn',
                                onClick: () => setShowDemoMenu(!showDemoMenu),
                                className: "flex items-center gap-1 px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
                            }, [
                                "Demos",
                                React.createElement('span', { key: 'arrow', className: "text-[10px]" }, showDemoMenu ? "▲" : "▼")
                            ]),
                            showDemoMenu && React.createElement('div', {
                                key: 'demos-menu',
                                className: "absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded shadow-lg z-50 min-w-[140px]"
                            }, Object.keys(window.GraphApp.data.demos).map(demoName =>
                                React.createElement('button', {
                                    key: demoName,
                                    onClick: () => loadDemo(demoName),
                                    className: "block w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 first:rounded-t last:rounded-b"
                                }, demoName)
                            ))
                        ]),

                        // Move row up/down buttons
                        React.createElement('div', {
                            key: 'div-move',
                            className: "w-px h-6 bg-gray-300"
                        }),
                        React.createElement('button', {
                            key: 'move-up',
                            onClick: handleMoveUp,
                            disabled: !canMoveUp,
                            className: canMoveUp
                                ? "p-1.5 rounded hover:bg-gray-100"
                                : "p-1.5 rounded text-gray-300 cursor-not-allowed",
                            title: "Move row up (within group)"
                        }, React.createElement(ArrowUp, { size: 16 })),
                        React.createElement('button', {
                            key: 'move-down',
                            onClick: handleMoveDown,
                            disabled: !canMoveDown,
                            className: canMoveDown
                                ? "p-1.5 rounded hover:bg-gray-100"
                                : "p-1.5 rounded text-gray-300 cursor-not-allowed",
                            title: "Move row down (within group)"
                        }, React.createElement(ArrowDown, { size: 16 })),

                        React.createElement('div', {
                            key: 'div3',
                            className: "w-px h-6 bg-gray-300"
                        }),

                        // Layout algorithm selector
                        React.createElement('select', {
                            key: 'layout',
                            value: settings.layout,
                            onChange: (e) => {
                                const newLayout = e.target.value;
                                setSettings({ ...settings, layout: newLayout });
                                // Run appropriate layout algorithm
                                if (newLayout === 'fcose') {
                                    window.GraphApp.core.runFcoseLayout();
                                } else if (newLayout === 'dagre-TB') {
                                    window.GraphApp.core.runDagreLayout('TB');
                                } else if (newLayout === 'dagre-LR') {
                                    window.GraphApp.core.runDagreLayout('LR');
                                } else if (newLayout === 'compact-TB') {
                                    window.GraphApp.core.runAutoLayout('TB');
                                } else if (newLayout === 'compact-LR') {
                                    window.GraphApp.core.runAutoLayout('LR');
                                }
                            },
                            className: "px-2 py-1 text-xs border border-gray-300 rounded",
                            title: "Layout algorithm - Smart minimizes edge crossings, Hierarchical for flow diagrams, Compact uses simple grid"
                        }, [
                            React.createElement('option', { key: 'fcose', value: 'fcose' }, "◎ Smart Layout"),
                            React.createElement('option', { key: 'dagre-tb', value: 'dagre-TB' }, "↓ Hierarchical"),
                            React.createElement('option', { key: 'dagre-lr', value: 'dagre-LR' }, "→ Hierarchical"),
                            React.createElement('option', { key: 'compact-tb', value: 'compact-TB' }, "⊞ Compact ↓"),
                            React.createElement('option', { key: 'compact-lr', value: 'compact-LR' }, "⊞ Compact →")
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
                            React.createElement('option', { key: 'linear', value: 'linear' }, "⟋ Straight")
                        ]),

                        React.createElement('div', {
                            key: 'div4',
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
                            // Re-layout button
                            React.createElement('button', {
                                key: 'relayout-btn',
                                onClick: () => {
                                    if (settings.layout === 'fcose') {
                                        window.GraphApp.core.runFcoseLayout();
                                    } else if (settings.layout === 'dagre-TB') {
                                        window.GraphApp.core.runDagreLayout('TB');
                                    } else if (settings.layout === 'dagre-LR') {
                                        window.GraphApp.core.runDagreLayout('LR');
                                    } else if (settings.layout === 'compact-TB') {
                                        window.GraphApp.core.runAutoLayout('TB');
                                    } else if (settings.layout === 'compact-LR') {
                                        window.GraphApp.core.runAutoLayout('LR');
                                    }
                                },
                                className: "px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600",
                                title: "Re-arrange nodes using current layout"
                            }, "Re-layout"),
                            React.createElement('button', {
                                key: 'hide-unlinked',
                                onClick: toggleHideUnlinked,
                                className: `px-2 py-1 text-xs rounded flex items-center gap-1 ${hideUnlinkedNodes ? 'bg-orange-500 text-white hover:bg-orange-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`,
                                title: hideUnlinkedNodes ? "Show all nodes" : "Hide unlinked nodes from canvas"
                            }, [
                                React.createElement(hideUnlinkedNodes ? Eye : EyeOff, { key: 'icon', size: 12 }),
                                hideUnlinkedNodes ? 'Show Unlinked' : 'Hide Unlinked'
                            ]),
                            React.createElement('button', {
                                key: 'hide-linked',
                                onClick: toggleHideLinked,
                                className: `px-2 py-1 text-xs rounded flex items-center gap-1 ${hideLinkedNodes ? 'bg-orange-500 text-white hover:bg-orange-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`,
                                title: hideLinkedNodes ? "Show all nodes" : "Hide linked nodes from canvas"
                            }, [
                                React.createElement(hideLinkedNodes ? Eye : EyeOff, { key: 'icon', size: 12 }),
                                hideLinkedNodes ? 'Show Linked' : 'Hide Linked'
                            ]),
                            React.createElement('button', {
                                key: 'hide-links',
                                onClick: toggleHideLinks,
                                className: `px-2 py-1 text-xs rounded flex items-center gap-1 ${hideLinks ? 'bg-orange-500 text-white hover:bg-orange-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`,
                                title: hideLinks ? "Show link lines" : "Hide link lines from canvas"
                            }, [
                                React.createElement(hideLinks ? Eye : EyeOff, { key: 'icon', size: 12 }),
                                hideLinks ? 'Show Links' : 'Hide Links'
                            ]),
                            // Filename display (unobtrusive, only shown when file is loaded)
                            ...(currentFileName ? [
                                React.createElement('span', {
                                    key: 'filename',
                                    className: "text-xs text-gray-400 ml-2 truncate max-w-[150px]",
                                    title: currentFileName
                                }, currentFileName)
                            ] : []),

                            // Settings button (gear icon)
                            React.createElement('div', {
                                key: 'settings-separator',
                                className: "w-px h-6 bg-gray-300 ml-2"
                            }),
                            React.createElement('button', {
                                key: 'settings-btn',
                                onClick: () => setShowSettingsModal(true),
                                className: "p-1.5 rounded hover:bg-gray-100 text-gray-600",
                                title: "Settings (API Key)"
                            }, React.createElement(Settings, { size: 16 }))
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
                                "No data loaded. Import a file or try a demo to get started."),
                            React.createElement('button', {
                                key: 'btn',
                                onClick: () => loadDemo('Quick Tour'),
                                className: "px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                            }, "Load Quick Tour")
                        ])
                    ]) :
                    // Data table
                    React.createElement('table', {
                        key: 'table',
                        className: "w-full text-sm"
                    }, [
                        // Column widths
                        React.createElement('colgroup', { key: 'colgroup' }, [
                            React.createElement('col', { key: 'col-rownum', style: { width: '30px' } }), // Row number
                            React.createElement('col', { key: 'col-collapse', style: { width: '32px' } }), // Collapse icon
                            React.createElement('col', { key: 'col-visibility', style: { width: '32px' } }), // Visibility icon
                            React.createElement('col', {
                                key: 'col-group',
                                style: { width: `${colWidths.Group_xA}px` }
                            }),
                            React.createElement('col', {
                                key: 'col-node',
                                style: { width: `${colWidths.Node_xA}px` }
                            }),
                            React.createElement('col', { key: 'col-links', style: { width: '28px' } }), // Incoming links count
                            ...(showIDColumn ? [
                                React.createElement('col', {
                                    key: 'col-id',
                                    style: { width: `${colWidths.ID_xA}px` }
                                })
                            ] : []),
                            React.createElement('col', {
                                key: 'col-linked',
                                style: { width: `${colWidths.Linked_Node_ID_xA}px` }
                            }),
                            React.createElement('col', {
                                key: 'col-label',
                                style: { width: `${colWidths.Link_Label_xB}px` }
                            }),
                            React.createElement('col', { key: 'col-duplicate', style: { width: '32px' } }), // Duplicate icon
                            React.createElement('col', { key: 'col-actions', style: { width: '32px' } }) // Delete icon
                        ]),
                        React.createElement('thead', {
                            key: 'thead',
                            className: "sticky top-0 bg-gray-100 border-b-2 border-gray-300 z-10"
                        }, [
                            React.createElement('tr', { key: 'tr' }, [
                                React.createElement('th', {
                                    key: 'rownum',
                                    className: "px-1 py-2 text-xs font-semibold text-center text-gray-500 th-separator",
                                    style: { width: '30px' },
                                    title: "Row number (for reference)"
                                }, "#"),
                                React.createElement('th', {
                                    key: 'collapse',
                                    className: "px-1 py-2 text-center th-separator"
                                }, React.createElement('button', {
                                    onClick: () => {
                                        if (collapsedGroups.size === 0) {
                                            collapseAllGroups();
                                        } else {
                                            expandAllGroups();
                                        }
                                    },
                                    className: "p-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors",
                                    title: "Collapse/Expand All Groups"
                                }, React.createElement(ChevronDown, { size: 16, strokeWidth: 2.5 }))),
                                React.createElement('th', {
                                    key: 'visibility',
                                    className: "px-1 py-2 text-center th-separator"
                                }, React.createElement('button', {
                                    onClick: () => {
                                        if (hiddenGroups.size === 0) {
                                            hideAllGroups();
                                        } else {
                                            showAllGroups();
                                        }
                                    },
                                    className: "p-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors",
                                    title: "Show/Hide All Groups"
                                }, React.createElement(Eye, { size: 16, strokeWidth: 2 }))),
                                React.createElement('th', {
                                    key: 'group',
                                    className: "px-1 py-2 th-separator"
                                }, React.createElement('button', {
                                    onClick: () => handleSort('Group_xA'),
                                    className: "px-2 py-1 text-xs font-semibold bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors",
                                    title: "Click to sort"
                                }, [
                                    'Group ',
                                    React.createElement('span', {
                                        key: 'sort-indicator',
                                        className: sortColumn === 'Group_xA' ? 'text-white' : 'text-blue-200'
                                    }, sortColumn === 'Group_xA'
                                        ? (sortDirection === 'asc' ? '▲' : '▼')
                                        : '↕')
                                ])),
                                React.createElement('th', {
                                    key: 'node',
                                    className: "px-1 py-2 th-separator"
                                }, React.createElement('button', {
                                    onClick: () => handleSort('Node_xA'),
                                    className: "px-2 py-1 text-xs font-semibold bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors",
                                    title: "Click to sort"
                                }, [
                                    'Node ',
                                    React.createElement('span', {
                                        key: 'sort-indicator',
                                        className: sortColumn === 'Node_xA' ? 'text-white' : 'text-blue-200'
                                    }, sortColumn === 'Node_xA'
                                        ? (sortDirection === 'asc' ? '▲' : '▼')
                                        : '↕')
                                ])),
                                React.createElement('th', {
                                    key: 'links',
                                    className: "px-1 py-2 text-xs font-semibold text-center th-separator",
                                    title: "Number of incoming links to this node"
                                }, "→"),
                                ...(showIDColumn ? [
                                    React.createElement('th', {
                                        key: 'id',
                                        className: "px-1 py-2 text-xs font-semibold text-left th-separator"
                                    }, "ID")
                                ] : []),
                                React.createElement('th', {
                                    key: 'linked',
                                    className: "px-1 py-2 text-xs font-semibold text-left th-separator"
                                }, "Linked To"),
                                React.createElement('th', {
                                    key: 'label',
                                    className: "px-1 py-2 text-xs font-semibold text-left th-separator"
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
                            // PERFORMANCE: Single-pass filter with O(1) lookups instead of O(n²)
                            nodes.reduce((acc, node, index) => {
                                // Track if this is first row of a contiguous group cluster
                                const prevGroup = acc.length > 0 ? acc[acc.length - 1].node.Group_xA : null;
                                const isFirstOfCluster = prevGroup !== node.Group_xA;

                                // Show all rows if group is NOT collapsed
                                if (!collapsedGroups.has(node.Group_xA)) {
                                    acc.push({ node, index, isCollapsed: false, isFirstOfCluster });
                                } else {
                                    // If collapsed, only show FIRST node - O(1) lookup
                                    if (groupFirstIndex.get(node.Group_xA) === index) {
                                        acc.push({ node, index, isCollapsed: true, isFirstOfCluster });
                                    }
                                }
                                return acc;
                            }, []).map(({ node, index, isCollapsed, isFirstOfCluster }, filteredIndex) => {
                                // Original index preserved from reduce - no findIndex needed!
                                const hasError = errorRowMap[index] && errorRowMap[index].length > 0;

                                return React.createElement('tr', {
                                    key: index,
                                    className: `border-b border-gray-200 ${hasError ? 'bg-red-100 hover:bg-red-200 border-l-4 border-l-red-500' : 'hover:bg-gray-50'}`,
                                    title: hasError ? errorRowMap[index].join('; ') : ''
                                }, [
                                    React.createElement('td', {
                                        key: 'rownum',
                                        className: "px-1 py-1 text-xs text-center text-gray-400",
                                        style: { width: '30px' }
                                    }, filteredIndex + 1),
                                    React.createElement('td', {
                                        key: 'collapse',
                                        className: "px-2 py-1 text-center"
                                    }, React.createElement('button', {
                                        onClick: () => toggleGroupCollapse(node.Group_xA),
                                        className: `p-1 rounded hover:bg-gray-100 ${isCollapsed ? 'text-gray-900 font-bold' : 'text-gray-600'}`,
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
                                        className: "px-1 py-1"
                                    }, React.createElement('input', {
                                        type: 'text',
                                        value: node.Group_xA,
                                        onChange: (e) => handleCellEdit(index, 'Group_xA', e.target.value),
                                        onFocus: () => setSelectedRowIndex(index),
                                        title: isCollapsed ? `Editing this will rename all nodes in group "${node.Group_xA}"` : node.Group_xA,
                                        className: `px-1 py-0.5 text-xs border rounded table-input ${isCollapsed ? 'font-bold border-blue-400 bg-blue-50' : (isFirstOfCluster ? 'font-bold border-gray-300' : 'border-gray-300')}`
                                    })),
                                    React.createElement('td', {
                                        key: 'node',
                                        className: `px-1 py-1 ${linkingMode.active && !isCollapsed ? 'cursor-pointer hover:bg-blue-50 ring-2 ring-transparent hover:ring-blue-200' : ''}`,
                                        onClick: () => linkingMode.active && !isCollapsed && handleIDClick(index),
                                        title: linkingMode.active ? (isCollapsed ? 'Expand group to link' : 'Click to link') : (isCollapsed ? 'Collapsed group' : '')
                                    }, isCollapsed ? null : React.createElement('input', {
                                        type: 'text',
                                        value: node.Node_xA,
                                        onChange: (e) => handleCellEdit(index, 'Node_xA', e.target.value),
                                        onFocus: () => setSelectedRowIndex(index),
                                        title: node.Node_xA,
                                        className: `px-1 py-0.5 text-xs border border-gray-300 rounded table-input ${linkingMode.active ? 'pointer-events-none bg-blue-50 text-blue-700 font-semibold' : ''}`,
                                        readOnly: linkingMode.active
                                    })),
                                    React.createElement('td', {
                                        key: 'links',
                                        className: `px-2 py-1 text-center text-xs font-semibold ${!isCollapsed && (incomingLinksCount[node.ID_xA] || 0) > 0 ? 'text-green-600' : 'text-gray-400'}`,
                                        title: isCollapsed ? '' : `${incomingLinksCount[node.ID_xA] || 0} node(s) link to this`
                                    }, isCollapsed ? null : (incomingLinksCount[node.ID_xA] || 0)),
                                    ...(showIDColumn ? [
                                        React.createElement('td', {
                                            key: 'id',
                                            className: `px-1 py-1 text-xs ${!isCollapsed && linkingMode.active ? 'cursor-pointer text-blue-600 hover:bg-blue-50 font-semibold' : 'text-gray-600'}`,
                                            onClick: () => !isCollapsed && handleIDClick(index),
                                            title: linkingMode.active && !isCollapsed ? 'Click to link' : ''
                                        }, isCollapsed ? null : node.ID_xA)
                                    ] : []),
                                    React.createElement('td', {
                                        key: 'linked',
                                        className: "px-1 py-1"
                                    }, isCollapsed ? null : React.createElement('div', {
                                        className: `flex items-center gap-1 w-full ${linkingMode.active && linkingMode.targetRowIndex === index ? 'ring-2 ring-blue-500 rounded' : ''}`
                                    }, [
                                        React.createElement('input', {
                                            key: 'input',
                                            type: 'text',
                                            value: node.Linked_Node_ID_xA || '',
                                            readOnly: true,
                                            onClick: () => !(linkingMode.active && linkingMode.targetRowIndex === index) && enterLinkMode(index),
                                            title: linkingMode.active && linkingMode.targetRowIndex === index
                                                ? 'Click an ID to link, or X to cancel'
                                                : (node.Linked_Node_ID_xA ? 'Click to change link' : 'Click to select target node'),
                                            className: `flex-1 min-w-[40px] px-1 py-0.5 text-xs border border-gray-300 rounded cursor-pointer ${linkingMode.active && linkingMode.targetRowIndex === index ? 'bg-blue-100 border-blue-400' : 'bg-gray-50 hover:bg-gray-100'}`
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
                                        // Cancel button - shows only during linking mode
                                        ...(linkingMode.active && linkingMode.targetRowIndex === index ? [
                                            React.createElement('button', {
                                                key: 'cancel',
                                                onClick: exitLinkMode,
                                                className: "p-0.5 text-gray-500 hover:text-red-500",
                                                title: "Cancel linking"
                                            }, React.createElement(X, { size: 14 }))
                                        ] : [])
                                    ])),
                                    React.createElement('td', {
                                        key: 'label',
                                        className: "px-1 py-1"
                                    }, isCollapsed ? null : React.createElement('input', {
                                        type: 'text',
                                        value: node.Link_Label_xB || '',
                                        onChange: (e) => handleCellEdit(index, 'Link_Label_xB', e.target.value),
                                        title: node.Link_Label_xB || '',
                                        className: "px-1 py-0.5 text-xs border border-gray-300 rounded table-input"
                                    })),
                                    React.createElement('td', {
                                        key: 'duplicate',
                                        className: "px-2 py-1 text-center"
                                    }, React.createElement('button', {
                                        onClick: () => isCollapsed ? handleDuplicateGroup(node.Group_xA) : handleDuplicateRow(index),
                                        className: `p-1 rounded text-blue-500 hover:bg-blue-50`,
                                        title: isCollapsed ? "Duplicate entire group" : "Duplicate this row"
                                    }, React.createElement(Copy, { size: 14 }))),
                                    React.createElement('td', {
                                        key: 'actions',
                                        className: "px-2 py-1 text-center"
                                    }, React.createElement('button', {
                                        onClick: () => isCollapsed ? handleDeleteGroup(node.Group_xA) : handleDeleteNode(index),
                                        className: "p-1 rounded flex items-center gap-0.5 text-black hover:bg-red-50",
                                        title: isCollapsed
                                            ? (groupsWithExternalRefs.has(node.Group_xA)
                                                ? "Delete entire group (has external references)"
                                                : "Delete entire group")
                                            : "Delete this row"
                                    }, [
                                        React.createElement(Trash2, { key: 'icon', size: 14 }),
                                        // Show "*" for referenced nodes or collapsed groups with external refs
                                        ...((isCollapsed && groupsWithExternalRefs.has(node.Group_xA)) ||
                                            (!isCollapsed && incomingLinksCount[node.ID_xA] > 0) ? [
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

            // Export modal - Two column layout: Table vs Canvas
            showExportModal && React.createElement('div', {
                key: 'export-modal',
                className: "fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center modal-overlay",
                onClick: () => setShowExportModal(false)
            }, React.createElement('div', {
                key: 'modal-content',
                className: "bg-white rounded-lg shadow-xl p-6 max-w-lg w-full mx-4",
                onClick: (e) => e.stopPropagation()
            }, [
                React.createElement('h3', {
                    key: 'title',
                    className: "text-lg font-semibold mb-4 text-center"
                }, "Export"),

                // Two column grid
                React.createElement('div', {
                    key: 'columns',
                    className: "grid grid-cols-2 gap-4 mb-4"
                }, [
                    // TABLE column
                    React.createElement('div', {
                        key: 'table-col',
                        className: "space-y-2"
                    }, [
                        React.createElement('div', {
                            key: 'table-header',
                            className: "text-center pb-2 border-b border-gray-200"
                        }, [
                            React.createElement('div', { key: 't1', className: "font-bold text-gray-700" }, "Table"),
                            React.createElement('div', { key: 't2', className: "text-xs text-gray-500" }, "(all rows)")
                        ]),
                        React.createElement('button', {
                            key: 'csv', onClick: handleExportCSV,
                            className: "w-full flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-blue-50 rounded border border-gray-200 hover:border-blue-200"
                        }, [
                            React.createElement(FileText, { key: 'i', size: 14, className: "text-gray-600" }),
                            React.createElement('span', { key: 'n', className: "text-xs font-medium" }, "CSV")
                        ]),
                        React.createElement('button', {
                            key: 'excel', onClick: handleExportExcel,
                            className: "w-full flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-blue-50 rounded border border-gray-200 hover:border-blue-200"
                        }, [
                            React.createElement(File, { key: 'i', size: 14, className: "text-green-600" }),
                            React.createElement('span', { key: 'n', className: "text-xs font-medium" }, "Excel")
                        ]),
                        React.createElement('button', {
                            key: 'json', onClick: handleExportJSON,
                            className: "w-full flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-blue-50 rounded border border-gray-200 hover:border-blue-200"
                        }, [
                            React.createElement(FileText, { key: 'i', size: 14, className: "text-yellow-600" }),
                            React.createElement('span', { key: 'n', className: "text-xs font-medium" }, "JSON")
                        ]),
                        React.createElement('button', {
                            key: 'mermaid', onClick: handleExportMermaid,
                            className: "w-full flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-blue-50 rounded border border-gray-200 hover:border-blue-200"
                        }, [
                            React.createElement(FileText, { key: 'i', size: 14, className: "text-pink-600" }),
                            React.createElement('span', { key: 'n', className: "text-xs font-medium" }, "Mermaid")
                        ]),
                        React.createElement('button', {
                            key: 'graphml', onClick: handleExportGraphML,
                            className: "w-full flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-blue-50 rounded border border-gray-200 hover:border-blue-200"
                        }, [
                            React.createElement(FileText, { key: 'i', size: 14, className: "text-orange-600" }),
                            React.createElement('span', { key: 'n', className: "text-xs font-medium" }, "GraphML")
                        ]),
                        React.createElement('button', {
                            key: 'dot', onClick: handleExportDOT,
                            className: "w-full flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-blue-50 rounded border border-gray-200 hover:border-blue-200"
                        }, [
                            React.createElement(FileText, { key: 'i', size: 14, className: "text-purple-600" }),
                            React.createElement('span', { key: 'n', className: "text-xs font-medium" }, "DOT")
                        ]),
                        React.createElement('button', {
                            key: 'excalidraw', onClick: handleExportExcalidraw,
                            className: "w-full flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-blue-50 rounded border border-gray-200 hover:border-blue-200"
                        }, [
                            React.createElement(FileText, { key: 'i', size: 14, className: "text-indigo-600" }),
                            React.createElement('span', { key: 'n', className: "text-xs font-medium" }, "Excalidraw")
                        ])
                    ]),

                    // CANVAS column
                    React.createElement('div', {
                        key: 'canvas-col',
                        className: "space-y-2"
                    }, [
                        React.createElement('div', {
                            key: 'canvas-header',
                            className: "text-center pb-2 border-b border-blue-200"
                        }, [
                            React.createElement('div', { key: 'c1', className: "font-bold text-blue-700" }, "Canvas"),
                            React.createElement('div', { key: 'c2', className: "text-xs text-blue-500" }, "(visible only)")
                        ]),
                        React.createElement('button', {
                            key: 'csv', onClick: handleExportCSVCanvas,
                            className: "w-full flex items-center gap-2 px-3 py-2 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 hover:border-blue-300"
                        }, [
                            React.createElement(FileText, { key: 'i', size: 14, className: "text-gray-600" }),
                            React.createElement('span', { key: 'n', className: "text-xs font-medium" }, "CSV")
                        ]),
                        React.createElement('button', {
                            key: 'excel', onClick: handleExportExcelCanvas,
                            className: "w-full flex items-center gap-2 px-3 py-2 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 hover:border-blue-300"
                        }, [
                            React.createElement(File, { key: 'i', size: 14, className: "text-green-600" }),
                            React.createElement('span', { key: 'n', className: "text-xs font-medium" }, "Excel")
                        ]),
                        React.createElement('button', {
                            key: 'json', onClick: handleExportJSONCanvas,
                            className: "w-full flex items-center gap-2 px-3 py-2 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 hover:border-blue-300"
                        }, [
                            React.createElement(FileText, { key: 'i', size: 14, className: "text-yellow-600" }),
                            React.createElement('span', { key: 'n', className: "text-xs font-medium" }, "JSON")
                        ]),
                        React.createElement('button', {
                            key: 'mermaid', onClick: handleExportMermaidCanvas,
                            className: "w-full flex items-center gap-2 px-3 py-2 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 hover:border-blue-300"
                        }, [
                            React.createElement(FileText, { key: 'i', size: 14, className: "text-pink-600" }),
                            React.createElement('span', { key: 'n', className: "text-xs font-medium" }, "Mermaid")
                        ]),
                        React.createElement('button', {
                            key: 'graphml', onClick: handleExportGraphMLCanvas,
                            className: "w-full flex items-center gap-2 px-3 py-2 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 hover:border-blue-300"
                        }, [
                            React.createElement(FileText, { key: 'i', size: 14, className: "text-orange-600" }),
                            React.createElement('span', { key: 'n', className: "text-xs font-medium" }, "GraphML")
                        ]),
                        React.createElement('button', {
                            key: 'dot', onClick: handleExportDOTCanvas,
                            className: "w-full flex items-center gap-2 px-3 py-2 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 hover:border-blue-300"
                        }, [
                            React.createElement(FileText, { key: 'i', size: 14, className: "text-purple-600" }),
                            React.createElement('span', { key: 'n', className: "text-xs font-medium" }, "DOT")
                        ]),
                        React.createElement('button', {
                            key: 'excalidraw', onClick: handleExportExcalidrawCanvas,
                            className: "w-full flex items-center gap-2 px-3 py-2 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 hover:border-blue-300"
                        }, [
                            React.createElement(FileText, { key: 'i', size: 14, className: "text-indigo-600" }),
                            React.createElement('span', { key: 'n', className: "text-xs font-medium" }, "Excalidraw")
                        ]),
                        // Separator for image formats
                        React.createElement('div', { key: 'sep', className: "border-t border-blue-200 pt-2 mt-2" }),
                        React.createElement('button', {
                            key: 'png', onClick: handleExportPNG,
                            className: "w-full flex items-center gap-2 px-3 py-2 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 hover:border-blue-300"
                        }, [
                            React.createElement(Image, { key: 'i', size: 14, className: "text-blue-600" }),
                            React.createElement('span', { key: 'n', className: "text-xs font-medium" }, "PNG")
                        ]),
                        React.createElement('button', {
                            key: 'svg', onClick: handleExportSVG,
                            className: "w-full flex items-center gap-2 px-3 py-2 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 hover:border-blue-300"
                        }, [
                            React.createElement(Image, { key: 'i', size: 14, className: "text-purple-600" }),
                            React.createElement('span', { key: 'n', className: "text-xs font-medium" }, "SVG")
                        ]),
                        React.createElement('button', {
                            key: 'pdf', onClick: handleExportPDF,
                            className: "w-full flex items-center gap-2 px-3 py-2 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 hover:border-blue-300"
                        }, [
                            React.createElement(FileText, { key: 'i', size: 14, className: "text-red-600" }),
                            React.createElement('span', { key: 'n', className: "text-xs font-medium" }, "PDF")
                        ])
                    ])
                ]),

                // Red disclaimer at bottom
                React.createElement('p', {
                    key: 'disclaimer',
                    className: "text-xs text-red-600 mb-3 pt-3 border-t border-red-200"
                }, "Disclaimer: This application is provided as-is for demonstration purposes only. The developers assume no responsibility for data loss, errors, or any damages resulting from its use."),

                React.createElement('button', {
                    key: 'close',
                    onClick: () => setShowExportModal(false),
                    className: "w-full px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
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
            ])),

            // Help modal
            showHelpModal && React.createElement('div', {
                key: 'help-modal',
                className: "fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center modal-overlay",
                onClick: () => setShowHelpModal(false)
            }, React.createElement('div', {
                key: 'modal-content',
                className: "bg-white rounded-lg shadow-xl p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto",
                onClick: (e) => e.stopPropagation()
            }, [
                React.createElement('h3', {
                    key: 'title',
                    className: "text-lg font-semibold mb-4 text-gray-800"
                }, "Help"),

                // Data Model
                React.createElement('div', { key: 'data-model', className: "mb-4" }, [
                    React.createElement('h4', { key: 'h', className: "text-sm font-semibold text-gray-700 mb-2" }, "Data Model"),
                    React.createElement('p', { key: 'p', className: "text-xs text-gray-600" }, "Group | Node | Linked To | Label"),
                    React.createElement('p', { key: 'id', className: "text-xs text-gray-500 mt-1" }, "ID = Group-Node (auto-generated, refs auto-update on rename)")
                ]),

                // Group Operations
                React.createElement('div', { key: 'group-ops', className: "mb-4" }, [
                    React.createElement('h4', { key: 'h', className: "text-sm font-semibold text-gray-700 mb-2" }, "Group Operations"),
                    React.createElement('table', { key: 't', className: "w-full text-xs" }, [
                        React.createElement('tbody', { key: 'tb' }, [
                            React.createElement('tr', { key: '1' }, [
                                React.createElement('td', { key: 'k', className: "font-medium pr-2" }, "Collapse / Expand"),
                                React.createElement('td', { key: 'v', className: "text-gray-600" }, "chevron on row (table only)")
                            ]),
                            React.createElement('tr', { key: '2' }, [
                                React.createElement('td', { key: 'k', className: "font-medium pr-2" }, "Hide / Show"),
                                React.createElement('td', { key: 'v', className: "text-gray-600" }, "eye on row (canvas)")
                            ]),
                            React.createElement('tr', { key: '3' }, [
                                React.createElement('td', { key: 'k', className: "font-medium pr-2" }, "All groups"),
                                React.createElement('td', { key: 'v', className: "text-gray-600" }, "icons in header")
                            ])
                        ])
                    ])
                ]),

                // Node Operations
                React.createElement('div', { key: 'node-ops', className: "mb-4" }, [
                    React.createElement('h4', { key: 'h', className: "text-sm font-semibold text-gray-700 mb-2" }, "Node Operations"),
                    React.createElement('table', { key: 't', className: "w-full text-xs" }, [
                        React.createElement('tbody', { key: 'tb' }, [
                            React.createElement('tr', { key: '1' }, [
                                React.createElement('td', { key: 'k', className: "font-medium pr-2" }, "Delete"),
                                React.createElement('td', { key: 'v', className: "text-gray-600" }, "trash icon (* if referenced)")
                            ]),
                            React.createElement('tr', { key: '2' }, [
                                React.createElement('td', { key: 'k', className: "font-medium pr-2" }, "Duplicate"),
                                React.createElement('td', { key: 'v', className: "text-gray-600" }, "copy icon on row")
                            ]),
                            React.createElement('tr', { key: '3' }, [
                                React.createElement('td', { key: 'k', className: "font-medium pr-2" }, "Clear link"),
                                React.createElement('td', { key: 'v', className: "text-gray-600" }, "X next to Linked To")
                            ])
                        ])
                    ])
                ]),

                // Visual Link Mode
                React.createElement('div', { key: 'link-mode', className: "mb-4" }, [
                    React.createElement('h4', { key: 'h', className: "text-sm font-semibold text-gray-700 mb-2" }, "Visual Link Mode"),
                    React.createElement('p', { key: 'p', className: "text-xs text-gray-600" }, "Click link icon \u2192 click target \u2192 linked. Esc to cancel.")
                ]),

                // Canvas
                React.createElement('div', { key: 'canvas', className: "mb-4" }, [
                    React.createElement('h4', { key: 'h', className: "text-sm font-semibold text-gray-700 mb-2" }, "Canvas"),
                    React.createElement('p', { key: 'p', className: "text-xs text-gray-600" }, "Drag = pan | Scroll = zoom | Fit = reset")
                ]),

                // Validation
                React.createElement('div', { key: 'validation', className: "mb-4" }, [
                    React.createElement('h4', { key: 'h', className: "text-sm font-semibold text-gray-700 mb-2" }, "Validation"),
                    React.createElement('p', { key: 'p', className: "text-xs text-gray-600" }, "\uD83D\uDD34 Broken link | \uD83D\uDFE1 Duplicate ID")
                ]),

                // Disclaimer
                React.createElement('p', {
                    key: 'disclaimer',
                    className: "text-xs text-red-600 mt-4 pt-3 border-t border-gray-200"
                }, "Disclaimer: This application is provided as-is for demonstration purposes. The developers assume no responsibility for data loss, errors, or any damages resulting from its use."),

                React.createElement('button', {
                    key: 'close',
                    onClick: () => setShowHelpModal(false),
                    className: "mt-4 w-full px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                }, "Close")
            ])),

            // Readme modal
            showReadmeModal && React.createElement('div', {
                key: 'readme-modal',
                className: "fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center modal-overlay",
                onClick: () => setShowReadmeModal(false)
            }, React.createElement('div', {
                key: 'modal-content',
                className: "bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4",
                onClick: (e) => e.stopPropagation()
            }, [
                React.createElement('h3', {
                    key: 'title',
                    className: "text-lg font-semibold mb-4 text-gray-800"
                }, "AIdiagram.app"),
                React.createElement('div', {
                    key: 'content',
                    className: "text-sm text-gray-600 space-y-3"
                }, [
                    React.createElement('p', { key: 'p1' },
                        "This application is provided for demonstration and testing purposes only."
                    ),
                    React.createElement('p', { key: 'p2' },
                        "The developers make no warranties regarding accuracy, reliability, or fitness for any particular purpose. Use at your own risk."
                    ),
                    React.createElement('p', { key: 'p3' },
                        "The developers are not responsible for any damages, data loss, or other issues arising from use of this application."
                    ),
                    React.createElement('p', { key: 'p4', className: "text-xs text-gray-400 pt-2" },
                        "By using this application, you acknowledge and accept these terms."
                    )
                ]),
                React.createElement('button', {
                    key: 'close',
                    onClick: () => setShowReadmeModal(false),
                    className: "mt-4 w-full px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                }, "Close")
            ])),

            // Settings modal
            showSettingsModal && React.createElement('div', {
                key: 'settings-modal',
                className: "fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center modal-overlay",
                onClick: () => setShowSettingsModal(false)
            }, React.createElement('div', {
                key: 'modal-content',
                className: "bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4",
                onClick: (e) => e.stopPropagation()
            }, [
                React.createElement('h3', {
                    key: 'title',
                    className: "text-lg font-semibold mb-4 text-gray-800"
                }, "AI Settings"),

                // API Key input
                React.createElement('div', { key: 'api-key-section', className: "mb-4" }, [
                    React.createElement('label', {
                        key: 'label',
                        className: "block text-sm font-medium text-gray-700 mb-1"
                    }, "Anthropic API Key"),
                    React.createElement('div', {
                        key: 'input-group',
                        className: "flex gap-2"
                    }, [
                        React.createElement('input', {
                            key: 'input',
                            type: 'password',
                            value: apiKey,
                            onChange: (e) => setApiKey(e.target.value),
                            placeholder: 'sk-ant-...',
                            className: "flex-1 px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        }),
                        React.createElement('button', {
                            key: 'clear',
                            onClick: clearAPIKey,
                            className: "px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded border border-red-200",
                            title: "Clear API key"
                        }, "Clear")
                    ]),
                    React.createElement('p', {
                        key: 'help',
                        className: "mt-1 text-xs text-gray-500"
                    }, "Your key is stored locally in your browser. Never shared.")
                ]),

                // Model selector
                React.createElement('div', { key: 'model-section', className: "mb-4" }, [
                    React.createElement('label', {
                        key: 'label',
                        className: "block text-sm font-medium text-gray-700 mb-2"
                    }, "Model"),
                    React.createElement('div', {
                        key: 'options',
                        className: "space-y-2"
                    }, [
                        React.createElement('label', {
                            key: 'sonnet',
                            className: "flex items-center gap-2 cursor-pointer"
                        }, [
                            React.createElement('input', {
                                key: 'radio',
                                type: 'radio',
                                name: 'model',
                                checked: aiModel === 'claude-sonnet-4-5-20250929',
                                onChange: () => setAiModel('claude-sonnet-4-5-20250929'),
                                className: "text-blue-600"
                            }),
                            React.createElement('span', { key: 'text', className: "text-sm" }, "Sonnet 4.5"),
                            React.createElement('span', { key: 'desc', className: "text-xs text-gray-500" }, "(faster, cheaper)")
                        ]),
                        React.createElement('label', {
                            key: 'opus',
                            className: "flex items-center gap-2 cursor-pointer"
                        }, [
                            React.createElement('input', {
                                key: 'radio',
                                type: 'radio',
                                name: 'model',
                                checked: aiModel === 'claude-opus-4-5-20250929',
                                onChange: () => setAiModel('claude-opus-4-5-20250929'),
                                className: "text-blue-600"
                            }),
                            React.createElement('span', { key: 'text', className: "text-sm" }, "Opus 4.5"),
                            React.createElement('span', { key: 'desc', className: "text-xs text-gray-500" }, "(best quality)")
                        ])
                    ])
                ]),

                // Buttons
                React.createElement('div', {
                    key: 'buttons',
                    className: "flex gap-2 mt-6"
                }, [
                    React.createElement('button', {
                        key: 'cancel',
                        onClick: () => setShowSettingsModal(false),
                        className: "flex-1 px-4 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded"
                    }, "Cancel"),
                    React.createElement('button', {
                        key: 'save',
                        onClick: saveAPISettings,
                        className: "flex-1 px-4 py-2 text-sm text-white bg-blue-500 hover:bg-blue-600 rounded"
                    }, "Save")
                ])
            ])),

            // AI Chat modal (draggable, resizable, no overlay)
            showAIModal && React.createElement('div', {
                key: 'ai-modal',
                className: "fixed z-50 bg-white rounded-lg shadow-2xl flex flex-col border border-gray-300",
                style: {
                    left: aiModalPos.x,
                    top: aiModalPos.y,
                    width: aiModalSize.width,
                    height: aiModalSize.height,
                    userSelect: aiDragging || aiResizing ? 'none' : 'auto'
                }
            }, [
                // Draggable Header
                React.createElement('div', {
                    key: 'header',
                    className: "flex items-center justify-between p-3 border-b border-gray-200 bg-gray-50 rounded-t-lg cursor-move",
                    onMouseDown: handleAiDragStart
                }, [
                    React.createElement('div', {
                        key: 'title-area',
                        className: "flex items-center gap-2"
                    }, [
                        React.createElement(Sparkles, { key: 'icon', size: 18, className: "text-purple-500" }),
                        React.createElement('span', { key: 'title', className: "font-semibold text-gray-800 text-sm" }, "AI Assistant")
                    ]),
                    React.createElement('div', {
                        key: 'header-buttons',
                        className: "flex items-center gap-2"
                    }, [
                        // Clear history button
                        aiConversation.length > 0 && React.createElement('button', {
                            key: 'clear-history',
                            onClick: () => setAiConversation([]),
                            className: "text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-200",
                            title: "Clear conversation"
                        }, "Clear"),
                        // Close button
                        React.createElement('button', {
                            key: 'close',
                            onClick: () => { setShowAIModal(false); setAiError(''); },
                            className: "text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-200 rounded",
                            title: "Close"
                        }, React.createElement(X, { size: 18 }))
                    ])
                ]),

                // Context badge
                React.createElement('div', {
                    key: 'context-badge',
                    className: "px-3 py-1.5 bg-gray-50 border-b border-gray-200 flex items-center justify-between"
                }, [
                    React.createElement('span', {
                        key: 'context',
                        className: "text-xs text-gray-500"
                    }, nodes.length > 0
                        ? `${nodes.length} nodes, ${new Set(nodes.map(n => n.Group_xA)).size} groups`
                        : 'No graph - describe what to create'),
                    React.createElement('span', {
                        key: 'model',
                        className: "text-xs text-gray-400"
                    }, aiModel.includes('opus') ? 'Opus 4.5' : 'Sonnet 4.5')
                ]),

                // Conversation panel (scrollable)
                React.createElement('div', {
                    key: 'conversation',
                    className: "flex-1 overflow-y-auto p-3 space-y-2",
                    style: { minHeight: '100px' }
                }, aiConversation.length === 0
                    ? React.createElement('div', {
                        key: 'empty-state',
                        className: "text-center text-gray-400 py-6"
                    }, [
                        React.createElement('p', { key: 'line1', className: "mb-1 text-sm" }, "Start a conversation"),
                        React.createElement('p', { key: 'line2', className: "text-xs" }, '"Create a home network"'),
                        React.createElement('p', { key: 'line3', className: "text-xs" }, '"Add a printer"')
                    ])
                    : aiConversation.map((msg, idx) =>
                        React.createElement('div', {
                            key: `msg-${idx}`,
                            className: `flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`
                        }, React.createElement('div', {
                            className: `max-w-[85%] px-2.5 py-1.5 rounded-lg text-xs ${
                                msg.role === 'user'
                                    ? 'bg-purple-500 text-white'
                                    : msg.type === 'message'
                                        ? 'bg-gray-100 text-gray-800'
                                        : 'bg-green-50 text-green-800 border border-green-200'
                            }`
                        }, [
                            msg.role === 'assistant' && msg.type !== 'message' && React.createElement('span', {
                                key: 'badge',
                                className: "text-xs font-medium block mb-0.5 opacity-70"
                            }, msg.type === 'full' ? '📊 Generated' : '✏️ Modified'),
                            React.createElement('span', { key: 'content' }, msg.content)
                        ]))
                    )
                ),

                // Error display
                aiError && React.createElement('div', {
                    key: 'error',
                    className: "mx-3 mb-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700"
                }, aiError),

                // Input area
                React.createElement('div', {
                    key: 'input-area',
                    className: "p-3 border-t border-gray-200"
                }, [
                    React.createElement('div', {
                        key: 'input-row',
                        className: "flex gap-2"
                    }, [
                        React.createElement('textarea', {
                            key: 'textarea',
                            value: aiPrompt,
                            onChange: (e) => setAiPrompt(e.target.value),
                            onKeyDown: (e) => {
                                if (e.key === 'Enter' && !e.shiftKey && aiPrompt.trim() && !aiLoading) {
                                    e.preventDefault();
                                    generateFromAI();
                                }
                            },
                            placeholder: nodes.length > 0
                                ? "Ask a question or describe changes..."
                                : "Describe your diagram...",
                            rows: 2,
                            disabled: aiLoading,
                            className: "flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none disabled:bg-gray-100"
                        }),
                        React.createElement('button', {
                            key: 'send',
                            onClick: generateFromAI,
                            disabled: aiLoading || !aiPrompt.trim(),
                            className: "px-4 py-2 text-sm text-white bg-purple-500 hover:bg-purple-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center",
                            title: "Send (Enter)"
                        }, aiLoading
                            ? React.createElement('span', { className: "inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" })
                            : React.createElement(Send, { size: 18 })
                        )
                    ]),
                    React.createElement('p', {
                        key: 'hint',
                        className: "mt-1 text-xs text-gray-400"
                    }, "Enter to send · Drag header to move")
                ]),

                // Resize handle (bottom-right corner)
                React.createElement('div', {
                    key: 'resize-handle',
                    className: "absolute bottom-0 right-0 w-4 h-4 cursor-se-resize",
                    style: {
                        background: 'linear-gradient(135deg, transparent 50%, #9ca3af 50%)',
                        borderBottomRightRadius: '0.5rem'
                    },
                    onMouseDown: (e) => {
                        setAiResizing(true);
                        e.preventDefault();
                        e.stopPropagation();
                    }
                })
            ])
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
