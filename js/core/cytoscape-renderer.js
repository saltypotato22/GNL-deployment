/**
 * Cytoscape Graph Renderer
 *
 * Migrated from Mermaid.js to Cytoscape.js for canvas rendering.
 * Benefits: Better layout control, node dragging, compound nodes (groups),
 * and stable incremental positioning.
 *
 * Note: Mermaid.js is retained for text/syntax export only.
 *
 * Layout: Custom TB/LR with group labels as virtual first nodes (Graphviz-inspired)
 * Group order preserved from data array to ensure cloned groups appear next to originals.
 */

(function(window) {
    'use strict';

    let cy = null;  // Cytoscape instance
    const nodePositions = new Map();  // Store positions for stability
    let currentGroupOrder = [];  // Store group order from data (for layout)
    let currentHideLinks = false;  // Track hide links state for layout decisions

    /**
     * Convert nodes array to Cytoscape elements format
     * @param {Array} nodes - Array of node objects from data model
     * @param {Set} hiddenGroups - Groups to hide from canvas
     * @param {Boolean} hideUnlinkedNodes - Hide nodes with no links
     * @param {Boolean} hideLinkedNodes - Hide nodes that have links
     * @param {Boolean} hideLinks - Hide all link lines from canvas
     * @returns {Array} Cytoscape elements array
     */
    const nodesToElements = function(nodes, hiddenGroups, hideUnlinkedNodes, hideLinkedNodes, hideLinks) {
        const elements = [];
        const visibleNodeIDs = new Set();
        const hidden = hiddenGroups || new Set();

        // Build linked node set - always computed for filtering AND styling
        const linkedNodeIDs = new Set();
        nodes.forEach(node => {
            if (node.Linked_Node_ID_xA && !node.Hidden_Link_xB) {
                linkedNodeIDs.add(node.ID_xA);
                linkedNodeIDs.add(node.Linked_Node_ID_xA);
            }
        });

        // Collect unique groups (compound/parent nodes)
        const groups = new Set();
        nodes.forEach(node => {
            if (node.Hidden_Node_xB == 1) return;
            if (hidden.has(node.Group_xA)) return;
            if (hideUnlinkedNodes && !linkedNodeIDs.has(node.ID_xA)) return;
            if (hideLinkedNodes && linkedNodeIDs.has(node.ID_xA)) return;

            groups.add(node.Group_xA || 'Ungrouped');
            visibleNodeIDs.add(node.ID_xA);
        });

        // Store group order for layout (preserves data order)
        currentGroupOrder = [...groups].map(g => `group_${g}`);

        // Add group (parent/compound) nodes first, then label nodes
        groups.forEach(groupName => {
            // Compound node (label hidden - we use label nodes instead)
            elements.push({
                group: 'nodes',
                data: {
                    id: `group_${groupName}`,
                    label: '',  // Hide compound node label
                    isGroup: true
                }
            });

            // Label node - appears inside group as virtual first node
            const labelId = `label_${groupName}`;
            const labelPosition = nodePositions.get(labelId);
            elements.push({
                group: 'nodes',
                data: {
                    id: labelId,
                    label: groupName,
                    parent: `group_${groupName}`,
                    isGroupLabel: true,
                    isGroup: false
                },
                position: labelPosition ? { ...labelPosition } : undefined
            });
        });

        // Add regular nodes with parent reference
        nodes.forEach(node => {
            if (node.Hidden_Node_xB == 1) return;
            if (hidden.has(node.Group_xA)) return;
            if (hideUnlinkedNodes && !linkedNodeIDs.has(node.ID_xA)) return;
            if (hideLinkedNodes && linkedNodeIDs.has(node.ID_xA)) return;

            const groupName = node.Group_xA || 'Ungrouped';
            const storedPosition = nodePositions.get(node.ID_xA);

            elements.push({
                group: 'nodes',
                data: {
                    id: node.ID_xA,
                    label: node.Node_xA || '',
                    parent: `group_${groupName}`,
                    isGroup: false,
                    isLinked: linkedNodeIDs.has(node.ID_xA)  // For bold border when links hidden
                },
                // Restore position if we have it stored
                position: storedPosition ? { ...storedPosition } : undefined
            });
        });

        // Add edges (skip if hideLinks is true)
        if (!hideLinks) {
            nodes.forEach(node => {
                if (!node.Linked_Node_ID_xA || node.Hidden_Link_xB == 1) return;
                if (!visibleNodeIDs.has(node.ID_xA)) return;
                if (!visibleNodeIDs.has(node.Linked_Node_ID_xA)) return;

                elements.push({
                    group: 'edges',
                    data: {
                        id: `edge_${node.ID_xA}_to_${node.Linked_Node_ID_xA}`,
                        source: node.ID_xA,
                        target: node.Linked_Node_ID_xA,
                        label: node.Link_Label_xB || '',
                        arrow: node.Link_Arrow_xB || 'To'
                    }
                });
            });
        }

        return elements;
    };

    /**
     * Cytoscape stylesheet - matches Mermaid visual style
     */
    const defaultStyle = [
        // Regular nodes (not groups, not labels) - ultra tight fit, 3px total padding
        {
            selector: 'node[!isGroup][!isGroupLabel]',
            style: {
                'label': 'data(label)',
                'text-valign': 'center',
                'text-halign': 'center',
                'text-wrap': 'none',
                'background-color': '#ffffff',
                'border-width': 1,
                'border-color': '#333333',
                'shape': 'roundrectangle',
                'width': 'label',
                'height': 'label',
                'padding': '3px',
                'font-size': '10px',
                'font-family': '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
            }
        },
        // Group label nodes - invisible background, bold text only
        {
            selector: 'node[?isGroupLabel]',
            style: {
                'label': 'data(label)',
                'text-valign': 'center',
                'text-halign': 'center',
                'text-wrap': 'none',
                'background-opacity': 0,
                'border-width': 0,
                'shape': 'roundrectangle',
                'width': 'label',
                'height': 'label',
                'padding': '3px',
                'font-size': '10px',
                'font-weight': 'bold',
                'font-family': '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
            }
        },
        // Group (parent/compound) nodes - 3px padding, label hidden (using label nodes)
        {
            selector: 'node[?isGroup]',
            style: {
                'label': 'data(label)',
                'text-valign': 'center',
                'text-halign': 'left',
                'text-margin-x': 6,
                'text-margin-y': 0,
                'background-color': '#ffffff',
                'background-opacity': 0,
                'border-width': 1,
                'border-color': '#999999',
                'border-style': 'dashed',
                'shape': 'roundrectangle',
                'padding': '3px',
                'font-size': '10px',
                'font-weight': 'bold',
                'font-family': '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
            }
        },
        // All edges base style
        {
            selector: 'edge',
            style: {
                'label': 'data(label)',
                'width': 1,
                'line-color': '#333333',
                'curve-style': 'bezier',
                'arrow-scale': 0.6,  // Smaller, more elegant arrow heads
                'font-size': '8px',
                'text-background-color': '#ffffff',
                'text-background-opacity': 1,
                'text-background-padding': '3px',
                'text-rotation': 'autorotate',
                'font-family': '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
            }
        },
        // Arrow styles based on Link_Arrow_xB value
        {
            selector: 'edge[arrow = "To"]',
            style: {
                'target-arrow-shape': 'triangle',
                'target-arrow-color': '#333333',
                'source-arrow-shape': 'none'
            }
        },
        {
            selector: 'edge[arrow = "From"]',
            style: {
                'source-arrow-shape': 'triangle',
                'source-arrow-color': '#333333',
                'target-arrow-shape': 'none'
            }
        },
        {
            selector: 'edge[arrow = "Both"]',
            style: {
                'source-arrow-shape': 'triangle',
                'source-arrow-color': '#333333',
                'target-arrow-shape': 'triangle',
                'target-arrow-color': '#333333'
            }
        },
        {
            selector: 'edge[arrow = "None"]',
            style: {
                'source-arrow-shape': 'none',
                'target-arrow-shape': 'none'
            }
        }
    ];

    /**
     * Initialize or update Cytoscape instance
     * Uses incremental layout - existing nodes keep their positions
     * @param {Array} nodes - Array of node objects
     * @param {Object} settings - Diagram settings (direction, curve, zoom)
     * @param {Set} hiddenGroups - Groups to hide
     * @param {Boolean} hideUnlinkedNodes - Hide unlinked nodes
     * @param {Boolean} hideLinkedNodes - Hide linked nodes
     * @param {String} containerId - DOM container ID
     * @returns {Object} Cytoscape instance
     */
    const renderCytoscape = function(nodes, settings, hiddenGroups, hideUnlinkedNodes, hideLinkedNodes, hideLinks, containerId) {
        const container = document.getElementById(containerId);
        if (!container) {
            throw new Error(`Container ${containerId} not found`);
        }

        // Store hideLinks state for layout decisions
        currentHideLinks = hideLinks || false;

        const elements = nodesToElements(nodes, hiddenGroups, hideUnlinkedNodes, hideLinkedNodes, hideLinks);

        // Map UI curve values to Cytoscape curve-style
        // Note: 'bezier' only curves when multiple edges exist between same nodes
        // Use 'unbundled-bezier' with control-point-distance for visible curves on single edges
        const curveStyleMap = {
            'basis': 'unbundled-bezier',  // Curved (with explicit control points)
            'linear': 'straight',          // Straight line
            'step': 'taxi'                 // Orthogonal (right angles)
        };
        const curveStyle = curveStyleMap[settings.curve] || 'unbundled-bezier';

        // Store current positions before re-render (only non-group nodes)
        if (cy) {
            cy.nodes('[!isGroup]').forEach(node => {
                nodePositions.set(node.id(), { ...node.position() });
            });
        }

        // Determine which nodes are new (don't have stored positions)
        const existingNodeIDs = new Set(nodePositions.keys());
        const newNodeIDs = elements
            .filter(el => el.group === 'nodes' && !el.data.isGroup && !existingNodeIDs.has(el.data.id))
            .map(el => el.data.id);

        // Build fixed constraints for existing nodes
        const fixedNodeConstraint = [];
        elements.forEach(el => {
            if (el.group === 'nodes' && !el.data.isGroup && nodePositions.has(el.data.id)) {
                fixedNodeConstraint.push({
                    nodeId: el.data.id,
                    position: nodePositions.get(el.data.id)
                });
            }
        });

        // Build dynamic style array - add linked node highlight when links are hidden
        const styleArray = [...defaultStyle];
        if (hideLinks) {
            // When links are hidden, show thicker borders on linked nodes
            styleArray.push({
                selector: 'node[?isLinked][!isGroup][!isGroupLabel]',
                style: {
                    'border-width': 2  // 2px vs 1px for unlinked nodes
                }
            });
        }

        // Create new instance or update existing
        if (!cy) {
            cy = cytoscape({
                container: container,
                elements: elements,
                style: styleArray,
                layout: { name: 'preset' },  // Use stored/specified positions initially
                wheelSensitivity: 0.3,
                minZoom: 0.1,
                maxZoom: 5,
                boxSelectionEnabled: false,
                autounselectify: true
            });

            // Save positions when user drags nodes
            cy.on('dragfree', 'node[!isGroup]', function(evt) {
                const node = evt.target;
                nodePositions.set(node.id(), { ...node.position() });
            });

            // Prevent overlap during drag - push other nodes away with cascading resolution
            cy.on('drag', 'node[!isGroup]', function(evt) {
                const draggedNode = evt.target;
                const draggedId = draggedNode.id();
                const PADDING = 3;  // Minimum 3px gap between nodes
                const MAX_ITERATIONS = 30;  // Prevent infinite loops

                // Get ALL non-group nodes including labels - prevents cross-group overlaps
                const allNodes = cy.nodes('[!isGroup]').toArray();

                // Track nodes pushed by dragged node (prevents pushing to <3px, but allows fixing actual overlaps)
                const pushedByDragged = new Set();

                // Check if two bounding boxes ACTUALLY OVERLAP (gap < 0)
                const boxesOverlap = function(bb1, bb2) {
                    const separatedX = bb1.x2 <= bb2.x1 || bb2.x2 <= bb1.x1;
                    const separatedY = bb1.y2 <= bb2.y1 || bb2.y2 <= bb1.y1;
                    return !separatedX && !separatedY;
                };

                // Check if two bounding boxes are too close (gap < PADDING)
                // Used for cascading to ensure minimum spacing
                const boxesTooClose = function(bb1, bb2) {
                    const separatedX = bb1.x2 + PADDING <= bb2.x1 || bb2.x2 + PADDING <= bb1.x1;
                    const separatedY = bb1.y2 + PADDING <= bb2.y1 || bb2.y2 + PADDING <= bb1.y1;
                    return !separatedX && !separatedY;
                };

                // Calculate push needed to create exactly PADDING gap (no extra buffer)
                const calculatePush = function(fixedBB, movableBB, fixedPos, movablePos) {
                    const dx = movablePos.x - fixedPos.x;
                    const dy = movablePos.y - fixedPos.y;

                    let pushX, pushY;
                    if (dx >= 0) {
                        pushX = fixedBB.x2 + PADDING - movableBB.x1;  // Exact 3px gap
                    } else {
                        pushX = -(movableBB.x2 + PADDING - fixedBB.x1);
                    }
                    if (dy >= 0) {
                        pushY = fixedBB.y2 + PADDING - movableBB.y1;
                    } else {
                        pushY = -(movableBB.y2 + PADDING - fixedBB.y1);
                    }

                    return { x: pushX, y: pushY };
                };

                // Iteratively resolve ALL overlaps until none remain
                for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
                    let foundOverlap = false;

                    // Check all pairs of nodes for overlap
                    for (let i = 0; i < allNodes.length && !foundOverlap; i++) {
                        for (let j = i + 1; j < allNodes.length && !foundOverlap; j++) {
                            const nodeA = allNodes[i];
                            const nodeB = allNodes[j];
                            // Exclude overlays to use actual node edge, not selection highlight
                            const bbA = nodeA.boundingBox({ includeOverlays: false });
                            const bbB = nodeB.boundingBox({ includeOverlays: false });

                            const isADragged = nodeA.id() === draggedId;
                            const isBDragged = nodeB.id() === draggedId;

                            // Determine if we should push
                            let shouldPush = false;
                            if (isADragged || isBDragged) {
                                const otherNodeId = isADragged ? nodeB.id() : nodeA.id();
                                const actuallyOverlapping = boxesOverlap(bbA, bbB);
                                const tooClose = boxesTooClose(bbA, bbB);
                                const alreadyPushed = pushedByDragged.has(otherNodeId);

                                // Push if: actually overlapping (always fix overlaps)
                                // OR: too close AND not already pushed (ensures 3px min once)
                                shouldPush = actuallyOverlapping || (tooClose && !alreadyPushed);
                            } else {
                                // Cascading: always ensure 3px gap
                                shouldPush = boxesTooClose(bbA, bbB);
                            }

                            if (shouldPush) {
                                foundOverlap = true;

                                const posA = nodeA.position();
                                const posB = nodeB.position();

                                if (isADragged && !isBDragged) {
                                    // A is dragged, push B away
                                    const push = calculatePush(bbA, bbB, posA, posB);
                                    if (Math.abs(push.x) < Math.abs(push.y)) {
                                        nodeB.position({ x: posB.x + push.x, y: posB.y });
                                    } else {
                                        nodeB.position({ x: posB.x, y: posB.y + push.y });
                                    }
                                    pushedByDragged.add(nodeB.id());
                                } else if (!isADragged && isBDragged) {
                                    // B is dragged, push A away
                                    const push = calculatePush(bbB, bbA, posB, posA);
                                    if (Math.abs(push.x) < Math.abs(push.y)) {
                                        nodeA.position({ x: posA.x + push.x, y: posA.y });
                                    } else {
                                        nodeA.position({ x: posA.x, y: posA.y + push.y });
                                    }
                                    pushedByDragged.add(nodeA.id());
                                } else {
                                    // Neither is dragged (cascading collision)
                                    // If one was pushed by dragged, only move the other (prevents cascade undoing initial push)
                                    const aWasPushed = pushedByDragged.has(nodeA.id());
                                    const bWasPushed = pushedByDragged.has(nodeB.id());

                                    if (aWasPushed && !bWasPushed) {
                                        // A was pushed by dragged, only move B
                                        const push = calculatePush(bbA, bbB, posA, posB);
                                        if (Math.abs(push.x) < Math.abs(push.y)) {
                                            nodeB.position({ x: posB.x + push.x, y: posB.y });
                                        } else {
                                            nodeB.position({ x: posB.x, y: posB.y + push.y });
                                        }
                                    } else if (bWasPushed && !aWasPushed) {
                                        // B was pushed by dragged, only move A
                                        const push = calculatePush(bbB, bbA, posB, posA);
                                        if (Math.abs(push.x) < Math.abs(push.y)) {
                                            nodeA.position({ x: posA.x + push.x, y: posA.y });
                                        } else {
                                            nodeA.position({ x: posA.x, y: posA.y + push.y });
                                        }
                                    } else {
                                        // Neither or both pushed - split the push
                                        const push = calculatePush(bbA, bbB, posA, posB);
                                        const halfX = push.x / 2;
                                        const halfY = push.y / 2;
                                        if (Math.abs(push.x) < Math.abs(push.y)) {
                                            nodeA.position({ x: posA.x - halfX, y: posA.y });
                                            nodeB.position({ x: posB.x + halfX, y: posB.y });
                                        } else {
                                            nodeA.position({ x: posA.x, y: posA.y - halfY });
                                            nodeB.position({ x: posB.x, y: posB.y + halfY });
                                        }
                                    }
                                }
                            }
                        }
                    }

                    // No overlaps found - we're done
                    if (!foundOverlap) break;
                }
            });
        } else {
            // Update elements - Cytoscape handles diff efficiently
            cy.json({ elements: elements });
            // Update style for hideLinks toggle (linked node borders)
            cy.style(styleArray).update();
        }

        // Run layout only if there are new nodes or no positions stored
        const needsLayout = newNodeIDs.length > 0 || nodePositions.size === 0;
        const isFirstLayout = nodePositions.size === 0;

        if (needsLayout) {
            if (isFirstLayout) {
                // First layout: Use the currently selected layout algorithm
                const layoutType = settings.layout || 'fcose';
                if (layoutType === 'fcose') {
                    // Smart Layout (fcose) needs initial positions, so run compact TB first
                    runLayout('TB');
                    setTimeout(() => {
                        runFcoseLayout();
                    }, 100);
                } else if (layoutType === 'dagre-TB') {
                    runDagreLayout('TB');
                } else if (layoutType === 'dagre-LR') {
                    runDagreLayout('LR');
                } else if (layoutType === 'compact-TB') {
                    runLayout('TB');
                } else if (layoutType === 'compact-LR') {
                    runLayout('LR');
                } else {
                    // Fallback to fcose (Smart Layout) as default
                    runLayout('TB');
                    setTimeout(() => {
                        runFcoseLayout();
                    }, 100);
                }
            } else {
                // Incremental update: position new nodes near their linked nodes
                newNodeIDs.forEach(nodeId => {
                    const node = cy.getElementById(nodeId);
                    if (node.length > 0) {
                        // Find a connected node to position near
                        const connectedEdges = node.connectedEdges();
                        if (connectedEdges.length > 0) {
                            const connectedNode = connectedEdges[0].connectedNodes().filter(n => n.id() !== nodeId)[0];
                            if (connectedNode) {
                                const pos = connectedNode.position();
                                node.position({ x: pos.x + 100, y: pos.y });
                            }
                        } else {
                            // No connections, place at origin
                            node.position({ x: 100, y: 100 });
                        }
                    }
                });
            }
        }

        // Update stored positions after layout completes
        cy.nodes('[!isGroup]').forEach(node => {
            nodePositions.set(node.id(), { ...node.position() });
        });

        // Apply curve style from settings (dynamic, works for init and updates)
        // For unbundled-bezier, add control point distance for visible curves
        const edgeStyles = { 'curve-style': curveStyle };
        if (curveStyle === 'unbundled-bezier') {
            edgeStyles['control-point-distances'] = 40;  // Perpendicular distance for curve arc
            edgeStyles['control-point-weights'] = 0.5;   // Midpoint of edge
        }
        cy.style().selector('edge').style(edgeStyles).update();

        return cy;
    };

    /**
     * Clear stored positions and destroy instance
     * Call this on new file import to get fresh layout
     */
    const clearPositions = function() {
        nodePositions.clear();
        if (cy) {
            cy.destroy();
            cy = null;
        }
    };

    /**
     * Fit diagram to screen with padding
     * Fits to regular nodes only (not compound/group nodes) for tighter fit
     * @param {Number} padding - Padding in pixels (default 50)
     */
    const fitToScreen = function(padding) {
        if (cy) {
            // Fit to regular nodes only - compound nodes add too much padding
            const regularNodes = cy.nodes('[!isGroup]');
            if (regularNodes.length > 0) {
                cy.fit(regularNodes, padding || 50);
            } else {
                cy.fit(padding || 50);
            }
        }
    };

    /**
     * Set zoom level (percentage-based like original)
     * @param {Number} zoomPercent - Zoom percentage (10-500)
     */
    const setZoom = function(zoomPercent) {
        if (cy) {
            const zoomLevel = zoomPercent / 100;
            cy.zoom(zoomLevel);
            cy.center();
        }
    };

    /**
     * Get current zoom level as percentage
     * @returns {Number} Zoom percentage
     */
    const getZoom = function() {
        if (cy) {
            return Math.round(cy.zoom() * 100);
        }
        return 100;
    };

    /**
     * Pan the canvas by offset
     * @param {Number} deltaX - X offset
     * @param {Number} deltaY - Y offset
     */
    const pan = function(deltaX, deltaY) {
        if (cy) {
            const currentPan = cy.pan();
            cy.pan({
                x: currentPan.x + deltaX,
                y: currentPan.y + deltaY
            });
        }
    };

    /**
     * Reset zoom and pan to default
     */
    const resetView = function() {
        if (cy) {
            cy.fit(50);
        }
    };

    /**
     * Get Cytoscape instance for exports
     * @returns {Object} Cytoscape instance or null
     */
    const getInstance = function() {
        return cy;
    };

    /**
     * Check if instance exists and has nodes
     * @returns {Boolean}
     */
    const hasGraph = function() {
        return cy && cy.nodes().length > 0;
    };

    /**
     * Reposition group labels to top-left of their bounding boxes
     * Call after any layout completes for consistent label placement
     */
    const repositionLabelsToTopLeft = function() {
        if (!cy) return;

        const LABEL_OFFSET = 6;  // Padding from group edge

        // Get all label nodes
        const labelNodes = cy.nodes('[?isGroupLabel]');

        labelNodes.forEach(labelNode => {
            const parentId = labelNode.data('parent');
            const parentGroup = cy.getElementById(parentId);

            if (parentGroup.length > 0) {
                // Get bounding box of sibling nodes (excluding the label itself)
                const siblingNodes = parentGroup.children().filter(n => !n.data('isGroupLabel'));
                if (siblingNodes.length === 0) return;

                const bbox = siblingNodes.boundingBox({ includeOverlays: false });

                // Position label at top-left, accounting for label's own dimensions
                const labelBB = labelNode.boundingBox({ includeOverlays: false });
                const labelW = labelBB.w;
                const labelH = labelBB.h;

                labelNode.position({
                    x: bbox.x1 + labelW / 2 + LABEL_OFFSET,
                    y: bbox.y1 - labelH / 2 - LABEL_OFFSET  // Above the nodes
                });
            }
        });
    };

    /**
     * Calculate node width from label (estimates for layout before render)
     * 10px font ~= 6px per char, plus 6px padding (3px each side) + 2px border
     */
    const calcNodeWidth = function(node) {
        const label = node.data('label') || '';
        return Math.max(20, label.length * 6 + 8);
    };

    /**
     * Calculate node height (10px font line height ~14px + 6px padding + 2px border)
     */
    const calcNodeHeight = function() {
        return 22;
    };

    /**
     * Run layout based on direction setting
     * TB (Top to Bottom): Groups stack vertically, nodes flow horizontally within groups
     * LR (Left to Right): Groups stack horizontally, nodes flow vertically within groups
     * Label nodes are positioned FIRST (LEFT in TB, TOP in LR)
     * 3px padding everywhere - ultra compact, NO overlap
     * @param {String} direction - 'TB' or 'LR'
     */
    const runLayout = function(direction) {
        if (!cy) return;

        const dir = direction || 'TB';
        const PADDING = 3;      // 3px padding between nodes within a group
        const GROUP_GAP = 15;   // 15px gap between groups (visible separation)

        // Get all non-compound nodes (includes both label nodes and regular nodes)
        const allNodes = cy.nodes('[!isGroup]');

        // Separate label nodes from regular nodes, build group mapping
        const groupNodes = new Map();  // groupId -> regular nodes
        const labelNodes = new Map();  // groupId -> label node

        allNodes.forEach(node => {
            const parentId = node.data('parent');

            if (node.data('isGroupLabel')) {
                // This is a label node
                labelNodes.set(parentId, node);
                if (!groupNodes.has(parentId)) {
                    groupNodes.set(parentId, []);
                }
            } else {
                // Regular node
                if (!groupNodes.has(parentId)) {
                    groupNodes.set(parentId, []);
                }
                groupNodes.get(parentId).push(node);
            }
        });

        // Use stored group order (from nodesToElements) to preserve data order
        const groupOrder = currentGroupOrder;

        const positions = new Map();
        let currentX = PADDING;
        let currentY = PADDING;
        const nodeH = calcNodeHeight();

        if (dir === 'TB') {
            // TB: Groups top-to-bottom, label at LEFT, then nodes left-to-right
            groupOrder.forEach(groupId => {
                const regularNodes = groupNodes.get(groupId) || [];
                const labelNode = labelNodes.get(groupId);

                // Need at least label node or regular nodes
                if (!labelNode && regularNodes.length === 0) return;

                let nodeX = PADDING;

                // Position label node first (at LEFT)
                if (labelNode) {
                    const labelWidth = calcNodeWidth(labelNode);
                    positions.set(labelNode.id(), {
                        x: nodeX + labelWidth / 2,
                        y: currentY + nodeH / 2
                    });
                    nodeX += labelWidth + PADDING;
                }

                // Position regular nodes left-to-right
                regularNodes.forEach(node => {
                    const w = calcNodeWidth(node);
                    positions.set(node.id(), {
                        x: nodeX + w / 2,
                        y: currentY + nodeH / 2
                    });
                    nodeX += w + PADDING;
                });

                // Move to next group (below) - use GROUP_GAP for vertical separation
                currentY += nodeH + GROUP_GAP;
            });
        } else {
            // LR: Groups left-to-right, label at TOP, then nodes top-to-bottom
            groupOrder.forEach(groupId => {
                const regularNodes = groupNodes.get(groupId) || [];
                const labelNode = labelNodes.get(groupId);

                if (!labelNode && regularNodes.length === 0) return;

                // Find max width in this group (including label)
                let maxWidth = 0;
                if (labelNode) {
                    maxWidth = calcNodeWidth(labelNode);
                }
                regularNodes.forEach(node => {
                    maxWidth = Math.max(maxWidth, calcNodeWidth(node));
                });

                let nodeY = PADDING;

                // Position label node first (at TOP)
                if (labelNode) {
                    positions.set(labelNode.id(), {
                        x: currentX + maxWidth / 2,
                        y: nodeY + nodeH / 2
                    });
                    nodeY += nodeH + PADDING;
                }

                // Position regular nodes top-to-bottom
                regularNodes.forEach(node => {
                    positions.set(node.id(), {
                        x: currentX + maxWidth / 2,
                        y: nodeY + nodeH / 2
                    });
                    nodeY += nodeH + PADDING;
                });

                // Move to next group (right) - use GROUP_GAP for horizontal separation
                currentX += maxWidth + GROUP_GAP;
            });
        }

        // Apply positions
        allNodes.forEach(node => {
            const pos = positions.get(node.id());
            if (pos) {
                node.position(pos);
            }
        });

        // Save positions (only for non-label nodes to preserve draggability)
        allNodes.forEach(node => {
            if (!node.data('isGroupLabel')) {
                nodePositions.set(node.id(), { ...node.position() });
            }
        });

        // Reposition labels to top-left of each group
        repositionLabelsToTopLeft();

        // Fit to screen
        cy.fit(20);
    };

    /**
     * Run auto-layout - clears stored positions and runs fresh layout
     * @param {String} direction - 'TB' or 'LR'
     */
    const runAutoLayout = function(direction) {
        if (!cy) return;
        nodePositions.clear();
        runLayout(direction || 'TB');
    };

    /**
     * Set table-order positions as initial layout
     * Used as pre-layout for fcose/dagre to bias toward table order
     * Groups appear top-to-bottom, nodes within groups left-to-right
     * @param {boolean} extraSpacing - Use extra spacing when links hidden to prevent overlap
     */
    const setTableOrderPositions = function(extraSpacing) {
        if (!cy) return;

        const SPACING_X = extraSpacing ? 140 : 100;  // Horizontal spacing between nodes
        const SPACING_Y = extraSpacing ? 120 : 80;   // Vertical spacing between groups
        const GROUP_GAP = extraSpacing ? 60 : 0;     // Extra gap between groups

        // Get all non-compound nodes
        const allNodes = cy.nodes('[!isGroup]');

        // Separate label nodes from regular nodes, build group mapping
        const groupNodes = new Map();
        const labelNodes = new Map();

        allNodes.forEach(node => {
            const parentId = node.data('parent');
            if (node.data('isGroupLabel')) {
                labelNodes.set(parentId, node);
                if (!groupNodes.has(parentId)) {
                    groupNodes.set(parentId, []);
                }
            } else {
                if (!groupNodes.has(parentId)) {
                    groupNodes.set(parentId, []);
                }
                groupNodes.get(parentId).push(node);
            }
        });

        // Use stored group order for table-order positioning
        const groupOrder = currentGroupOrder;

        let currentY = 0;

        groupOrder.forEach(groupId => {
            const regularNodes = groupNodes.get(groupId) || [];
            const labelNode = labelNodes.get(groupId);

            if (!labelNode && regularNodes.length === 0) return;

            let nodeX = 0;

            // Position label node first (at left)
            if (labelNode) {
                labelNode.position({ x: nodeX, y: currentY });
                nodeX += SPACING_X;
            }

            // Position regular nodes left-to-right (in table order)
            regularNodes.forEach(node => {
                node.position({ x: nodeX, y: currentY });
                nodeX += SPACING_X;
            });

            // Move to next group (below) - add extra gap when needed
            currentY += SPACING_Y + GROUP_GAP;
        });
    };

    /**
     * Run Smart Layout - force-directed layout for compound graphs
     * Uses table-order pre-layout to bias toward data array order
     * Then fcose optimizes edges while starting from ordered positions
     *
     * fcose = organic, aesthetic, force-directed (vs dagre = hierarchical, structured)
     * Pre-layout with table order ensures user's organization is respected
     *
     * @param {Object} options - Optional configuration overrides
     */
    const runFcoseLayout = function(options) {
        if (!cy) return;

        nodePositions.clear();

        // Pre-layout with table order for deterministic, order-biased starting positions
        // This biases fcose toward user's table organization while still allowing optimization
        // Use extra spacing when links hidden to prevent group overlap
        setTableOrderPositions(currentHideLinks);

        // Run fcose - force-directed layout for compound graphs
        // When links hidden, disable packComponents to prevent group overlap
        const defaultOptions = {
            name: 'fcose',
            quality: 'proof',
            randomize: false,           // Use pre-layout positions, don't randomize
            animate: true,
            animationDuration: 500,
            fit: true,
            padding: 20,
            nodeDimensionsIncludeLabels: true,
            nodeSeparation: currentHideLinks ? 100 : 50,
            nodeRepulsion: node => currentHideLinks ? 10000 : 4500,
            gravity: currentHideLinks ? 0.05 : 0.25,
            gravityCompound: 1.0,
            packComponents: !currentHideLinks,  // Don't pack when links hidden
            idealEdgeLength: edge => 50,
            numIter: currentHideLinks ? 500 : 2500,  // Much fewer iterations when no edges to preserve positions
            // Compound node padding - prevents edge overlap
            tilingPaddingVertical: currentHideLinks ? 40 : 10,
            tilingPaddingHorizontal: currentHideLinks ? 40 : 10,
            stop: function() {
                // Save positions after layout completes
                cy.nodes('[!isGroup]').forEach(node => {
                    nodePositions.set(node.id(), { ...node.position() });
                });
                // Reposition labels to top-left of each group
                repositionLabelsToTopLeft();
            }
        };

        // Merge with any user-provided options
        const layoutOptions = Object.assign({}, defaultOptions, options || {});

        try {
            cy.layout(layoutOptions).run();
        } catch (e) {
            console.warn('fcose layout failed, falling back to dagre:', e.message);
            runLayout('TB');
        }
    };

    /**
     * Run dagre layout - tight hierarchical layout for DAGs/trees
     * Uses table-order pre-layout to bias within-rank ordering
     * Mimics mermaidchart.com style with minimal spacing
     * @param {String} direction - 'TB' (top-bottom) or 'LR' (left-right)
     * @param {Object} options - Optional configuration overrides
     */
    const runDagreLayout = function(direction, options) {
        if (!cy) return;

        // Check if dagre is available
        if (typeof cy.layout !== 'function') {
            console.warn('Cytoscape layout not available');
            return;
        }

        nodePositions.clear();

        // Pre-layout with table order to bias dagre's within-rank ordering
        // Use extra spacing when links hidden to prevent group overlap
        setTableOrderPositions(currentHideLinks);

        const defaultOptions = {
            name: 'dagre',
            rankDir: direction || 'TB',

            // Spacing - wider when links hidden to prevent overlap
            nodeSep: currentHideLinks ? 40 : 15,   // Horizontal gap between nodes
            rankSep: currentHideLinks ? 60 : 25,   // Vertical gap between ranks
            edgeSep: 10,                            // Gap between edges

            ranker: 'network-simplex',  // Best balance of speed and quality

            // Standard options
            fit: true,
            padding: 20,
            animate: true,
            animationDuration: 500,
            nodeDimensionsIncludeLabels: true,

            // Callbacks
            stop: function() {
                // Save positions after layout completes
                cy.nodes('[!isGroup]').forEach(node => {
                    nodePositions.set(node.id(), { ...node.position() });
                });
                // Reposition labels to top-left of each group
                repositionLabelsToTopLeft();
            }
        };

        // Merge with any user-provided options
        const layoutOptions = Object.assign({}, defaultOptions, options || {});

        try {
            cy.layout(layoutOptions).run();
        } catch (e) {
            console.warn('dagre layout failed, falling back to compact:', e.message);
            runLayout(direction || 'TB');
        }
    };

    /**
     * Get IDs of nodes currently visible on canvas
     * Used for canvas-filtered exports
     * @returns {Set} Set of visible node IDs
     */
    const getVisibleNodeIDs = function() {
        if (!cy) return new Set();

        const visibleIDs = new Set();
        // Get all regular nodes (exclude compound groups and label nodes)
        cy.nodes('[!isGroup][!isGroupLabel]').forEach(node => {
            visibleIDs.add(node.id());
        });
        return visibleIDs;
    };

    // Expose to global namespace
    window.GraphApp.core.renderCytoscape = renderCytoscape;
    window.GraphApp.core.clearCytoscapePositions = clearPositions;
    window.GraphApp.core.fitCytoscapeToScreen = fitToScreen;
    window.GraphApp.core.setCytoscapeZoom = setZoom;
    window.GraphApp.core.runAutoLayout = runAutoLayout;
    window.GraphApp.core.runFcoseLayout = runFcoseLayout;
    window.GraphApp.core.runDagreLayout = runDagreLayout;
    window.GraphApp.core.getCytoscapeZoom = getZoom;
    window.GraphApp.core.panCytoscape = pan;
    window.GraphApp.core.resetCytoscapeView = resetView;
    window.GraphApp.core.getCytoscapeInstance = getInstance;
    window.GraphApp.core.hasCytoscapeGraph = hasGraph;
    window.GraphApp.core.getVisibleNodeIDs = getVisibleNodeIDs;

})(window);
