/**
 * Utility Functions
 * Helper functions for data validation and manipulation
 */

(function(window) {
    'use strict';

    // Valid arrow direction values
    const VALID_ARROWS = ['To', 'From', 'Both', 'None'];

    // Maximum lengths for validation
    const MAX_LABEL_LENGTH = 100;
    const MAX_GROUP_LENGTH = 50;
    const MAX_NODE_LENGTH = 50;

    /**
     * Validate node data for errors
     * @param {Array} nodes - Array of node objects
     * @returns {Array} Array of error messages
     */
    const validateNodes = function(nodes) {
        const errors = [];
        const warnings = [];
        const ids = new Set();
        const definedIds = new Set();

        // Collect all IDs (case-sensitive)
        nodes.forEach(node => {
            if (node.ID_xA) {
                definedIds.add(node.ID_xA);
            }
        });

        // Check for duplicates and broken references
        nodes.forEach((node, index) => {
            const rowNum = index + 1;

            // Check for required fields
            if (!node.Group_xA || !node.Node_xA) {
                errors.push(`Row ${rowNum}: Missing Group or Node name`);
            }

            // Check for duplicate IDs (case-sensitive)
            if (node.ID_xA) {
                if (ids.has(node.ID_xA)) {
                    errors.push(`Duplicate ID: ${node.ID_xA}`);
                }
                ids.add(node.ID_xA);
            }

            // Check for self-referencing nodes
            if (node.Linked_Node_ID_xA && node.ID_xA === node.Linked_Node_ID_xA) {
                errors.push(`Row ${rowNum}: Node "${node.ID_xA}" links to itself`);
            }

            // Check for broken link references (case-sensitive)
            if (node.Linked_Node_ID_xA && !node.Hidden_Link_xB) {
                if (!definedIds.has(node.Linked_Node_ID_xA)) {
                    errors.push(`Row ${rowNum}: Reference to undefined node "${node.Linked_Node_ID_xA}"`);
                }
            }

            // Validate Link_Arrow_xB values
            if (node.Link_Arrow_xB && !VALID_ARROWS.includes(node.Link_Arrow_xB)) {
                errors.push(`Row ${rowNum}: Invalid arrow type "${node.Link_Arrow_xB}" (use: To, From, Both, None)`);
            }

            // Check max lengths
            if (node.Group_xA && node.Group_xA.length > MAX_GROUP_LENGTH) {
                warnings.push(`Row ${rowNum}: Group name exceeds ${MAX_GROUP_LENGTH} characters`);
            }
            if (node.Node_xA && node.Node_xA.length > MAX_NODE_LENGTH) {
                warnings.push(`Row ${rowNum}: Node name exceeds ${MAX_NODE_LENGTH} characters`);
            }
            if (node.Link_Label_xB && node.Link_Label_xB.length > MAX_LABEL_LENGTH) {
                warnings.push(`Row ${rowNum}: Link label exceeds ${MAX_LABEL_LENGTH} characters`);
            }
        });

        // Check for cycles (as warning, not error - cycles are valid in some graphs)
        if (hasCycleInternal(nodes)) {
            warnings.push('Warning: Graph contains circular references');
        }

        // Return errors first, then warnings
        return [...errors, ...warnings];
    };

    /**
     * Internal cycle detection (used by validateNodes)
     */
    const hasCycleInternal = function(nodes) {
        const graph = {};
        const visited = new Set();
        const recursionStack = new Set();

        // Build adjacency list
        nodes.forEach(node => {
            if (!graph[node.ID_xA]) {
                graph[node.ID_xA] = [];
            }
            if (node.Linked_Node_ID_xA && !node.Hidden_Link_xB) {
                graph[node.ID_xA].push(node.Linked_Node_ID_xA);
            }
        });

        // DFS cycle detection
        const dfs = function(nodeId) {
            visited.add(nodeId);
            recursionStack.add(nodeId);

            const neighbors = graph[nodeId] || [];
            for (let neighbor of neighbors) {
                if (!visited.has(neighbor)) {
                    if (dfs(neighbor)) {
                        return true;
                    }
                } else if (recursionStack.has(neighbor)) {
                    return true;
                }
            }

            recursionStack.delete(nodeId);
            return false;
        };

        for (let nodeId in graph) {
            if (!visited.has(nodeId)) {
                if (dfs(nodeId)) {
                    return true;
                }
            }
        }

        return false;
    };

    /**
     * Sort nodes by specified column
     * @param {Array} nodes - Array of node objects
     * @param {String} column - Column to sort by
     * @param {String} direction - 'asc' or 'desc'
     * @returns {Array} Sorted array
     */
    const sortNodes = function(nodes, column, direction) {
        return [...nodes].sort((a, b) => {
            let aVal = a[column] || '';
            let bVal = b[column] || '';

            // Convert to string for comparison
            aVal = String(aVal).toLowerCase();
            bVal = String(bVal).toLowerCase();

            if (direction === 'asc') {
                return aVal > bVal ? 1 : -1;
            } else {
                return aVal < bVal ? 1 : -1;
            }
        });
    };

    /**
     * Generate unique ID from Group and Node
     * @param {String} group - Group name
     * @param {String} node - Node name
     * @returns {String} Generated ID
     */
    const generateID = function(group, node) {
        if (!group || !node) return '';
        return `${group}-${node}`;
    };

    /**
     * Detect cycles in graph (public API)
     * @param {Array} nodes - Array of node objects
     * @returns {Boolean} True if cycle detected
     */
    const hasCycle = function(nodes) {
        return hasCycleInternal(nodes);
    };

    /**
     * Parse Mermaid file content to node data
     * @param {String} mermaidContent - Mermaid .mmd file content
     * @returns {Array} Array of node objects
     */
    const parseMermaidToNodes = function(mermaidContent) {
        const nodes = [];
        const nodeMap = new Map(); // Map of nodeId -> {Group, Node, ID}
        const links = [];

        const lines = mermaidContent.split('\n');

        lines.forEach(line => {
            line = line.trim();

            // Skip comments and graph declaration
            if (line.startsWith('%%') || line.startsWith('graph') || line === '') {
                return;
            }

            // Parse node definition: nodeId["Label"] or nodeId("Label")
            const nodeMatch = line.match(/(\w+)[\[\(]"([^"]+)"[\]\)]/);
            if (nodeMatch) {
                const nodeId = nodeMatch[1];
                const label = nodeMatch[2];

                // Try to extract Group-Node from label
                let group = 'Default';
                let node = label;

                if (label.includes('-')) {
                    const parts = label.split('-');
                    group = parts[0].trim();
                    node = parts.slice(1).join('-').trim();
                }

                nodeMap.set(nodeId, { Group: group, Node: node, ID: label });
            }

            // Parse link: nodeA --> nodeB or nodeA -->|label| nodeB
            const linkMatch = line.match(/(\w+)\s*-->\s*(?:\|([^|]+)\|)?\s*(\w+)/);
            if (linkMatch) {
                const fromId = linkMatch[1];
                const label = linkMatch[2] || '';
                const toId = linkMatch[3];

                links.push({ from: fromId, to: toId, label: label.trim() });
            }
        });

        // Convert to node array
        nodeMap.forEach((data, nodeId) => {
            const node = {
                Group_xA: data.Group,
                Node_xA: data.Node,
                ID_xA: data.ID,
                Linked_Node_ID_xA: '',
                Hidden_Node_xB: 0,
                Hidden_Link_xB: 0,
                Link_Label_xB: '',
                Link_Arrow_xB: 'To'
            };

            // Find links from this node
            const outgoingLinks = links.filter(l => l.from === nodeId);
            if (outgoingLinks.length > 0) {
                const link = outgoingLinks[0]; // Take first link
                const targetNode = nodeMap.get(link.to);
                if (targetNode) {
                    node.Linked_Node_ID_xA = targetNode.ID;
                    node.Link_Label_xB = link.label;
                }
            }

            nodes.push(node);
        });

        return nodes;
    };

    // Expose utilities to global namespace
    window.GraphApp.utils = {
        validateNodes,
        sortNodes,
        generateID,
        hasCycle,
        parseMermaidToNodes
    };

})(window);
