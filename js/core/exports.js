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
            let fontWeight = '500';  // Medium weight for better readability
            let fill = '#333';

            // Check if this is a cluster/group label (usually has cluster-label class)
            if (parent && parent.classList && parent.classList.contains('cluster-label')) {
                fontSize = '12px';
                fontWeight = '600';  // Bolder for group titles
                fill = '#333';
            }
            // Check if this is an edge label
            else if (grandparent && grandparent.classList && grandparent.classList.contains('edgeLabel')) {
                fontSize = '12px';
                fontWeight = '500';
                fill = '#333';
            }
            // Node labels
            else {
                fontSize = '14px';
                fontWeight = '500';
                fill = '#333';
            }

            // Try to extract actual styles from the HTML content
            const div = fo.querySelector('div, span, p');
            if (div) {
                const computedStyle = div.style;
                if (computedStyle.fontSize) fontSize = computedStyle.fontSize;
                if (computedStyle.fontWeight) fontWeight = computedStyle.fontWeight;
                if (computedStyle.color) fill = computedStyle.color;
            }

            // Create SVG text element with better styling
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
            // Add slight letter spacing for better readability
            svgText.setAttribute('letter-spacing', '0.01em');
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
        // Use PapaParse to generate CSV
        const csv = Papa.unparse(nodes, {
            header: true,
            columns: [
                'Group_xA',
                'Node_xA',
                'ID_xA',
                'Linked_Node_ID_xA',
                'Hidden_Node_xB',
                'Hidden_Link_xB',
                'Link_Label_xB',
                'Link_Arrow_xB'
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
     * Export diagram as SVG image
     * @param {String} containerId - ID of container with SVG
     * @param {String} filename - Output filename
     */
    const exportSVG = function(containerId, filename) {
        const container = document.getElementById(containerId);
        if (!container) {
            throw new Error('Container not found');
        }

        const svg = container.querySelector('svg');
        if (!svg) {
            throw new Error('No SVG found in container');
        }

        // Clone SVG to avoid modifying the original
        const clonedSvg = svg.cloneNode(true);

        // Reset any transforms (zoom/pan)
        clonedSvg.style.transform = '';
        clonedSvg.style.transformOrigin = '';

        // Ensure proper namespaces
        clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        clonedSvg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');

        // Serialize with XML declaration
        const svgData = '<?xml version="1.0" encoding="UTF-8"?>\n' +
            new XMLSerializer().serializeToString(clonedSvg);

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

    /**
     * Export diagram as PNG image
     * @param {String} containerId - ID of container with SVG
     * @param {String} filename - Output filename
     */
    const exportPNG = async function(containerId, filename) {
        const container = document.getElementById(containerId);
        if (!container) {
            throw new Error('Container not found');
        }

        const svg = container.querySelector('svg');
        if (!svg) {
            throw new Error('No SVG found in container');
        }

        // Clone SVG and reset transforms
        const clonedSvg = svg.cloneNode(true);
        clonedSvg.style.transform = '';
        clonedSvg.style.transformOrigin = '';

        // Get dimensions from viewBox or attributes
        const viewBox = svg.getAttribute('viewBox');
        let width, height;

        if (viewBox) {
            const parts = viewBox.split(' ');
            width = parseFloat(parts[2]) + 40;
            height = parseFloat(parts[3]) + 40;
        } else {
            width = parseFloat(svg.getAttribute('width')) || 800;
            height = parseFloat(svg.getAttribute('height')) || 600;
            width += 40;
            height += 40;
        }

        // Convert foreignObject elements to standard SVG text
        // This is necessary because browsers block foreignObject in canvas for security
        convertForeignObjectsToText(clonedSvg);

        // Ensure proper namespaces
        clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        clonedSvg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');

        // Set explicit dimensions on the SVG
        clonedSvg.setAttribute('width', width - 40);
        clonedSvg.setAttribute('height', height - 40);

        // Create canvas
        const canvas = document.createElement('canvas');
        const scale = 2; // Higher resolution
        canvas.width = width * scale;
        canvas.height = height * scale;
        const ctx = canvas.getContext('2d');
        ctx.scale(scale, scale);

        // Fill white background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);

        // Convert SVG to data URL (more reliable than blob URL)
        const svgData = new XMLSerializer().serializeToString(clonedSvg);
        const svgBase64 = btoa(unescape(encodeURIComponent(svgData)));
        const svgUrl = 'data:image/svg+xml;base64,' + svgBase64;

        // Load SVG as image and draw to canvas
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = function() {
                ctx.drawImage(img, 20, 20);

                // Convert canvas to PNG and download
                canvas.toBlob(function(blob) {
                    if (!blob) {
                        reject(new Error('Failed to create PNG blob'));
                        return;
                    }
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = filename || 'graph.png';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    resolve();
                }, 'image/png');
            };
            img.onerror = function(error) {
                reject(new Error('Failed to load SVG as image. Try SVG export instead.'));
            };
            img.src = svgUrl;
        });
    };

    /**
     * Export diagram as PDF
     * @param {String} containerId - ID of container with SVG
     * @param {String} filename - Output filename
     */
    const exportPDF = async function(containerId, filename) {
        // Check if jsPDF is available
        if (typeof window.jspdf === 'undefined') {
            throw new Error('PDF export requires jsPDF library. Please add it to use this feature.');
        }

        const container = document.getElementById(containerId);
        if (!container) {
            throw new Error('Container not found');
        }

        const svg = container.querySelector('svg');
        if (!svg) {
            throw new Error('No SVG found in container');
        }

        // Clone SVG and reset transforms
        const clonedSvg = svg.cloneNode(true);
        clonedSvg.style.transform = '';
        clonedSvg.style.transformOrigin = '';

        // Get dimensions from viewBox
        const viewBox = svg.getAttribute('viewBox');
        let width, height;

        if (viewBox) {
            const parts = viewBox.split(' ');
            width = parseFloat(parts[2]);
            height = parseFloat(parts[3]);
        } else {
            width = parseFloat(svg.getAttribute('width')) || 800;
            height = parseFloat(svg.getAttribute('height')) || 600;
        }

        // Convert foreignObject elements to standard SVG text
        // This prevents canvas tainting from external resources
        convertForeignObjectsToText(clonedSvg);

        // Ensure proper namespaces
        clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        clonedSvg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');

        // Set explicit dimensions on the SVG
        clonedSvg.setAttribute('width', width);
        clonedSvg.setAttribute('height', height);

        // Determine orientation
        const orientation = width > height ? 'landscape' : 'portrait';

        // Create PDF
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({
            orientation: orientation,
            unit: 'pt',
            format: [width + 40, height + 40]
        });

        // Convert SVG to base64 data URL (prevents canvas tainting)
        const svgData = new XMLSerializer().serializeToString(clonedSvg);
        const svgBase64 = btoa(unescape(encodeURIComponent(svgData)));
        const svgUrl = 'data:image/svg+xml;base64,' + svgBase64;

        // Load SVG as image and render to canvas
        const img = await new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = () => resolve(image);
            image.onerror = () => reject(new Error('Failed to load SVG for PDF export. Try PNG or SVG export instead.'));
            image.src = svgUrl;
        });

        // Create canvas at higher resolution for better quality
        const scale = 2;
        const canvas = document.createElement('canvas');
        canvas.width = width * scale;
        canvas.height = height * scale;
        const ctx = canvas.getContext('2d');
        ctx.scale(scale, scale);

        // Fill white background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);

        // Draw the SVG
        ctx.drawImage(img, 0, 0);

        // Convert canvas to PNG data URL and add to PDF
        const imgData = canvas.toDataURL('image/png');
        pdf.addImage(imgData, 'PNG', 20, 20, width, height);

        pdf.save(filename || 'graph.pdf');
    };

    // Expose to global namespace
    window.GraphApp.exports = {
        exportCSV,
        importCSV,
        exportMermaid,
        importMermaid,
        exportPNG,
        exportSVG,
        exportJSON,
        exportGraphML,
        exportPDF
    };

})(window);
