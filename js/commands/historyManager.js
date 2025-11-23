/**
 * History Manager - Undo/Redo System
 * Implements command pattern for reversible operations
 */

(function(window) {
    'use strict';

    /**
     * Command base class
     * All commands must implement execute() and undo()
     */
    class Command {
        execute() {
            throw new Error('execute() must be implemented');
        }

        undo() {
            throw new Error('undo() must be implemented');
        }
    }

    /**
     * Edit Node Command - For cell edits in the table
     */
    class EditNodeCommand extends Command {
        constructor(nodeIndex, field, oldValue, newValue, nodesGetter, nodesSetter, onExecute) {
            super();
            this.nodeIndex = nodeIndex;
            this.field = field;
            this.oldValue = oldValue;
            this.newValue = newValue;
            this.nodesGetter = nodesGetter;
            this.nodesSetter = nodesSetter;
            this.onExecute = onExecute; // Callback for validation, etc.
        }

        execute() {
            const nodes = this.nodesGetter();
            const newNodes = [...nodes];
            newNodes[this.nodeIndex][this.field] = this.newValue;
            this.nodesSetter(newNodes);
            if (this.onExecute) this.onExecute(newNodes);
        }

        undo() {
            const nodes = this.nodesGetter();
            const newNodes = [...nodes];
            newNodes[this.nodeIndex][this.field] = this.oldValue;
            this.nodesSetter(newNodes);
            if (this.onExecute) this.onExecute(newNodes);
        }
    }

    /**
     * Add Node Command
     */
    class AddNodeCommand extends Command {
        constructor(node, nodesGetter, nodesSetter, onExecute) {
            super();
            this.node = node;
            this.nodesGetter = nodesGetter;
            this.nodesSetter = nodesSetter;
            this.onExecute = onExecute;
        }

        execute() {
            const nodes = this.nodesGetter();
            const newNodes = [...nodes, this.node];
            this.nodesSetter(newNodes);
            if (this.onExecute) this.onExecute(newNodes);
        }

        undo() {
            const nodes = this.nodesGetter();
            const newNodes = nodes.slice(0, -1); // Remove last node
            this.nodesSetter(newNodes);
            if (this.onExecute) this.onExecute(newNodes);
        }
    }

    /**
     * Delete Node Command
     */
    class DeleteNodeCommand extends Command {
        constructor(nodeIndex, deletedNode, nodesGetter, nodesSetter, onExecute) {
            super();
            this.nodeIndex = nodeIndex;
            this.deletedNode = deletedNode;
            this.nodesGetter = nodesGetter;
            this.nodesSetter = nodesSetter;
            this.onExecute = onExecute;
        }

        execute() {
            const nodes = this.nodesGetter();
            const newNodes = nodes.filter((_, i) => i !== this.nodeIndex);
            this.nodesSetter(newNodes);
            if (this.onExecute) this.onExecute(newNodes);
        }

        undo() {
            const nodes = this.nodesGetter();
            const newNodes = [...nodes];
            newNodes.splice(this.nodeIndex, 0, this.deletedNode);
            this.nodesSetter(newNodes);
            if (this.onExecute) this.onExecute(newNodes);
        }
    }

    /**
     * Batch Command - Execute multiple commands as one unit
     */
    class BatchCommand extends Command {
        constructor(commands) {
            super();
            this.commands = commands;
        }

        execute() {
            this.commands.forEach(cmd => cmd.execute());
        }

        undo() {
            // Undo in reverse order
            for (let i = this.commands.length - 1; i >= 0; i--) {
                this.commands[i].undo();
            }
        }
    }

    /**
     * History Manager - Manages undo/redo stack
     */
    class HistoryManager {
        constructor(maxHistory = 50) {
            this.history = [];
            this.currentIndex = -1;
            this.maxHistory = maxHistory;
        }

        execute(command) {
            // Execute the command
            command.execute();

            // Remove any redo history
            this.history = this.history.slice(0, this.currentIndex + 1);

            // Add to history
            this.history.push(command);

            // Limit history size
            if (this.history.length > this.maxHistory) {
                this.history.shift();
            } else {
                this.currentIndex++;
            }
        }

        canUndo() {
            return this.currentIndex >= 0;
        }

        canRedo() {
            return this.currentIndex < this.history.length - 1;
        }

        undo() {
            if (!this.canUndo()) return false;

            this.history[this.currentIndex].undo();
            this.currentIndex--;
            return true;
        }

        redo() {
            if (!this.canRedo()) return false;

            this.currentIndex++;
            this.history[this.currentIndex].execute();
            return true;
        }

        clear() {
            this.history = [];
            this.currentIndex = -1;
        }

        getHistorySize() {
            return this.history.length;
        }

        getCurrentIndex() {
            return this.currentIndex;
        }
    }

    // Export to global namespace
    window.GraphApp = window.GraphApp || {};
    window.GraphApp.commands = {
        Command,
        EditNodeCommand,
        AddNodeCommand,
        DeleteNodeCommand,
        BatchCommand,
        HistoryManager
    };

})(window);
