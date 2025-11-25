/**
 * Mermaid Graph Generator
 * Converts node/link data to Mermaid diagram syntax
 */

(function(window) {
    'use strict';

    /**
     * Sanitize label text for Mermaid syntax
     * Prevents injection of characters that break Mermaid parsing
     * @param {String} label - Raw label text
     * @returns {String} Sanitized label
     */
    const sanitizeLabel = function(label) {
        if (!label) return '';
        return String(label)
            .replace(/"/g, "'")      // Quotes break label strings
            .replace(/\[/g, "(")     // Brackets could end node definitions
            .replace(/\]/g, ")")
            .replace(/\|/g, "│")     // Pipe delimits link labels (use unicode)
            .replace(/</g, "‹")      // Angle brackets could be HTML/arrows
            .replace(/>/g, "›");
    };

    /**
     * Generate Mermaid graph syntax from node data
     * @param {Array} nodes - Array of node objects
     * @param {Object} settings - Diagram settings { direction: 'TB'|'LR'|'RL'|'BT', curve: 'basis'|'linear'|'step', ... }
     * @param {Set} hiddenGroups - Set of group names to hide (optional)
     * @param {Boolean} hideUnlinkedNodes - Hide nodes with no links (optional)
     * @returns {String} Mermaid diagram syntax
     */
    const generateMermaid = function(nodes, settings, hiddenGroups, hideUnlinkedNodes) {
        const direction = settings.direction || 'TB';
        const curve = settings.curve || 'basis';

        // Clear ID cache for fresh render
        idCache.clear();

        // Inject frontmatter with curve configuration
        let mermaid = `%%{init: {'flowchart':{'curve':'${curve}'}}}%%\n`;
        mermaid += `graph ${direction}\n`;

        // Default to empty set if not provided
        const hidden = hiddenGroups || new Set();

        // Build sets of linked node IDs if hiding unlinked nodes
        let linkedNodeIDs = new Set();
        if (hideUnlinkedNodes) {
            nodes.forEach(node => {
                // Node has outgoing link
                if (node.Linked_Node_ID_xA && !node.Hidden_Link_xB) {
                    linkedNodeIDs.add(node.ID_xA); // This node has outgoing link
                    linkedNodeIDs.add(node.Linked_Node_ID_xA); // Target node has incoming link
                }
            });
        }

        // Group nodes by Group_xA for subgraph organization
        const groups = {};
        nodes.forEach(node => {
            if (node.Hidden_Node_xB == 1) return; // Skip hidden nodes

            const groupName = node.Group_xA || 'Ungrouped';

            // Skip nodes from hidden groups
            if (hidden.has(groupName)) return;

            // Skip unlinked nodes if hideUnlinkedNodes is true
            if (hideUnlinkedNodes && !linkedNodeIDs.has(node.ID_xA)) return;

            if (!groups[groupName]) {
                groups[groupName] = [];
            }
            groups[groupName].push(node);
        });

        // Generate subgraphs for each group
        Object.keys(groups).forEach((groupName, groupIndex) => {
            const groupNodes = groups[groupName];

            // Create subgraph
            mermaid += `\n    subgraph ${sanitizeID(groupName)}["${sanitizeLabel(groupName)}"]\n`;

            // Add nodes in this group
            groupNodes.forEach(node => {
                const nodeId = sanitizeID(node.ID_xA);
                const nodeLabel = sanitizeLabel(node.Node_xA);
                mermaid += `        ${nodeId}["${nodeLabel}"]\n`;
            });

            mermaid += `    end\n`;
        });

        // Generate links between nodes
        mermaid += `\n`;

        const visibleNodes = nodes.filter(n => {
            return n.Hidden_Node_xB != 1 && !hidden.has(n.Group_xA);
        });
        const visibleNodeIDs = new Set(visibleNodes.map(n => n.ID_xA));

        visibleNodes.forEach(node => {
            if (!node.Linked_Node_ID_xA || node.Hidden_Link_xB == 1) return;

            // Only create link if target exists and is visible
            if (!visibleNodeIDs.has(node.Linked_Node_ID_xA)) return;

            const fromId = sanitizeID(node.ID_xA);
            const toId = sanitizeID(node.Linked_Node_ID_xA);
            const rawLabel = node.Link_Label_xB || '';
            const label = sanitizeLabel(rawLabel); // Sanitize to prevent Mermaid syntax injection
            const arrow = node.Link_Arrow_xB || 'To';

            // Generate appropriate arrow syntax
            let arrowSyntax;
            switch (arrow) {
                case 'To':
                    arrowSyntax = label ? `-->|${label}|` : '-->';
                    break;
                case 'From':
                    // For 'From' arrows, reverse direction by swapping nodes
                    arrowSyntax = label ? `-->|${label}|` : '-->';
                    mermaid += `    ${toId} ${arrowSyntax} ${fromId}\n`;
                    return; // Skip normal link creation
                case 'Both':
                    arrowSyntax = label ? `<-->|${label}|` : '<-->';
                    break;
                case 'None':
                    arrowSyntax = label ? `---|${label}|` : '---';
                    break;
                default:
                    arrowSyntax = label ? `-->|${label}|` : '-->';
            }

            mermaid += `    ${fromId} ${arrowSyntax} ${toId}\n`;
        });

        // Add styling for groups (optional)
        mermaid += `\n`;
        mermaid += `    classDef default fill:#fff,stroke:#333,stroke-width:2px\n`;

        return mermaid;
    };

    /**
     * Simple hash function for deterministic ID generation
     * @param {String} str - Input string
     * @returns {String} Short hash string
     */
    const simpleHash = function(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        // Convert to base36 and take last 4 chars for readability
        return Math.abs(hash).toString(36).slice(-4);
    };

    // Cache for ID mappings to ensure consistency within a render
    const idCache = new Map();

    /**
     * Sanitize ID for Mermaid (collision-resistant)
     * Uses hash suffix to prevent collisions when different IDs sanitize to same value
     * @param {String} id - Original ID
     * @returns {String} Sanitized ID
     */
    const sanitizeID = function(id) {
        if (!id) return 'node_' + Math.random().toString(36).substr(2, 9);

        // Check cache first for consistency
        if (idCache.has(id)) {
            return idCache.get(id);
        }

        // Basic sanitization
        let sanitized = id
            .replace(/[^a-zA-Z0-9_]/g, '_')
            .replace(/^(\d)/, 'n$1'); // Ensure doesn't start with number

        // Add hash suffix to prevent collisions (e.g., "A-B" vs "A B")
        const hash = simpleHash(id);
        const finalId = `${sanitized}_${hash}`;

        // Cache for consistency
        idCache.set(id, finalId);

        return finalId;
    };

    /**
     * Clear ID cache (call before each render)
     */
    const clearIDCache = function() {
        idCache.clear();
    };

    /**
     * Render Mermaid diagram in container
     * @param {String} mermaidSyntax - Mermaid diagram syntax
     * @param {String} containerId - ID of container element
     * @returns {Promise} Promise that resolves when rendering complete
     */
    const renderMermaid = async function(mermaidSyntax, containerId) {
        const container = document.getElementById(containerId);
        if (!container) {
            throw new Error(`Container ${containerId} not found`);
        }

        // Clear container
        container.innerHTML = '';

        // Create temporary div for mermaid rendering
        const div = document.createElement('div');
        div.className = 'mermaid';
        div.textContent = mermaidSyntax;
        container.appendChild(div);

        try {
            // Render using Mermaid.js
            await window.mermaid.run({
                nodes: [div]
            });

            return true;
        } catch (error) {
            container.innerHTML = `<div class="text-red-500 p-4">Error rendering diagram: ${error.message}</div>`;
            throw error;
        }
    };

    // Expose to global namespace
    window.GraphApp.core.generateMermaid = generateMermaid;
    window.GraphApp.core.renderMermaid = renderMermaid;
    window.GraphApp.core.sanitizeID = sanitizeID;

})(window);
