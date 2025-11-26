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
        // Canvas exports (visible only)
        exportCSVCanvas,
        exportJSONCanvas,
        exportGraphMLCanvas,
        exportDOTCanvas,
        filterVisibleNodes,
        // Image exports (always from canvas)
        exportPNG,
        exportSVG,
        exportPDF
    };

})(window);
