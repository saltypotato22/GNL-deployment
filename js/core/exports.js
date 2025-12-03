/**
 * Export Functions Module
 * Export data to various formats (CSV, PNG, Mermaid)
 */

(function(window) {
    'use strict';

    /**
     * Convert foreignObject elements to native SVG text for canvas export
     * Preserves styling better than simple text extraction
     * @param {SVGElement} svgElement - The SVG element to process
     */
    const convertForeignObjectsToText = function(svgElement) {
        const foreignObjects = svgElement.querySelectorAll('foreignObject');

        foreignObjects.forEach(fo => {
            const text = fo.textContent || '';
            const x = fo.getAttribute('x') || '0';
            const y = fo.getAttribute('y') || '0';
            const foWidth = fo.getAttribute('width') || '100';
            const foHeight = fo.getAttribute('height') || '20';

            // Detect element type based on parent class for appropriate styling
            const parent = fo.parentElement;
            const grandparent = parent ? parent.parentElement : null;

            let fontSize = '14px';
            let fontWeight = '400';  // Normal weight - clean rendering
            let fill = '#333';

            // Check if this is a cluster/group label (usually has cluster-label class)
            if (parent && parent.classList && parent.classList.contains('cluster-label')) {
                fontSize = '12px';
                fontWeight = '600';  // Bold for group titles only
                fill = '#333';
            }
            // Check if this is an edge label
            else if (grandparent && grandparent.classList && grandparent.classList.contains('edgeLabel')) {
                fontSize = '12px';
                fontWeight = '400';  // Normal weight
                fill = '#333';
            }
            // Node labels
            else {
                fontSize = '14px';
                fontWeight = '400';  // Normal weight
                fill = '#333';
            }

            // Try to extract actual styles from the HTML content
            const div = fo.querySelector('div, span, p');
            if (div) {
                const computedStyle = div.style;
                if (computedStyle.fontSize) fontSize = computedStyle.fontSize;
                // Don't inherit font-weight from HTML - use our clean weights
                if (computedStyle.color) fill = computedStyle.color;
            }

            // Create SVG text element with clean rendering
            const svgText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            svgText.setAttribute('x', parseFloat(x) + parseFloat(foWidth) / 2);
            svgText.setAttribute('y', parseFloat(y) + parseFloat(foHeight) / 2 + 4);
            svgText.setAttribute('text-anchor', 'middle');
            svgText.setAttribute('dominant-baseline', 'middle');
            svgText.setAttribute('font-size', fontSize);
            // Use system fonts that render well across platforms
            svgText.setAttribute('font-family', '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif');
            svgText.setAttribute('font-weight', fontWeight);
            svgText.setAttribute('fill', fill);
            // Prevent stroke from causing "dirty" double-line effect
            svgText.setAttribute('stroke', 'none');
            // Hint for crisp text rendering
            svgText.setAttribute('style', 'paint-order: stroke fill');
            svgText.textContent = text.trim();

            // Replace foreignObject with text
            if (fo.parentNode) {
                fo.parentNode.replaceChild(svgText, fo);
            }
        });
    };

    /**
     * Export nodes to CSV
     * @param {Array} nodes - Array of node objects
     * @param {String} filename - Output filename
     */
    const exportCSV = function(nodes, filename) {
        // Use PapaParse to generate CSV (slim 5-column format)
        const csv = Papa.unparse(nodes, {
            header: true,
            columns: [
                'Group_xA',
                'Node_xA',
                'ID_xA',
                'Linked_Node_ID_xA',
                'Link_Label_xB'
            ]
        });

        // Download CSV
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename || 'graph-data.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    /**
     * Import CSV file
     * @param {File} file - CSV file object
     * @returns {Promise<Array>} Promise resolving to array of node objects
     */
    const importCSV = function(file) {
        return new Promise((resolve, reject) => {
            Papa.parse(file, {
                header: true,
                dynamicTyping: true,
                skipEmptyLines: true,
                complete: function(results) {
                    // Ensure all required fields exist
                    // xA = core data (ID auto-generated from Group-Node)
                    // xB = optional modifiers with defaults
                    const nodes = results.data.map(row => {
                        const group = row.Group_xA || '';
                        const nodeName = row.Node_xA || '';
                        return {
                            Group_xA: group,
                            Node_xA: nodeName,
                            ID_xA: row.ID_xA || `${group}-${nodeName}`,
                            Linked_Node_ID_xA: row['Linked_Node_ID_xA'] || row['Linked Node ID_xA'] || '',
                            Hidden_Node_xB: parseInt(row.Hidden_Node_xB) || 0,
                            Hidden_Link_xB: parseInt(row.Hidden_Link_xB) || 0,
                            Link_Label_xB: row['Link_Label_xB'] || row['Link Label_xB'] || '',
                            Link_Arrow_xB: row['Link_Arrow_xB'] || row['Link Arrow_xB'] || 'To'
                        };
                    });

                    resolve(nodes);
                },
                error: function(error) {
                    reject(error);
                }
            });
        });
    };

    /**
     * Export Mermaid diagram to .mmd file
     * @param {String} mermaidSyntax - Mermaid diagram syntax
     * @param {String} filename - Output filename
     */
    const exportMermaid = function(mermaidSyntax, filename) {
        const blob = new Blob([mermaidSyntax], { type: 'text/plain;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename || 'graph.mmd';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    /**
     * Import Mermaid .mmd file
     * @param {File} file - Mermaid file object
     * @returns {Promise<Array>} Promise resolving to array of node objects
     */
    const importMermaid = async function(file) {
        const text = await file.text();
        return window.GraphApp.utils.parseMermaidToNodes(text);
    };

    /**
     * Export diagram as SVG image using Cytoscape
     * @param {String} containerId - ID of container (kept for API compatibility)
     * @param {String} filename - Output filename
     */
    const exportSVG = function(containerId, filename) {
        const cy = window.GraphApp.core.getCytoscapeInstance();
        if (!cy) {
            throw new Error('No graph to export');
        }

        // Use Cytoscape's native SVG export
        const svgContent = cy.svg({
            full: true,  // Include all elements
            scale: 1,
            bg: '#ffffff'
        });

        // Add XML declaration
        const svgData = '<?xml version="1.0" encoding="UTF-8"?>\n' + svgContent;

        // Download
        const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename || 'graph.svg';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    /**
     * Export nodes to JSON
     * @param {Array} nodes - Array of node objects
     * @param {String} filename - Output filename
     */
    const exportJSON = function(nodes, filename) {
        const jsonData = JSON.stringify(nodes, null, 2);
        const blob = new Blob([jsonData], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename || 'graph-data.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    /**
     * Export nodes to GraphML format (yEd-compatible with full visual data)
     * @param {Array} nodes - Array of node objects
     * @param {String} filename - Output filename
     */
    const exportGraphML = function(nodes, filename) {
        // Build yEd-compatible GraphML XML
        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
        xml += '<graphml xmlns="http://graphml.graphdrawing.org/xmlns"\n';
        xml += '         xmlns:java="http://www.yworks.com/xml/yfiles-common/1.0/java"\n';
        xml += '         xmlns:sys="http://www.yworks.com/xml/yfiles-common/markup/primitives/2.0"\n';
        xml += '         xmlns:x="http://www.yworks.com/xml/yfiles-common/markup/2.0"\n';
        xml += '         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"\n';
        xml += '         xmlns:y="http://www.yworks.com/xml/graphml"\n';
        xml += '         xmlns:yed="http://www.yworks.com/xml/yed/3"\n';
        xml += '         xsi:schemaLocation="http://graphml.graphdrawing.org/xmlns http://www.yworks.com/xml/schema/graphml/1.1/ygraphml.xsd">\n';

        // Define yEd data keys
        xml += '  <key id="d0" for="port" yfiles.type="portgraphics"/>\n';
        xml += '  <key id="d1" for="port" yfiles.type="portgeometry"/>\n';
        xml += '  <key id="d2" for="port" yfiles.type="portuserdata"/>\n';
        xml += '  <key id="d3" for="node" attr.name="Group_xA" attr.type="string"/>\n';
        xml += '  <key id="d4" for="node" attr.name="Node_xA" attr.type="string"/>\n';
        xml += '  <key id="d5" for="node" attr.name="ID_xA" attr.type="string"/>\n';
        xml += '  <key id="d6" for="node" attr.name="url" attr.type="string"/>\n';
        xml += '  <key id="d7" for="node" attr.name="description" attr.type="string"/>\n';
        xml += '  <key id="d8" for="node" yfiles.type="nodegraphics"/>\n';
        xml += '  <key id="d9" for="graphml" yfiles.type="resources"/>\n';
        xml += '  <key id="d10" for="edge" attr.name="Link_Label_xB" attr.type="string"/>\n';
        xml += '  <key id="d11" for="edge" attr.name="url" attr.type="string"/>\n';
        xml += '  <key id="d12" for="edge" attr.name="description" attr.type="string"/>\n';
        xml += '  <key id="d13" for="edge" yfiles.type="edgegraphics"/>\n';
        xml += '  <key id="d14" for="edge" attr.name="Link_Arrow_xB" attr.type="string"/>\n';

        xml += '  <graph id="G" edgedefault="directed">\n';

        // Group nodes by Group_xA
        const groups = {};
        const nodeIdMap = {}; // Maps ID_xA to yEd node ID (e.g., "n0::0")

        nodes.forEach(node => {
            const groupName = node.Group_xA || 'Ungrouped';
            if (!groups[groupName]) {
                groups[groupName] = [];
            }
            groups[groupName].push(node);
        });

        const groupNames = Object.keys(groups);

        // Generate group container nodes with nested graphs
        groupNames.forEach((groupName, groupIndex) => {
            const groupNodes = groups[groupName];
            const groupId = `n${groupIndex}`;

            // Group container node
            xml += `    <node id="${groupId}" yfiles.foldertype="group">\n`;
            xml += `      <data key="d3"/>\n`;
            xml += `      <data key="d4"/>\n`;
            xml += `      <data key="d5">${escapeXml(groupName)}</data>\n`;
            xml += `      <data key="d7"/>\n`;
            xml += `      <data key="d8">\n`;
            xml += `        <y:ProxyAutoBoundsNode>\n`;
            xml += `          <y:Realizers active="0">\n`;
            xml += `            <y:GroupNode>\n`;
            xml += `              <y:Geometry height="200.0" width="400.0" x="0.0" y="0.0"/>\n`;
            xml += `              <y:Fill color="#FFFFFF" transparent="false"/>\n`;
            xml += `              <y:BorderStyle color="#000000" type="dashed" width="1.0"/>\n`;
            xml += `              <y:NodeLabel alignment="center" autoSizePolicy="node_width" backgroundColor="#EBEBEB" borderDistance="0.0" fontFamily="Dialog" fontSize="18" fontStyle="plain" hasLineColor="false" height="26.0" horizontalTextPosition="center" iconTextGap="4" modelName="internal" modelPosition="tl" textColor="#000000" verticalTextPosition="bottom" visible="true" width="400.0" x="0.0" y="0.0">${escapeXml(groupName)}</y:NodeLabel>\n`;
            xml += `              <y:Shape type="roundrectangle"/>\n`;
            xml += `              <y:Insets bottom="15" left="15" right="15" top="15"/>\n`;
            xml += `              <y:BorderInsets bottom="0" left="0" right="0" top="0"/>\n`;
            xml += `            </y:GroupNode>\n`;
            xml += `          </y:Realizers>\n`;
            xml += `        </y:ProxyAutoBoundsNode>\n`;
            xml += `      </data>\n`;

            // Nested graph for child nodes
            xml += `      <graph edgedefault="directed" id="${groupId}:">\n`;

            // Add child nodes
            groupNodes.forEach((node, nodeIndex) => {
                const nodeId = `${groupId}::${nodeIndex}`;
                nodeIdMap[node.ID_xA] = nodeId;

                const nodeLabel = node.Node_xA || '';
                const yPos = nodeIndex * 120; // Vertical spacing

                xml += `        <node id="${nodeId}">\n`;
                xml += `          <data key="d3">${escapeXml(groupName)}</data>\n`;
                xml += `          <data key="d4">${escapeXml(nodeLabel)}</data>\n`;
                xml += `          <data key="d5">${escapeXml(node.ID_xA || '')}</data>\n`;
                xml += `          <data key="d7"/>\n`;
                xml += `          <data key="d8">\n`;
                xml += `            <y:ShapeNode>\n`;
                xml += `              <y:Geometry height="40.0" width="120.0" x="0.0" y="${yPos}"/>\n`;
                xml += `              <y:Fill color="#FFFFFF" transparent="false"/>\n`;
                xml += `              <y:BorderStyle color="#000000" raised="false" type="line" width="1.0"/>\n`;
                xml += `              <y:NodeLabel alignment="center" autoSizePolicy="content" fontFamily="Dialog" fontSize="12" fontStyle="plain" hasBackgroundColor="false" hasLineColor="false" height="20.0" horizontalTextPosition="center" iconTextGap="4" modelName="internal" modelPosition="c" textColor="#000000" verticalTextPosition="bottom" visible="true" width="100.0" x="10.0" y="10.0">${escapeXml(nodeLabel)}</y:NodeLabel>\n`;
                xml += `              <y:Shape type="roundrectangle"/>\n`;
                xml += `            </y:ShapeNode>\n`;
                xml += `          </data>\n`;
                xml += `        </node>\n`;
            });

            xml += `      </graph>\n`;
            xml += `    </node>\n`;
        });

        // Add edges with yEd edge graphics
        let edgeId = 0;
        nodes.forEach(node => {
            if (node.Linked_Node_ID_xA && node.ID_xA && !node.Hidden_Link_xB) {
                const sourceYedId = nodeIdMap[node.ID_xA];
                const targetYedId = nodeIdMap[node.Linked_Node_ID_xA];

                // Skip if source or target not found
                if (!sourceYedId || !targetYedId) return;

                const label = node.Link_Label_xB || '';
                const arrowType = node.Link_Arrow_xB || 'To';

                // Determine arrow directions
                let sourceArrow = 'none';
                let targetArrow = 'standard';

                switch (arrowType) {
                    case 'To':
                        sourceArrow = 'none';
                        targetArrow = 'standard';
                        break;
                    case 'From':
                        sourceArrow = 'standard';
                        targetArrow = 'none';
                        break;
                    case 'Both':
                        sourceArrow = 'standard';
                        targetArrow = 'standard';
                        break;
                    case 'None':
                        sourceArrow = 'none';
                        targetArrow = 'none';
                        break;
                }

                xml += `    <edge id="e${edgeId++}" source="${sourceYedId}" target="${targetYedId}">\n`;
                xml += `      <data key="d10">${escapeXml(label)}</data>\n`;
                xml += `      <data key="d14">${escapeXml(arrowType)}</data>\n`;
                xml += `      <data key="d12"/>\n`;
                xml += `      <data key="d13">\n`;
                xml += `        <y:PolyLineEdge>\n`;
                xml += `          <y:Path sx="0.0" sy="0.0" tx="0.0" ty="0.0"/>\n`;
                xml += `          <y:LineStyle color="#000000" type="line" width="1.0"/>\n`;
                xml += `          <y:Arrows source="${sourceArrow}" target="${targetArrow}"/>\n`;
                if (label) {
                    xml += `          <y:EdgeLabel alignment="center" configuration="AutoFlippingLabel" distance="2.0" fontFamily="Dialog" fontSize="12" fontStyle="plain" hasBackgroundColor="false" hasLineColor="false" height="18.0" horizontalTextPosition="center" iconTextGap="4" modelName="custom" ratio="0.5" textColor="#000000" verticalTextPosition="bottom" visible="true" width="80.0" x="0.0" y="0.0">${escapeXml(label)}</y:EdgeLabel>\n`;
                }
                xml += `          <y:BendStyle smoothed="false"/>\n`;
                xml += `        </y:PolyLineEdge>\n`;
                xml += `      </data>\n`;
                xml += `    </edge>\n`;
            }
        });

        xml += '  </graph>\n';
        xml += '  <data key="d9">\n';
        xml += '    <y:Resources/>\n';
        xml += '  </data>\n';
        xml += '</graphml>\n';

        // Download
        const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename || 'graph.graphml';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    // Helper function to escape XML special characters
    const escapeXml = function(str) {
        if (!str) return '';
        return str.toString()
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    };

    // Helper function to escape DOT special characters
    const escapeDot = function(str) {
        if (!str) return '';
        return str.toString()
            .replace(/\\/g, '\\\\')
            .replace(/"/g, '\\"')
            .replace(/\n/g, '\\n');
    };

    /**
     * Export nodes to GraphViz DOT format
     * @param {Array} nodes - Array of node objects
     * @param {String} filename - Output filename
     * @param {Object} settings - Layout settings (for direction)
     */
    const exportDOT = function(nodes, filename, settings) {
        const direction = settings && settings.direction === 'LR' ? 'LR' : 'TB';

        let dot = 'digraph G {\n';
        dot += `    rankdir=${direction};\n`;
        dot += '    node [shape=box, style=rounded, fontname="Arial"];\n';
        dot += '    edge [fontname="Arial", fontsize=10];\n';
        dot += '    compound=true;\n\n';

        // Group nodes by Group_xA
        const groups = {};
        nodes.forEach(node => {
            const groupName = node.Group_xA || 'Ungrouped';
            if (!groups[groupName]) {
                groups[groupName] = [];
            }
            groups[groupName].push(node);
        });

        // Generate subgraphs for each group
        let clusterIndex = 0;
        Object.keys(groups).forEach(groupName => {
            const groupNodes = groups[groupName];

            dot += `    subgraph cluster_${clusterIndex} {\n`;
            dot += `        label="${escapeDot(groupName)}";\n`;
            dot += '        style=dashed;\n';
            dot += '        bgcolor="#f8f8f8";\n';

            // Add nodes in this group
            groupNodes.forEach(node => {
                const nodeId = escapeDot(node.ID_xA || '');
                const nodeLabel = escapeDot(node.Node_xA || '');
                dot += `        "${nodeId}" [label="${nodeLabel}"];\n`;
            });

            dot += '    }\n\n';
            clusterIndex++;
        });

        // Add edges
        nodes.forEach(node => {
            if (node.Linked_Node_ID_xA && node.ID_xA && !node.Hidden_Link_xB) {
                const sourceId = escapeDot(node.ID_xA);
                const targetId = escapeDot(node.Linked_Node_ID_xA);
                const label = escapeDot(node.Link_Label_xB || '');
                const arrowType = node.Link_Arrow_xB || 'To';

                let arrowhead = 'normal';
                let arrowtail = 'none';
                let dir = 'forward';

                switch (arrowType) {
                    case 'To':
                        dir = 'forward';
                        arrowhead = 'normal';
                        arrowtail = 'none';
                        break;
                    case 'From':
                        dir = 'back';
                        arrowhead = 'none';
                        arrowtail = 'normal';
                        break;
                    case 'Both':
                        dir = 'both';
                        arrowhead = 'normal';
                        arrowtail = 'normal';
                        break;
                    case 'None':
                        dir = 'none';
                        arrowhead = 'none';
                        arrowtail = 'none';
                        break;
                }

                let edgeAttr = `dir=${dir}`;
                if (label) {
                    edgeAttr += `, label="${label}"`;
                }

                dot += `    "${sourceId}" -> "${targetId}" [${edgeAttr}];\n`;
            }
        });

        dot += '}\n';

        // Download
        const blob = new Blob([dot], { type: 'text/vnd.graphviz;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename || 'graph.dot';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    /**
     * Export diagram as PNG image using Cytoscape
     * @param {String} containerId - ID of container (kept for API compatibility)
     * @param {String} filename - Output filename
     */
    const exportPNG = async function(containerId, filename) {
        const cy = window.GraphApp.core.getCytoscapeInstance();
        if (!cy) {
            throw new Error('No graph to export');
        }

        // Use Cytoscape's native PNG export
        const pngBlob = await cy.png({
            output: 'blob',
            bg: '#ffffff',
            scale: 2,  // 2x resolution for crisp output
            full: true  // Include all elements, not just viewport
        });

        // Download
        const url = URL.createObjectURL(pngBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename || 'graph.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    // =========================================
    // EXCALIDRAW EXPORT
    // =========================================

    /**
     * Generate random ID for Excalidraw elements
     * @returns {String} Random 8-character ID
     */
    const generateExcalidrawId = function() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < 8; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    };

    /**
     * Generate random seed for Excalidraw roughness
     * @returns {Number} Random seed integer
     */
    const generateSeed = function() {
        return Math.floor(Math.random() * 2147483647);
    };

    /**
     * Create base Excalidraw element with common properties
     * @param {String} type - Element type
     * @param {Number} x - X position
     * @param {Number} y - Y position
     * @param {Number} width - Width
     * @param {Number} height - Height
     * @returns {Object} Base element object
     */
    const createBaseElement = function(type, x, y, width, height) {
        return {
            id: generateExcalidrawId(),
            type: type,
            x: x,
            y: y,
            width: width,
            height: height,
            angle: 0,
            strokeColor: '#1e1e1e',
            backgroundColor: 'transparent',
            fillStyle: 'solid',
            strokeWidth: 2,
            strokeStyle: 'solid',
            roughness: 1,
            opacity: 100,
            seed: generateSeed(),
            version: 1,
            versionNonce: generateSeed(),
            isDeleted: false,
            groupIds: [],
            frameId: null,
            boundElements: [],
            updated: Date.now(),
            link: null,
            locked: false
        };
    };

    /**
     * Create Excalidraw rectangle element
     * @param {String} id - Element ID
     * @param {Number} x - X position
     * @param {Number} y - Y position
     * @param {Number} width - Width
     * @param {Number} height - Height
     * @param {String} frameId - Parent frame ID (optional)
     * @returns {Object} Rectangle element
     */
    const createExcalidrawRectangle = function(id, x, y, width, height, frameId) {
        const rect = createBaseElement('rectangle', x, y, width, height);
        rect.id = id;
        rect.roundness = { type: 3 };  // Rounded corners
        rect.backgroundColor = '#ffffff';
        if (frameId) {
            rect.frameId = frameId;
        }
        return rect;
    };

    /**
     * Create Excalidraw text element
     * @param {String} id - Element ID
     * @param {String} text - Text content
     * @param {Number} x - X position
     * @param {Number} y - Y position
     * @param {Number} width - Width
     * @param {Number} height - Height
     * @param {String} containerId - Parent container ID (for bound text)
     * @returns {Object} Text element
     */
    const createExcalidrawText = function(id, text, x, y, width, height, containerId) {
        const textEl = createBaseElement('text', x, y, width, height);
        textEl.id = id;
        textEl.text = text;
        textEl.fontSize = 16;
        textEl.fontFamily = 1;  // Hand-drawn style
        textEl.textAlign = 'center';
        textEl.verticalAlign = 'middle';
        textEl.baseline = 0;
        textEl.strokeWidth = 1;
        textEl.backgroundColor = 'transparent';
        if (containerId) {
            textEl.containerId = containerId;
        }
        return textEl;
    };

    /**
     * Create Excalidraw arrow element
     * @param {String} id - Element ID
     * @param {Object} startPos - Start position {x, y}
     * @param {Object} endPos - End position {x, y}
     * @param {String} label - Arrow label
     * @param {String} arrowType - 'To', 'From', 'Both', or 'None'
     * @param {Object} startBinding - Start binding info {elementId, focus, gap}
     * @param {Object} endBinding - End binding info {elementId, focus, gap}
     * @returns {Object} Arrow element
     */
    const createExcalidrawArrow = function(id, startPos, endPos, label, arrowType, startBinding, endBinding) {
        const arrow = createBaseElement('arrow', startPos.x, startPos.y, 0, 0);
        arrow.id = id;

        // Calculate relative points
        arrow.points = [
            [0, 0],
            [endPos.x - startPos.x, endPos.y - startPos.y]
        ];

        // Set arrow heads based on type
        switch (arrowType) {
            case 'To':
                arrow.startArrowhead = null;
                arrow.endArrowhead = 'arrow';
                break;
            case 'From':
                arrow.startArrowhead = 'arrow';
                arrow.endArrowhead = null;
                break;
            case 'Both':
                arrow.startArrowhead = 'arrow';
                arrow.endArrowhead = 'arrow';
                break;
            case 'None':
            default:
                arrow.startArrowhead = null;
                arrow.endArrowhead = null;
                break;
        }

        // Add bindings
        arrow.startBinding = startBinding;
        arrow.endBinding = endBinding;

        // Round corners for smoother arrows
        arrow.roundness = { type: 2 };

        return { arrow, label };
    };

    /**
     * Create Excalidraw frame element
     * @param {String} id - Element ID
     * @param {String} name - Frame name
     * @param {Number} x - X position
     * @param {Number} y - Y position
     * @param {Number} width - Width
     * @param {Number} height - Height
     * @returns {Object} Frame element
     */
    const createExcalidrawFrame = function(id, name, x, y, width, height) {
        const frame = createBaseElement('frame', x, y, width, height);
        frame.id = id;
        frame.name = name;
        frame.strokeColor = '#bbb';
        frame.backgroundColor = 'transparent';
        frame.strokeWidth = 1;
        frame.strokeStyle = 'solid';
        // Frames don't need roughness
        delete frame.roughness;
        delete frame.fillStyle;
        return frame;
    };

    /**
     * Check if two frames overlap (with gap)
     * Returns true if frames are closer than the required gap
     * @param {Object} f1 - First frame {x, y, width, height}
     * @param {Object} f2 - Second frame {x, y, width, height}
     * @param {Number} gap - Minimum gap between frames
     * @returns {Boolean} True if frames overlap or are too close
     */
    const framesOverlap = function(f1, f2, gap) {
        // Check if frames are separated by at least 'gap' pixels
        const separatedX = (f1.x + f1.width + gap <= f2.x) || (f2.x + f2.width + gap <= f1.x);
        const separatedY = (f1.y + f1.height + gap <= f2.y) || (f2.y + f2.height + gap <= f1.y);
        // If separated on either axis, no overlap
        return !(separatedX || separatedY);
    };

    /**
     * Fix overlapping frames by shifting them apart
     * Uses a simple greedy algorithm: for each overlapping pair, shift the second frame
     * @param {Array} frameDataList - Array of frame data objects
     * @param {Array} elements - All Excalidraw elements
     * @param {Map} rectIdToNodeId - Map of rectangle IDs to node IDs
     */
    const fixOverlappingFrames = function(frameDataList, elements, rectIdToNodeId) {
        const FRAME_GAP = 30;  // Minimum gap between frames (increased for visibility)
        const MAX_ITERATIONS = 50;  // Prevent infinite loops

        // Sort frames by position (top-left to bottom-right)
        frameDataList.sort((a, b) => {
            const aScore = a.y * 10000 + a.x;
            const bScore = b.y * 10000 + b.x;
            return aScore - bScore;
        });

        let iterations = 0;
        let changed = true;

        while (changed && iterations < MAX_ITERATIONS) {
            changed = false;
            iterations++;

            for (let i = 0; i < frameDataList.length; i++) {
                for (let j = i + 1; j < frameDataList.length; j++) {
                    const f1 = frameDataList[i];
                    const f2 = frameDataList[j];

                    if (framesOverlap(f1, f2, FRAME_GAP)) {
                        // Calculate how much we need to shift f2 to clear f1
                        // Check both directions and choose the minimum shift
                        const shiftRightX = (f1.x + f1.width + FRAME_GAP) - f2.x;
                        const shiftDownY = (f1.y + f1.height + FRAME_GAP) - f2.y;

                        // Only shift if positive (f2 needs to move right/down)
                        let shiftX = 0, shiftY = 0;

                        // Prefer the smaller shift, but must be positive
                        if (shiftRightX > 0 && shiftDownY > 0) {
                            // Both directions need shift, choose smaller
                            if (shiftRightX <= shiftDownY) {
                                shiftX = shiftRightX;
                            } else {
                                shiftY = shiftDownY;
                            }
                        } else if (shiftRightX > 0) {
                            shiftX = shiftRightX;
                        } else if (shiftDownY > 0) {
                            shiftY = shiftDownY;
                        }

                        if (shiftX > 0 || shiftY > 0) {
                            // Update frame data (for future overlap checks)
                            f2.x += shiftX;
                            f2.y += shiftY;

                            // Find and update the frame element in elements array
                            const frameEl = elements.find(el => el.id === f2.frameId);
                            if (frameEl) {
                                frameEl.x += shiftX;
                                frameEl.y += shiftY;
                            }

                            // Update all child elements (rectangles and texts)
                            f2.childIds.forEach(childId => {
                                const childEl = elements.find(el => el.id === childId);
                                if (childEl) {
                                    childEl.x += shiftX;
                                    childEl.y += shiftY;
                                }
                            });

                            changed = true;
                        }
                    }
                }
            }
        }

        return frameDataList;
    };

    /**
     * Export nodes to Excalidraw format
     * @param {Array} nodes - Array of node objects
     * @param {String} filename - Output filename
     */
    const exportExcalidraw = function(nodes, filename) {
        const cy = window.GraphApp.core.getCytoscapeInstance();
        if (!cy) {
            console.error('No graph to export');
            return;
        }

        const elements = [];
        const nodeIdToExcalidrawId = new Map();  // Slim Graph ID -> Excalidraw rect ID
        const groupIdToFrameId = new Map();      // Group name -> Frame ID
        const frameDataList = [];                 // Track frame positions for overlap detection
        const rectIdToNodeId = new Map();        // Excalidraw rect ID -> Slim Graph node ID

        // Frame padding constants
        const FRAME_PADDING = 30;
        const NODE_HEIGHT = 40;
        const CHAR_WIDTH = 9;  // Approximate character width for 16px font

        // Step 1: Group nodes by their parent group
        const groupedNodes = new Map();
        cy.nodes('[!isGroup][!isGroupLabel]').forEach(cyNode => {
            const parentId = cyNode.data('parent');
            const groupName = parentId ? parentId.replace('group_', '') : 'Ungrouped';
            if (!groupedNodes.has(groupName)) {
                groupedNodes.set(groupName, []);
            }
            groupedNodes.get(groupName).push(cyNode);
        });

        // Step 2: Create frames for each group and position nodes
        groupedNodes.forEach((cyNodes, groupName) => {
            if (cyNodes.length === 0) return;

            // Calculate bounding box for this group
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            cyNodes.forEach(cyNode => {
                const bb = cyNode.boundingBox({ includeOverlays: false });
                minX = Math.min(minX, bb.x1);
                minY = Math.min(minY, bb.y1);
                maxX = Math.max(maxX, bb.x2);
                maxY = Math.max(maxY, bb.y2);
            });

            // Create frame
            const frameId = generateExcalidrawId();
            groupIdToFrameId.set(groupName, frameId);
            const frameX = minX - FRAME_PADDING;
            const frameY = minY - FRAME_PADDING - 25;  // Extra space for frame label
            const frameWidth = (maxX - minX) + FRAME_PADDING * 2;
            const frameHeight = (maxY - minY) + FRAME_PADDING * 2 + 25;

            const frame = createExcalidrawFrame(frameId, groupName, frameX, frameY, frameWidth, frameHeight);
            elements.push(frame);

            // Track frame data for overlap detection
            const childIds = [];

            // Create rectangles for each node in this group
            cyNodes.forEach(cyNode => {
                const nodeId = cyNode.id();
                const label = cyNode.data('label') || '';
                const pos = cyNode.position();

                const rectWidth = Math.max(60, label.length * CHAR_WIDTH + 20);
                const rectHeight = NODE_HEIGHT;
                const rectX = pos.x - rectWidth / 2;
                const rectY = pos.y - rectHeight / 2;

                // Create rectangle
                const rectId = generateExcalidrawId();
                nodeIdToExcalidrawId.set(nodeId, rectId);
                rectIdToNodeId.set(rectId, nodeId);

                const rect = createExcalidrawRectangle(rectId, rectX, rectY, rectWidth, rectHeight, frameId);

                // Create text inside rectangle
                const textId = generateExcalidrawId();
                const text = createExcalidrawText(textId, label, rectX, rectY, rectWidth, rectHeight, rectId);

                // Link text to rectangle
                rect.boundElements = [{ id: textId, type: 'text' }];

                elements.push(rect);
                elements.push(text);

                // Track child IDs for frame shifting
                childIds.push(rectId);
                childIds.push(textId);
            });

            // Store frame data for overlap detection
            frameDataList.push({
                frameId: frameId,
                groupName: groupName,
                x: frameX,
                y: frameY,
                width: frameWidth,
                height: frameHeight,
                childIds: childIds
            });
        });

        // Step 3: Fix overlapping frames
        fixOverlappingFrames(frameDataList, elements, rectIdToNodeId);

        // Step 4: Create arrows for edges (after frame positions are finalized)
        cy.edges().forEach(cyEdge => {
            const sourceId = cyEdge.source().id();
            const targetId = cyEdge.target().id();
            const label = cyEdge.data('label') || '';
            const arrowType = cyEdge.data('arrow') || 'To';

            const sourceRectId = nodeIdToExcalidrawId.get(sourceId);
            const targetRectId = nodeIdToExcalidrawId.get(targetId);

            if (!sourceRectId || !targetRectId) return;

            // Get positions from the actual rectangle elements (after potential shifting)
            const sourceRect = elements.find(el => el.id === sourceRectId);
            const targetRect = elements.find(el => el.id === targetRectId);

            if (!sourceRect || !targetRect) return;

            // Calculate center positions of rectangles
            const sourcePos = {
                x: sourceRect.x + sourceRect.width / 2,
                y: sourceRect.y + sourceRect.height / 2
            };
            const targetPos = {
                x: targetRect.x + targetRect.width / 2,
                y: targetRect.y + targetRect.height / 2
            };

            // Create arrow with bindings
            const arrowId = generateExcalidrawId();
            const { arrow } = createExcalidrawArrow(
                arrowId,
                sourcePos,
                targetPos,
                label,
                arrowType,
                { elementId: sourceRectId, focus: 0, gap: 5 },
                { elementId: targetRectId, focus: 0, gap: 5 }
            );

            // Add arrow as bound element to source and target rectangles
            if (sourceRect) {
                sourceRect.boundElements = sourceRect.boundElements || [];
                sourceRect.boundElements.push({ id: arrowId, type: 'arrow' });
            }
            if (targetRect) {
                targetRect.boundElements = targetRect.boundElements || [];
                targetRect.boundElements.push({ id: arrowId, type: 'arrow' });
            }

            elements.push(arrow);

            // Add label as text element if present
            if (label) {
                const midX = (sourcePos.x + targetPos.x) / 2;
                const midY = (sourcePos.y + targetPos.y) / 2;
                const labelWidth = label.length * CHAR_WIDTH + 10;
                const labelText = createExcalidrawText(
                    generateExcalidrawId(),
                    label,
                    midX - labelWidth / 2,
                    midY - 10,
                    labelWidth,
                    20,
                    null
                );
                labelText.fontSize = 14;
                elements.push(labelText);
            }
        });

        // Build final Excalidraw document
        const excalidrawData = {
            type: 'excalidraw',
            version: 2,
            source: window.location.origin || 'https://slimgraph.app',
            elements: elements,
            appState: {
                gridSize: 20,
                viewBackgroundColor: '#ffffff'
            },
            files: {}
        };

        // Download as .excalidraw file
        const blob = new Blob([JSON.stringify(excalidrawData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename || 'diagram.excalidraw';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    /**
     * Export visible nodes to Excalidraw (canvas-filtered)
     * @param {Array} nodes - Array of node objects
     * @param {String} filename - Output filename
     */
    const exportExcalidrawCanvas = function(nodes, filename) {
        // The Excalidraw export already uses Cytoscape canvas state
        // This is included for API consistency
        exportExcalidraw(nodes, filename || 'diagram-canvas.excalidraw');
    };

    /**
     * Export diagram as PDF using Cytoscape
     * @param {String} containerId - ID of container (kept for API compatibility)
     * @param {String} filename - Output filename
     */
    const exportPDF = async function(containerId, filename) {
        // Check if jsPDF is available
        if (typeof window.jspdf === 'undefined') {
            throw new Error('PDF export requires jsPDF library. Please add it to use this feature.');
        }

        const cy = window.GraphApp.core.getCytoscapeInstance();
        if (!cy) {
            throw new Error('No graph to export');
        }

        // Get bounding box of all elements
        const bb = cy.elements().boundingBox();
        const width = bb.w + 80;  // Add padding
        const height = bb.h + 80;

        // Determine orientation
        const orientation = width > height ? 'landscape' : 'portrait';

        // Create PDF with compression
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({
            orientation: orientation,
            unit: 'pt',
            format: [width, height],
            compress: true
        });

        // Get PNG from Cytoscape (uses JPEG internally for smaller size)
        // Scale based on diagram size - larger diagrams use lower scale
        const maxDimension = Math.max(width, height);
        const scale = maxDimension > 2000 ? 1 : 1.5;

        const pngDataUrl = cy.png({
            output: 'base64uri',
            bg: '#ffffff',
            scale: scale,
            full: true
        });

        // Add image to PDF
        pdf.addImage(pngDataUrl, 'PNG', 40, 40, bb.w, bb.h);

        pdf.save(filename || 'graph.pdf');
    };

    // =========================================
    // CANVAS-FILTERED EXPORTS
    // Export only nodes visible on canvas
    // =========================================

    /**
     * Filter nodes to only those currently visible on canvas
     * @param {Array} nodes - Full nodes array
     * @returns {Array} Filtered nodes array
     */
    const filterVisibleNodes = function(nodes) {
        const getVisibleIDs = window.GraphApp.core.getVisibleNodeIDs;
        if (!getVisibleIDs) return nodes; // Fallback if function not available

        const visibleIDs = getVisibleIDs();
        if (visibleIDs.size === 0) return nodes; // Fallback if no canvas

        return nodes.filter(node => visibleIDs.has(node.ID_xA));
    };

    /**
     * Export visible nodes to CSV (canvas-filtered)
     */
    const exportCSVCanvas = function(nodes, filename) {
        const filteredNodes = filterVisibleNodes(nodes);
        exportCSV(filteredNodes, filename || 'graph-canvas.csv');
    };

    /**
     * Export visible nodes to JSON (canvas-filtered)
     */
    const exportJSONCanvas = function(nodes, filename) {
        const filteredNodes = filterVisibleNodes(nodes);
        exportJSON(filteredNodes, filename || 'graph-canvas.json');
    };

    /**
     * Export visible nodes to GraphML (canvas-filtered)
     */
    const exportGraphMLCanvas = function(nodes, filename) {
        const filteredNodes = filterVisibleNodes(nodes);
        exportGraphML(filteredNodes, filename || 'graph-canvas.graphml');
    };

    /**
     * Export visible nodes to DOT (canvas-filtered)
     */
    const exportDOTCanvas = function(nodes, filename, settings) {
        const filteredNodes = filterVisibleNodes(nodes);
        exportDOT(filteredNodes, filename || 'graph-canvas.dot', settings);
    };

    // Expose to global namespace
    window.GraphApp.exports = {
        // Table exports (all rows)
        exportCSV,
        importCSV,
        exportMermaid,
        importMermaid,
        exportJSON,
        exportGraphML,
        exportDOT,
        exportExcalidraw,
        // Canvas exports (visible only)
        exportCSVCanvas,
        exportJSONCanvas,
        exportGraphMLCanvas,
        exportDOTCanvas,
        exportExcalidrawCanvas,
        filterVisibleNodes,
        // Image exports (always from canvas)
        exportPNG,
        exportSVG,
        exportPDF
    };

})(window);
