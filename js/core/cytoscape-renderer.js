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

    // ===== Configuration Constants =====
    const NODE_PADDING = 3;   // Minimum gap between nodes (px)
    const GROUP_GAP = 15;     // Gap between groups (px)

    let cy = null;  // Cytoscape instance
    const nodePositions = new Map();  // Store positions for stability
    let currentGroupOrder = [];  // Store group order from data (for layout)
    let currentHideLinks = false;  // Track hide links state for layout decisions
    let currentNodeSpacing = 0;  // Extra spacing added to minimum (0-100)

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

        // === MUX NODE PROCESSING ===
        // MUX nodes (ending with " MUX") appear as compact single-node groups OUTSIDE connected groups
        // One mini-group per (MUX node × destination group) pair - layout treats them as regular groups
        const muxNodes = new Map(); // originalID -> { node, connectionsByGroup: Map<destGroup, connections[]> }
        const isMuxNode = window.GraphApp.utils.isMuxNode;
        // Note: generateMuxCloneID no longer used - now using muxclone_{originalID}_for_{destGroup} format

        // Identify MUX nodes with grouped connections
        nodes.forEach(node => {
            if (isMuxNode(node.Node_xA)) {
                muxNodes.set(node.ID_xA, { node, connectionsByGroup: new Map() });
            }
        });

        // Collect connections grouped by destination group for each MUX node
        nodes.forEach(node => {
            // Skip hidden nodes
            if (node.Hidden_Node_xB == 1) return;
            if (hidden.has(node.Group_xA)) return;

            // Incoming: regular node links TO a MUX node
            if (node.Linked_Node_ID_xA && !node.Hidden_Link_xB && muxNodes.has(node.Linked_Node_ID_xA)) {
                // Don't count MUX-to-MUX as incoming (handle separately)
                if (!muxNodes.has(node.ID_xA)) {
                    const muxInfo = muxNodes.get(node.Linked_Node_ID_xA);
                    const destGroup = node.Group_xA || 'Ungrouped';
                    if (!muxInfo.connectionsByGroup.has(destGroup)) {
                        muxInfo.connectionsByGroup.set(destGroup, []);
                    }
                    muxInfo.connectionsByGroup.get(destGroup).push({
                        type: 'incoming',
                        nodeID: node.ID_xA,
                        nodeGroup: destGroup,
                        sourceNode: node
                    });
                }
            }

            // Outgoing: MUX node links TO another node
            if (muxNodes.has(node.ID_xA) && node.Linked_Node_ID_xA && !node.Hidden_Link_xB) {
                const target = nodes.find(n => n.ID_xA === node.Linked_Node_ID_xA);
                if (target && target.Hidden_Node_xB != 1 && !hidden.has(target.Group_xA)) {
                    // For MUX-to-MUX, use target's original group
                    const muxInfo = muxNodes.get(node.ID_xA);
                    const destGroup = target.Group_xA || 'Ungrouped';
                    if (!muxInfo.connectionsByGroup.has(destGroup)) {
                        muxInfo.connectionsByGroup.set(destGroup, []);
                    }
                    muxInfo.connectionsByGroup.get(destGroup).push({
                        type: 'outgoing',
                        nodeID: target.ID_xA,
                        nodeGroup: destGroup,
                        sourceNode: node
                    });
                }
            }
        });

        // Collect unique groups (compound/parent nodes)
        // Also collect MUX mini-groups (one per MUX node × destination group)
        const groups = new Set();
        const muxMiniGroups = []; // { muxID, muxNode, destGroup } - for creating mini compound nodes
        nodes.forEach(node => {
            if (node.Hidden_Node_xB == 1) return;
            if (hidden.has(node.Group_xA)) return;
            if (hideUnlinkedNodes && !linkedNodeIDs.has(node.ID_xA)) return;
            if (hideLinkedNodes && linkedNodeIDs.has(node.ID_xA)) return;

            groups.add(node.Group_xA || 'Ungrouped');

            // For MUX nodes with connections, create mini-groups (NOT add to destination groups)
            if (muxNodes.has(node.ID_xA)) {
                const muxInfo = muxNodes.get(node.ID_xA);
                muxInfo.connectionsByGroup.forEach((connections, destGroup) => {
                    // Ensure destination group exists (for edge targets)
                    groups.add(destGroup);
                    // Track mini-group to create
                    muxMiniGroups.push({
                        muxID: node.ID_xA,
                        muxNode: node,
                        destGroup: destGroup
                    });
                });
            }

            visibleNodeIDs.add(node.ID_xA);
        });

        // Store group order for layout (preserves data order)
        // Include MUX mini-groups after regular groups
        currentGroupOrder = [...groups].map(g => `group_${g}`);
        muxMiniGroups.forEach(mg => {
            currentGroupOrder.push(`muxgroup_${mg.muxID}_for_${mg.destGroup}`);
        });

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

        // Add MUX mini compound nodes (compact single-node groups outside destination groups)
        // Each mini-group has: origin group label + single MUX clone node
        muxMiniGroups.forEach(mg => {
            const miniGroupId = `muxgroup_${mg.muxID}_for_${mg.destGroup}`;
            const cloneId = `muxclone_${mg.muxID}_for_${mg.destGroup}`;
            const labelId = `muxlabel_${mg.muxID}_for_${mg.destGroup}`;
            const originGroup = mg.muxNode.Group_xA || 'Ungrouped';

            // Mini compound node
            elements.push({
                group: 'nodes',
                data: {
                    id: miniGroupId,
                    label: '',  // Compound label hidden - using label node instead
                    isGroup: true,
                    isMuxGroup: true,  // Flag for compact styling
                    originalGroup: originGroup,
                    targetGroup: mg.destGroup
                }
            });

            // Label node showing origin group name (appears above the MUX node)
            const labelPosition = nodePositions.get(labelId);
            elements.push({
                group: 'nodes',
                data: {
                    id: labelId,
                    label: originGroup,
                    parent: miniGroupId,
                    isGroupLabel: true,
                    isMuxLabel: true,  // Flag for smaller styling if needed
                    isGroup: false
                },
                position: labelPosition ? { ...labelPosition } : undefined
            });

            // Single MUX clone node - display as-is (already ends with " MUX")
            const displayLabel = mg.muxNode.Node_xA || '';
            const storedPosition = nodePositions.get(cloneId);
            elements.push({
                group: 'nodes',
                data: {
                    id: cloneId,
                    label: displayLabel,
                    parent: miniGroupId,
                    isGroup: false,
                    isMuxClone: true,
                    originalID: mg.muxID,
                    isLinked: true
                },
                position: storedPosition ? { ...storedPosition } : undefined
            });

            visibleNodeIDs.add(cloneId);
        });

        // Add regular nodes with parent reference (including MUX clone handling)
        nodes.forEach(node => {
            if (node.Hidden_Node_xB == 1) return;
            if (hidden.has(node.Group_xA)) return;
            if (hideUnlinkedNodes && !linkedNodeIDs.has(node.ID_xA)) return;
            if (hideLinkedNodes && linkedNodeIDs.has(node.ID_xA)) return;

            const groupName = node.Group_xA || 'Ungrouped';

            // Handle MUX nodes specially
            if (muxNodes.has(node.ID_xA)) {
                const muxInfo = muxNodes.get(node.ID_xA);

                if (muxInfo.connectionsByGroup.size === 0) {
                    // No connections - show original node normally in its group
                    const storedPosition = nodePositions.get(node.ID_xA);
                    elements.push({
                        group: 'nodes',
                        data: {
                            id: node.ID_xA,
                            label: node.Node_xA || '',
                            parent: `group_${groupName}`,
                            isGroup: false,
                            isLinked: linkedNodeIDs.has(node.ID_xA)
                        },
                        position: storedPosition ? { ...storedPosition } : undefined
                    });
                }
                // Clones already created in mini-groups above - skip here
                return; // Skip normal processing for MUX nodes
            }

            // Regular node (non-MUX)
            const storedPosition = nodePositions.get(node.ID_xA);
            elements.push({
                group: 'nodes',
                data: {
                    id: node.ID_xA,
                    label: node.Node_xA || '',
                    parent: `group_${groupName}`,
                    isGroup: false,
                    isLinked: linkedNodeIDs.has(node.ID_xA)
                },
                position: storedPosition ? { ...storedPosition } : undefined
            });
        });

        // Add edges (skip if hideLinks is true)
        if (!hideLinks) {
            nodes.forEach(node => {
                if (!node.Linked_Node_ID_xA || node.Hidden_Link_xB == 1) return;

                let sourceID = node.ID_xA;
                let targetID = node.Linked_Node_ID_xA;
                const sourceGroup = node.Group_xA || 'Ungrouped';

                // Find target node to get its group
                const targetNode = nodes.find(n => n.ID_xA === targetID);
                const targetGroup = targetNode ? (targetNode.Group_xA || 'Ungrouped') : 'Ungrouped';

                // Rewire edges for MUX nodes using destination-group-based clone IDs
                if (muxNodes.has(sourceID)) {
                    const muxInfo = muxNodes.get(sourceID);
                    if (muxInfo.connectionsByGroup.size > 0) {
                        // Source is MUX → use clone in target's group
                        sourceID = `muxclone_${sourceID}_for_${targetGroup}`;
                    }
                }
                if (muxNodes.has(targetID)) {
                    const muxInfo = muxNodes.get(targetID);
                    if (muxInfo.connectionsByGroup.size > 0) {
                        // Target is MUX → use clone in source's group
                        targetID = `muxclone_${targetID}_for_${sourceGroup}`;
                    }
                }

                // Only add edge if both endpoints are visible
                if (!visibleNodeIDs.has(sourceID)) return;
                if (!visibleNodeIDs.has(targetID)) return;

                elements.push({
                    group: 'edges',
                    data: {
                        id: `edge_${sourceID}_to_${targetID}`,
                        source: sourceID,
                        target: targetID,
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
        // MUX clone nodes - dashed border, light fill to indicate "reference/alias"
        {
            selector: 'node[?isMuxClone]',
            style: {
                'border-style': 'dashed',
                'border-color': '#666666',
                'background-color': '#f5f5f5'
            }
        },
        // MUX mini-groups - fixed compact compound nodes (never expand)
        {
            selector: 'node[?isMuxGroup]',
            style: {
                'background-opacity': 0,
                'border-width': 1,
                'border-color': '#888888',
                'border-style': 'dotted',
                'padding': '0px',  // Zero padding - children define exact bounds
                'shape': 'roundrectangle',
                'min-width': '10px',
                'min-height': '10px'
            }
        },
        // MUX label nodes - smaller font, tight spacing
        {
            selector: 'node[?isMuxLabel]',
            style: {
                'font-size': '8px',
                'padding': '1px'
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
     * @param {Boolean} hideLinks - Hide all link lines from canvas
     * @param {Boolean} hideLinkLabels - Hide link labels (but show links)
     * @param {String} containerId - DOM container ID
     * @returns {Object} Cytoscape instance
     */
    const renderCytoscape = function(nodes, settings, hiddenGroups, hideUnlinkedNodes, hideLinkedNodes, hideLinks, hideLinkLabels, containerId) {
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

        // Hide link labels (but keep the lines visible)
        if (hideLinkLabels) {
            styleArray.push({
                selector: 'edge',
                style: {
                    'label': ''  // Hide edge labels
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
                const PADDING = NODE_PADDING;
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

            // Right-click on compound group nodes - show context menu
            cy.on('cxttap', 'node[?isGroup]', function(evt) {
                const groupId = evt.target.id();  // e.g., "group_PLC Rack"
                const groupName = groupId.replace('group_', '');
                const renderedPos = evt.renderedPosition;

                // Get container offset for correct screen position
                const containerRect = container.getBoundingClientRect();

                if (window.onGroupContextMenu) {
                    window.onGroupContextMenu({
                        groupName: groupName,
                        position: {
                            x: containerRect.left + renderedPos.x,
                            y: containerRect.top + renderedPos.y
                        }
                    });
                }
            });

            // Right-click on regular nodes (not groups, not labels) - show context menu
            cy.on('cxttap', 'node[!isGroup][!isGroupLabel]', function(evt) {
                const nodeId = evt.target.id();
                const renderedPos = evt.renderedPosition;
                const containerRect = container.getBoundingClientRect();

                if (window.onNodeContextMenu) {
                    window.onNodeContextMenu({
                        nodeId: nodeId,
                        position: {
                            x: containerRect.left + renderedPos.x,
                            y: containerRect.top + renderedPos.y
                        }
                    });
                }
            });

            // Right-click on edges (links) - show context menu
            cy.on('cxttap', 'edge', function(evt) {
                const edgeId = evt.target.id();
                const sourceId = evt.target.source().id();
                const targetId = evt.target.target().id();
                const renderedPos = evt.renderedPosition;
                const containerRect = container.getBoundingClientRect();

                if (window.onEdgeContextMenu) {
                    window.onEdgeContextMenu({
                        edgeId: edgeId,
                        sourceId: sourceId,
                        targetId: targetId,
                        position: {
                            x: containerRect.left + renderedPos.x,
                            y: containerRect.top + renderedPos.y
                        }
                    });
                }
            });

            // Prevent browser's native context menu on Cytoscape's canvas
            // Must target the actual canvas element, not just the container
            const canvas = cy.container().querySelector('canvas');
            if (canvas) {
                canvas.oncontextmenu = function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    return false;
                };
            }
            // Also prevent on container as fallback
            cy.container().oncontextmenu = function(e) {
                e.preventDefault();
                e.stopPropagation();
                return false;
            };
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
            const curveAmount = settings.curveAmount || 40;  // Perpendicular distance for curve arc (10-100)
            edgeStyles['control-point-distances'] = curveAmount;
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
     * NOTE: Excludes MUX labels - those are handled by compactMuxGroups
     */
    const repositionLabelsToTopLeft = function() {
        if (!cy) return;

        const LABEL_OFFSET = 6;  // Padding from group edge

        // Get all label nodes EXCEPT MUX labels (those stay compact)
        const labelNodes = cy.nodes('[?isGroupLabel]').filter(n => !n.data('isMuxLabel'));

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
     * Compact MUX groups - position label directly above MUX clone with minimal spacing
     * MUX groups should be fixed-size, never expand like regular groups
     * Call after any layout completes
     */
    const compactMuxGroups = function() {
        if (!cy) return;

        const MUX_LABEL_GAP = 2;  // Tiny gap between label and MUX node

        // Get all MUX groups
        const muxGroups = cy.nodes('[?isMuxGroup]');

        muxGroups.forEach(muxGroup => {
            const children = muxGroup.children();
            const labelNode = children.filter(n => n.data('isMuxLabel')).first();
            const cloneNode = children.filter(n => n.data('isMuxClone')).first();

            if (labelNode.length === 0 || cloneNode.length === 0) return;

            // Get clone node position and dimensions
            const clonePos = cloneNode.position();
            const cloneBB = cloneNode.boundingBox({ includeOverlays: false });
            const labelBB = labelNode.boundingBox({ includeOverlays: false });

            // Position label centered directly above clone node
            labelNode.position({
                x: clonePos.x,  // Centered horizontally
                y: clonePos.y - (cloneBB.h / 2) - (labelBB.h / 2) - MUX_LABEL_GAP  // Directly above
            });
        });
    };

    /**
     * Rearrange nodes within each group on cross-axis while PRESERVING dagre's topology
     * TB: nodes horizontal within groups, LR: nodes vertical within groups
     * CRITICAL: Does NOT reposition groups - preserves dagre's 2D layout
     * This is what makes hierarchical different from compact layout
     * @param {String} direction - 'TB' or 'LR'
     */
    const rearrangeNodesWithinGroups = function(direction) {
        if (!cy) return;

        const PADDING = NODE_PADDING;
        const dir = direction || 'TB';
        const nodeH = 22;

        const groupNodes = cy.nodes('[?isGroup]');
        if (groupNodes.length === 0) return;

        groupNodes.forEach(group => {
            const children = group.children().filter(n => !n.data('isGroupLabel'));
            if (children.length === 0) return;

            // Step 1: Save group's CURRENT center (from dagre - this is the topology!)
            const bbox = children.boundingBox({ includeOverlays: false });
            const savedCenterX = (bbox.x1 + bbox.x2) / 2;
            const savedCenterY = (bbox.y1 + bbox.y2) / 2;

            // Step 2: Arrange nodes at origin on cross-axis
            if (dir === 'TB') {
                // TB: nodes horizontal
                let totalWidth = 0;
                children.forEach(node => {
                    totalWidth += calcNodeWidth(node) + PADDING;
                });
                totalWidth -= PADDING;

                let x = -totalWidth / 2;
                children.forEach(node => {
                    const w = calcNodeWidth(node);
                    node.position({ x: x + w / 2, y: 0 });
                    x += w + PADDING;
                });
            } else {
                // LR: nodes vertical
                const totalHeight = children.length * (nodeH + PADDING) - PADDING;
                let y = -totalHeight / 2;
                children.forEach(node => {
                    node.position({ x: 0, y: y + nodeH / 2 });
                    y += nodeH + PADDING;
                });
            }

            // Step 3: Move nodes to restore SAVED center (preserve dagre topology)
            children.forEach(node => {
                const pos = node.position();
                node.position({
                    x: pos.x + savedCenterX,
                    y: pos.y + savedCenterY
                });
            });
        });

        // Reposition labels relative to their sibling nodes
        repositionLabelsToTopLeft();
        // Keep MUX groups compact
        compactMuxGroups();
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
     * Uses TWO-PASS algorithm to calculate actual bounding boxes including labels
     * 3px padding everywhere - ultra compact, NO overlap
     * @param {String} direction - 'TB' or 'LR'
     */
    const runLayout = function(direction) {
        if (!cy) return;

        const dir = direction || 'TB';
        const PADDING = NODE_PADDING + currentNodeSpacing;
        const GAP = GROUP_GAP + currentNodeSpacing;
        const nodeH = calcNodeHeight();

        // Use stored group order (from nodesToElements) to preserve data order
        const groupOrder = currentGroupOrder;

        // Get all compound (group) nodes in order
        const orderedGroups = [];
        groupOrder.forEach(groupId => {
            const group = cy.getElementById(groupId);
            if (group.length > 0 && group.data('isGroup')) {
                orderedGroups.push(group);
            }
        });

        if (orderedGroups.length === 0) return;

        // PASS 1: Arrange nodes within each group at origin (centered at 0,0)
        orderedGroups.forEach(group => {
            const children = group.children().filter(n => !n.data('isGroupLabel'));

            if (dir === 'TB') {
                // TB: nodes horizontal within group
                let totalWidth = 0;
                children.forEach(node => {
                    totalWidth += calcNodeWidth(node) + PADDING;
                });
                if (children.length > 0) totalWidth -= PADDING;

                let x = -totalWidth / 2;
                children.forEach(node => {
                    const w = calcNodeWidth(node);
                    node.position({ x: x + w / 2, y: 0 });
                    x += w + PADDING;
                });
            } else {
                // LR: nodes vertical within group
                const totalHeight = children.length * (nodeH + PADDING) - (children.length > 0 ? PADDING : 0);
                let y = -totalHeight / 2;
                children.forEach(node => {
                    node.position({ x: 0, y: y + nodeH / 2 });
                    y += nodeH + PADDING;
                });
            }
        });

        // Reposition labels relative to their sibling nodes (above them)
        repositionLabelsToTopLeft();
        // Keep MUX groups compact
        compactMuxGroups();

        // PASS 2: Stack groups using ACTUAL bounding boxes (includes labels)
        if (dir === 'TB') {
            let currentTop = PADDING;

            orderedGroups.forEach(group => {
                // Get ALL children (including label) for true bounding box
                const allChildren = group.children();
                if (allChildren.length === 0) return;

                const bbox = allChildren.boundingBox({ includeOverlays: false });

                // Shift group so its top edge is at currentTop
                const deltaY = currentTop - bbox.y1;

                allChildren.forEach(node => {
                    const pos = node.position();
                    node.position({ x: pos.x, y: pos.y + deltaY });
                });

                // Next group starts after this one's actual height + gap
                currentTop = currentTop + bbox.h + GAP;
            });
        } else {
            let currentLeft = PADDING;

            orderedGroups.forEach(group => {
                const allChildren = group.children();
                if (allChildren.length === 0) return;

                const bbox = allChildren.boundingBox({ includeOverlays: false });

                const deltaX = currentLeft - bbox.x1;

                allChildren.forEach(node => {
                    const pos = node.position();
                    node.position({ x: pos.x + deltaX, y: pos.y });
                });

                currentLeft = currentLeft + bbox.w + GAP;
            });
        }

        // Save positions (only for non-label nodes to preserve draggability)
        const allNodes = cy.nodes('[!isGroup]');
        allNodes.forEach(node => {
            if (!node.data('isGroupLabel')) {
                nodePositions.set(node.id(), { ...node.position() });
            }
        });

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
     * Supports cross-axis arrangement:
     * - TB: Groups top-to-bottom, nodes left-to-right within groups
     * - LR: Groups left-to-right, nodes top-to-bottom within groups
     * @param {boolean} extraSpacing - Use extra spacing when links hidden to prevent overlap
     * @param {string} direction - 'TB' or 'LR' (default 'TB')
     */
    const setTableOrderPositions = function(extraSpacing, direction) {
        if (!cy) return;

        const dir = direction || 'TB';
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

        if (dir === 'TB') {
            // TB: Groups top-to-bottom, nodes left-to-right within groups
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
        } else {
            // LR: Groups left-to-right, nodes top-to-bottom within groups
            let currentX = 0;

            groupOrder.forEach(groupId => {
                const regularNodes = groupNodes.get(groupId) || [];
                const labelNode = labelNodes.get(groupId);

                if (!labelNode && regularNodes.length === 0) return;

                let nodeY = 0;

                // Position label node first (at top)
                if (labelNode) {
                    labelNode.position({ x: currentX, y: nodeY });
                    nodeY += SPACING_Y;
                }

                // Position regular nodes top-to-bottom (in table order)
                regularNodes.forEach(node => {
                    node.position({ x: currentX, y: nodeY });
                    nodeY += SPACING_Y;
                });

                // Move to next group (right) - add extra gap when needed
                currentX += SPACING_X + GROUP_GAP;
            });
        }
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
            nodeSeparation: (currentHideLinks ? 100 : 50) + currentNodeSpacing,
            nodeRepulsion: node => currentHideLinks ? 10000 : 4500,
            gravity: currentHideLinks ? 0.05 : 0.25,
            gravityCompound: 1.0,
            packComponents: !currentHideLinks,  // Don't pack when links hidden
            idealEdgeLength: edge => 50 + currentNodeSpacing,
            numIter: currentHideLinks ? 500 : 2500,  // Much fewer iterations when no edges to preserve positions
            // Compound node padding - prevents edge overlap
            tilingPaddingVertical: (currentHideLinks ? 40 : 10) + currentNodeSpacing,
            tilingPaddingHorizontal: (currentHideLinks ? 40 : 10) + currentNodeSpacing,
            stop: function() {
                // Save positions after layout completes
                cy.nodes('[!isGroup]').forEach(node => {
                    nodePositions.set(node.id(), { ...node.position() });
                });
                // Reposition labels to top-left of each group
                repositionLabelsToTopLeft();
                // Keep MUX groups compact
                compactMuxGroups();
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

        // Pre-layout with table order and cross-axis arrangement
        // Use extra spacing when links hidden to prevent group overlap
        setTableOrderPositions(currentHideLinks, direction);

        const defaultOptions = {
            name: 'dagre',
            rankDir: direction || 'TB',

            // Spacing - wider when links hidden to prevent overlap
            nodeSep: (currentHideLinks ? 40 : 15) + currentNodeSpacing,   // Horizontal gap between nodes
            rankSep: (currentHideLinks ? 60 : 25) + currentNodeSpacing,   // Vertical gap between ranks
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
                // Rearrange nodes within groups on cross-axis for compact layout
                // TB: nodes horizontal within groups, LR: nodes vertical within groups
                rearrangeNodesWithinGroups(direction);

                // Save positions after layout completes
                cy.nodes('[!isGroup]').forEach(node => {
                    nodePositions.set(node.id(), { ...node.position() });
                });
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
     * Run Compact Vertical layout - brick wall with rows
     * Groups arranged left-to-right in rows, wrapping to form square-ish shape
     * Nodes horizontal within each group
     */
    const runCompactVerticalLayout = function() {
        if (!cy) return;

        nodePositions.clear();

        const PADDING = NODE_PADDING + currentNodeSpacing;
        const GAP = GROUP_GAP + currentNodeSpacing;
        const nodeH = calcNodeHeight();
        const LABEL_HEIGHT = 28;  // Approximate label height including offset

        const groupOrder = currentGroupOrder;
        const orderedGroups = [];
        groupOrder.forEach(groupId => {
            const group = cy.getElementById(groupId);
            if (group.length > 0 && group.data('isGroup')) {
                orderedGroups.push(group);
            }
        });

        if (orderedGroups.length === 0) return;

        // Step 1: Calculate each group's dimensions when nodes are horizontal
        const groupDims = orderedGroups.map(group => {
            const children = group.children().filter(n => !n.data('isGroupLabel'));
            let width = 0;
            children.forEach(node => {
                width += calcNodeWidth(node) + PADDING;
            });
            if (children.length > 0) width -= PADDING;
            width += 6;  // compound padding
            const height = nodeH + LABEL_HEIGHT + 6;  // node + label + compound padding
            return { group, width: Math.max(width, 40), height, children };
        });

        // Step 2: Calculate target row width for square-ish shape
        const totalWidth = groupDims.reduce((sum, g) => sum + g.width + GAP, 0);
        const avgHeight = groupDims.reduce((sum, g) => sum + g.height, 0) / groupDims.length;
        const targetRowWidth = Math.sqrt(totalWidth * avgHeight);

        // Step 3: Pack groups into rows (greedy algorithm)
        const rows = [[]];
        let currentRowWidth = 0;

        groupDims.forEach(gd => {
            if (currentRowWidth + gd.width > targetRowWidth && rows[rows.length - 1].length > 0) {
                rows.push([]);
                currentRowWidth = 0;
            }
            rows[rows.length - 1].push(gd);
            currentRowWidth += gd.width + GAP;
        });

        // Step 4: Arrange nodes within each group (horizontal)
        groupDims.forEach(gd => {
            let x = 0;
            gd.children.forEach(node => {
                const w = calcNodeWidth(node);
                node.position({ x: x + w / 2, y: 0 });
                x += w + PADDING;
            });
        });

        // Reposition labels
        repositionLabelsToTopLeft();
        // Keep MUX groups compact
        compactMuxGroups();

        // Step 5: Position rows
        let currentY = PADDING;

        rows.forEach(row => {
            let currentX = PADDING;
            let rowHeight = 0;

            row.forEach(gd => {
                const allChildren = gd.group.children();
                const bbox = allChildren.boundingBox({ includeOverlays: false });
                rowHeight = Math.max(rowHeight, bbox.h);

                const deltaX = currentX - bbox.x1;
                const deltaY = currentY - bbox.y1;

                allChildren.forEach(node => {
                    const pos = node.position();
                    node.position({ x: pos.x + deltaX, y: pos.y + deltaY });
                });

                currentX += bbox.w + GAP;
            });

            currentY += rowHeight + GAP;
        });

        // Save positions
        cy.nodes('[!isGroup]').forEach(node => {
            if (!node.data('isGroupLabel')) {
                nodePositions.set(node.id(), { ...node.position() });
            }
        });

        cy.fit(20);
    };

    /**
     * Run Compact Horizontal layout - brick wall with columns
     * Groups arranged top-to-bottom in columns, wrapping to form square-ish shape
     * Nodes vertical within each group
     */
    const runCompactHorizontalLayout = function() {
        if (!cy) return;

        nodePositions.clear();

        const PADDING = NODE_PADDING + currentNodeSpacing;
        const GAP = GROUP_GAP + currentNodeSpacing;
        const nodeH = calcNodeHeight();
        const LABEL_HEIGHT = 28;

        const groupOrder = currentGroupOrder;
        const orderedGroups = [];
        groupOrder.forEach(groupId => {
            const group = cy.getElementById(groupId);
            if (group.length > 0 && group.data('isGroup')) {
                orderedGroups.push(group);
            }
        });

        if (orderedGroups.length === 0) return;

        // Step 1: Calculate each group's dimensions when nodes are vertical
        const groupDims = orderedGroups.map(group => {
            const children = group.children().filter(n => !n.data('isGroupLabel'));
            let maxWidth = 0;
            children.forEach(node => {
                maxWidth = Math.max(maxWidth, calcNodeWidth(node));
            });
            const width = maxWidth + 6;  // compound padding
            const height = children.length * (nodeH + PADDING) - (children.length > 0 ? PADDING : 0) + LABEL_HEIGHT + 6;
            return { group, width: Math.max(width, 40), height, children };
        });

        // Step 2: Calculate target column height for square-ish shape
        const totalHeight = groupDims.reduce((sum, g) => sum + g.height + GAP, 0);
        const avgWidth = groupDims.reduce((sum, g) => sum + g.width, 0) / groupDims.length;
        const targetColHeight = Math.sqrt(totalHeight * avgWidth);

        // Step 3: Pack groups into columns (greedy algorithm)
        const cols = [[]];
        let currentColHeight = 0;

        groupDims.forEach(gd => {
            if (currentColHeight + gd.height > targetColHeight && cols[cols.length - 1].length > 0) {
                cols.push([]);
                currentColHeight = 0;
            }
            cols[cols.length - 1].push(gd);
            currentColHeight += gd.height + GAP;
        });

        // Step 4: Arrange nodes within each group (vertical)
        groupDims.forEach(gd => {
            let y = 0;
            gd.children.forEach(node => {
                node.position({ x: 0, y: y + nodeH / 2 });
                y += nodeH + PADDING;
            });
        });

        // Reposition labels
        repositionLabelsToTopLeft();
        // Keep MUX groups compact
        compactMuxGroups();

        // Step 5: Position columns
        let currentX = PADDING;

        cols.forEach(col => {
            let currentY = PADDING;
            let colWidth = 0;

            col.forEach(gd => {
                const allChildren = gd.group.children();
                const bbox = allChildren.boundingBox({ includeOverlays: false });
                colWidth = Math.max(colWidth, bbox.w);

                const deltaX = currentX - bbox.x1;
                const deltaY = currentY - bbox.y1;

                allChildren.forEach(node => {
                    const pos = node.position();
                    node.position({ x: pos.x + deltaX, y: pos.y + deltaY });
                });

                currentY += bbox.h + GAP;
            });

            currentX += colWidth + GAP;
        });

        // Save positions
        cy.nodes('[!isGroup]').forEach(node => {
            if (!node.data('isGroupLabel')) {
                nodePositions.set(node.id(), { ...node.position() });
            }
        });

        cy.fit(20);
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

    /**
     * Set extra node spacing (additive to minimum)
     * @param {Number} spacing - Extra spacing (0-100)
     */
    const setNodeSpacing = function(spacing) {
        currentNodeSpacing = Math.max(0, Math.min(100, spacing || 0));
    };

    // Expose to global namespace
    window.GraphApp.core.renderCytoscape = renderCytoscape;
    window.GraphApp.core.clearCytoscapePositions = clearPositions;
    window.GraphApp.core.fitCytoscapeToScreen = fitToScreen;
    window.GraphApp.core.setCytoscapeZoom = setZoom;
    window.GraphApp.core.runAutoLayout = runAutoLayout;
    window.GraphApp.core.runFcoseLayout = runFcoseLayout;
    window.GraphApp.core.runDagreLayout = runDagreLayout;
    window.GraphApp.core.runCompactVerticalLayout = runCompactVerticalLayout;
    window.GraphApp.core.runCompactHorizontalLayout = runCompactHorizontalLayout;
    window.GraphApp.core.getCytoscapeZoom = getZoom;
    window.GraphApp.core.panCytoscape = pan;
    window.GraphApp.core.resetCytoscapeView = resetView;
    window.GraphApp.core.getCytoscapeInstance = getInstance;
    window.GraphApp.core.hasCytoscapeGraph = hasGraph;
    window.GraphApp.core.getVisibleNodeIDs = getVisibleNodeIDs;
    window.GraphApp.core.setNodeSpacing = setNodeSpacing;

})(window);
