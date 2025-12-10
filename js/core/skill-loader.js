/**
 * Skill Loader Module
 * Manages loading default and custom AI system prompts
 *
 * Usage:
 * - Default skill loaded from js/skills/default-skill.md
 * - Custom skills stored in localStorage
 * - To update default: edit default-skill.md only (no code changes needed)
 */

(function(window) {
    'use strict';

    const STORAGE_KEY = 'custom_ai_skill';
    const DEFAULT_SKILL_PATH = 'js/skills/default-skill.md';

    let defaultSkillCache = null;

    /**
     * Load the default skill from file (cached after first load)
     * @returns {Promise<string>} Default skill content
     */
    async function loadDefaultSkill() {
        if (defaultSkillCache) {
            return defaultSkillCache;
        }

        try {
            const response = await fetch(DEFAULT_SKILL_PATH);
            if (!response.ok) {
                throw new Error('Failed to load default skill: ' + response.status);
            }
            defaultSkillCache = await response.text();
            return defaultSkillCache;
        } catch (error) {
            console.error('Error loading default skill:', error);
            // Fallback prompt if file can't be loaded
            return 'You are a helpful graph diagram assistant.\n\nCURRENT GRAPH:\n{CONTEXT}\n\nHelp the user create and modify their diagram.';
        }
    }

    /**
     * Get the current skill (custom from localStorage, or default)
     * @returns {Promise<{content: string, isCustom: boolean, name: string}>}
     */
    async function getCurrentSkill() {
        try {
            const customSkill = localStorage.getItem(STORAGE_KEY);
            if (customSkill) {
                const parsed = JSON.parse(customSkill);
                return {
                    content: parsed.content,
                    isCustom: true,
                    name: parsed.name || 'Custom Skill'
                };
            }
        } catch (e) {
            console.warn('Error reading custom skill from localStorage:', e);
        }

        const defaultContent = await loadDefaultSkill();
        return {
            content: defaultContent,
            isCustom: false,
            name: 'Default'
        };
    }

    /**
     * Save a custom skill to localStorage
     * @param {string} content - Skill content (must include {CONTEXT})
     * @param {string} name - Skill filename for display
     * @returns {boolean} Success status
     */
    function saveCustomSkill(content, name) {
        const validation = validateSkill(content);
        if (!validation.valid) {
            throw new Error(validation.errors.join(', '));
        }

        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                content: content,
                name: name,
                savedAt: new Date().toISOString()
            }));
            return true;
        } catch (e) {
            console.error('Error saving custom skill:', e);
            return false;
        }
    }

    /**
     * Clear custom skill (revert to default)
     * @returns {boolean} Success status
     */
    function clearCustomSkill() {
        try {
            localStorage.removeItem(STORAGE_KEY);
            return true;
        } catch (e) {
            console.error('Error clearing custom skill:', e);
            return false;
        }
    }

    /**
     * Validate skill content
     * @param {string} content - Skill content to validate
     * @returns {{valid: boolean, errors: string[]}}
     */
    function validateSkill(content) {
        const errors = [];

        if (!content || typeof content !== 'string') {
            errors.push('Skill content is empty or invalid');
        } else {
            if (!content.includes('{CONTEXT}')) {
                errors.push('Missing required {CONTEXT} placeholder');
            }
            if (content.length < 50) {
                errors.push('Skill content seems too short (< 50 characters)');
            }
            if (content.length > 50000) {
                errors.push('Skill content too large (> 50KB)');
            }
        }

        return {
            valid: errors.length === 0,
            errors: errors
        };
    }

    // Export to namespace
    window.GraphApp = window.GraphApp || {};
    window.GraphApp.core = window.GraphApp.core || {};
    window.GraphApp.core.skillLoader = {
        loadDefaultSkill,
        getCurrentSkill,
        saveCustomSkill,
        clearCustomSkill,
        validateSkill,
        STORAGE_KEY
    };

})(window);
