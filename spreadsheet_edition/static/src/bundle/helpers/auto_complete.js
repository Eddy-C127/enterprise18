/** @odoo-module */

import { tokenColors } from "@odoo/o-spreadsheet";
/**
 * Create a proposal entry for the compose autocomplete
 * to insert a field name string in a formula.
 */
export function makeFieldProposal(field) {
    const quotedFieldName = `"${field.name}"`;
    return {
        text: quotedFieldName,
        description: field.string + (field.help ? ` (${field.help})` : ""),
        htmlContent: [{ value: quotedFieldName, color: tokenColors.STRING }],
        fuzzySearchKey: field.string + quotedFieldName, // search on translated name and on technical name
    };
}

/**
 * Perform the autocomplete of the composer by inserting the value
 * at the cursor position, replacing the current token if necessary.
 * Must be bound to the autocomplete provider.
 * @param {EnrichedToken} tokenAtCursor
 * @param {string} value
 */
export function insertTokenAfterArgSeparator(tokenAtCursor, value) {
    let start = tokenAtCursor.end;
    const end = tokenAtCursor.end;
    if (tokenAtCursor.type !== "ARG_SEPARATOR") {
        // replace the whole token
        start = tokenAtCursor.start;
    }
    this.composer.changeComposerCursorSelection(start, end);
    this.composer.replaceComposerCursorSelection(value);
}

/**
 * Perform the autocomplete of the composer by inserting the value
 * at the cursor position, replacing the current token if necessary.
 * Must be bound to the autocomplete provider.
 * @param {EnrichedToken} tokenAtCursor
 * @param {string} value
 */
export function insertTokenAfterLeftParenthesis(tokenAtCursor, value) {
    let start = tokenAtCursor.end;
    const end = tokenAtCursor.end;
    if (tokenAtCursor.type !== "LEFT_PAREN") {
        // replace the whole token
        start = tokenAtCursor.start;
    }
    this.composer.changeComposerCursorSelection(start, end);
    this.composer.replaceComposerCursorSelection(value);
}
