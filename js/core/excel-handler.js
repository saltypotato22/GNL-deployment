/**
 * Excel Handler Module
 * Import/Export Excel files with formula preservation
 */

(function(window) {
    'use strict';

    /**
     * Import Excel file with formula preservation
     * Uses header-based column mapping for flexibility
     * Auto-generates ID_xA from Group-Node if missing
     * @param {File} file - Excel file object
     * @returns {Promise<Array>} Promise resolving to array of node objects
     */
    const importExcel = async function(file) {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(await file.arrayBuffer());

        const worksheet = workbook.getWorksheet(1) || workbook.worksheets[0];
        if (!worksheet) {
            throw new Error('No worksheet found in Excel file');
        }

        // Build column map from header row
        const columnMap = {};
        const headerRow = worksheet.getRow(1);
        headerRow.eachCell((cell, colNumber) => {
            const headerName = getCellValue(cell).trim();
            if (headerName) {
                columnMap[headerName] = colNumber;
            }
        });

        // Helper to get value by column name (supports alternate names)
        const getColumnValue = (row, ...columnNames) => {
            for (const name of columnNames) {
                if (columnMap[name]) {
                    return getCellValue(row.getCell(columnMap[name]));
                }
            }
            return '';
        };

        const nodes = [];

        worksheet.eachRow((row, rowNumber) => {
            // Skip header row
            if (rowNumber === 1) return;

            // xA = core data (ID auto-generated from Group-Node)
            // xB = optional modifiers with defaults
            const group = getColumnValue(row, 'Group_xA');
            const nodeName = getColumnValue(row, 'Node_xA');
            const id = getColumnValue(row, 'ID_xA');

            const node = {
                Group_xA: group,
                Node_xA: nodeName,
                ID_xA: id || `${group}-${nodeName}`,
                Linked_Node_ID_xA: getColumnValue(row, 'Linked_Node_ID_xA', 'Linked Node ID_xA'),
                Hidden_Node_xB: parseInt(getColumnValue(row, 'Hidden_Node_xB', 'Hidden Node_xB')) || 0,
                Hidden_Link_xB: parseInt(getColumnValue(row, 'Hidden_Link_xB', 'Hidden Link_xB')) || 0,
                Link_Label_xB: getColumnValue(row, 'Link_Label_xB', 'Link Label_xB') || '',
                Link_Arrow_xB: getColumnValue(row, 'Link_Arrow_xB', 'Link Arrow_xB') || 'To'
            };

            // Only add if row has data
            if (node.Group_xA || node.Node_xA) {
                nodes.push(node);
            }
        });

        return nodes;
    };

    /**
     * Get cell value, handling formulas
     * @param {Object} cell - ExcelJS cell object
     * @returns {String} Cell value
     */
    const getCellValue = function(cell) {
        if (!cell || cell.value === null || cell.value === undefined) {
            return '';
        }

        // If cell contains formula, use the cached result
        if (cell.type === ExcelJS.ValueType.Formula) {
            return cell.result || '';
        }

        return String(cell.value || '');
    };

    /**
     * Export nodes to Excel with formula preservation
     * @param {Array} nodes - Array of node objects
     * @param {String} filename - Output filename
     */
    const exportExcel = async function(nodes, filename) {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Sheet1');

        // Add headers (slim 5-column format)
        worksheet.addRow([
            'Group_xA',
            'Node_xA',
            'ID_xA',
            'Linked Node ID_xA',
            'Link Label_xB'
        ]);

        // Style header row
        const headerRow = worksheet.getRow(1);
        headerRow.font = { bold: true };
        headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE5E7EB' }
        };

        // Build ID-to-row lookup map for cell references
        const idToRowMap = {};
        nodes.forEach((node, index) => {
            if (node.ID_xA) {
                idToRowMap[node.ID_xA] = index + 2; // +2 for header row and 0-index
            }
        });

        // Add data rows with formulas for ID_xA
        nodes.forEach((node, index) => {
            const rowNumber = index + 2; // +1 for header, +1 for 0-index

            const row = worksheet.addRow([
                node.Group_xA,
                node.Node_xA,
                '', // Will be replaced with formula
                '', // Will be set below with formula or value
                node.Link_Label_xB || ''
            ]);

            // Set formula for ID_xA (column C)
            // Formula: =A2&"-"&B2
            const idCell = worksheet.getCell(`C${rowNumber}`);
            idCell.value = {
                formula: `A${rowNumber}&"-"&B${rowNumber}`,
                result: node.ID_xA
            };

            // Set Linked_Node_ID_xA as cell reference formula if target exists
            const linkedValue = node.Linked_Node_ID_xA;
            if (linkedValue) {
                const targetRow = idToRowMap[linkedValue];
                const linkCell = worksheet.getCell(`D${rowNumber}`);

                if (targetRow) {
                    // Target exists in dataset - use cell reference formula
                    linkCell.value = {
                        formula: `C${targetRow}`,
                        result: linkedValue
                    };
                } else {
                    // External/invalid reference - use static value
                    linkCell.value = linkedValue;
                }
            }
        });

        // Auto-fit columns
        worksheet.columns.forEach((column, index) => {
            let maxLength = 10;
            column.eachCell({ includeEmpty: true }, cell => {
                const length = String(cell.value).length;
                if (length > maxLength) {
                    maxLength = length;
                }
            });
            column.width = Math.min(maxLength + 2, 50);
        });

        // Download file
        const buffer = await workbook.xlsx.writeBuffer();
        downloadBlob(buffer, filename || 'graph-data.xlsx',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    };

    /**
     * Helper to download blob as file
     * @param {Buffer|Blob} data - Data to download
     * @param {String} filename - Filename
     * @param {String} mimeType - MIME type
     */
    const downloadBlob = function(data, filename, mimeType) {
        const blob = data instanceof Blob ? data : new Blob([data], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    // Expose to global namespace
    window.GraphApp.core.importExcel = importExcel;
    window.GraphApp.core.exportExcel = exportExcel;

})(window);
