/**
 * Component ID Parser
 * Parses JSF component IDs and displays hierarchy
 * Requirements: 4.1, 4.3
 */

import type { ComponentIdLevel } from "../types";

/**
 * Parses a JSF component ID into hierarchy levels
 * Splits by colon separators and identifies numeric indices vs component IDs
 * 
 * Example: "j_id_3x:j_id_40:0:j_id_42:0:j_id_45" becomes:
 * [
 *   { id: "j_id_3x", type: "component", depth: 0 },
 *   { id: "j_id_40", type: "component", depth: 1 },
 *   { id: "0", type: "index", depth: 2 },
 *   { id: "j_id_42", type: "component", depth: 3 },
 *   { id: "0", type: "index", depth: 4 },
 *   { id: "j_id_45", type: "component", depth: 5 }
 * ]
 * 
 * @param id - The component ID string to parse
 * @returns Array of ComponentIdLevel objects representing the hierarchy
 */
export function parseComponentId(id: string): ComponentIdLevel[] {
  if (!id || typeof id !== "string") {
    return [];
  }

  // Split by colon separator
  const parts = id.split(":");

  return parts.map((part, index) => {
    // Check if this part is a numeric index
    const isNumeric = /^\d+$/.test(part);

    return {
      id: part,
      type: isNumeric ? "index" : part ? "component" : "unknown",
      depth: index,
    };
  });
}

/**
 * Formats component ID hierarchy levels back into a tree string representation
 * Joins levels with colons to reconstruct the original ID
 * 
 * @param levels - Array of ComponentIdLevel objects
 * @returns The formatted component ID string
 */
export function formatComponentIdTree(levels: ComponentIdLevel[]): string {
  if (!levels || levels.length === 0) {
    return "";
  }

  return levels.map((level) => level.id).join(":");
}

/**
 * Formats component ID hierarchy for display with indentation
 * Shows the tree structure with visual hierarchy
 * 
 * Example output:
 * j_id_3x
 *   └─ j_id_40
 *       └─ [0] (iteration index)
 *           └─ j_id_42
 * 
 * @param levels - Array of ComponentIdLevel objects
 * @returns Formatted string with indentation and tree structure
 */
export function formatComponentIdHierarchy(levels: ComponentIdLevel[]): string {
  if (!levels || levels.length === 0) {
    return "";
  }

  return levels
    .map((level) => {
      const indent = "  ".repeat(level.depth);
      const prefix = level.depth > 0 ? "└─ " : "";
      const label =
        level.type === "index" ? `[${level.id}] (iteration index)` : level.id;

      return `${indent}${prefix}${label}`;
    })
    .join("\n");
}

/**
 * Checks if a string appears to be a JSF component ID
 * Component IDs typically contain j_id_ pattern or numeric indices
 * 
 * @param value - The string to check
 * @returns true if the string appears to be a component ID
 */
export function isComponentId(value: string): boolean {
  if (!value || typeof value !== "string") {
    return false;
  }

  // Check for j_id_ pattern or colon-separated numeric/component patterns
  return /j_id_/.test(value) || /:\d+:/.test(value) || /^j_id_/.test(value);
}
