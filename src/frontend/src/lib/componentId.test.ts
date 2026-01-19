/**
 * Tests for Component ID Parser
 * Property 4: Component ID Hierarchy Preservation
 * Property 5: Component ID Index Detection
 * Validates: Requirements 4.1, 4.3
 */

import { describe, it, expect } from "bun:test";
import fc from "fast-check";
import {
  parseComponentId,
  formatComponentIdTree,
  formatComponentIdHierarchy,
  isComponentId,
} from "./componentId";

describe("Component ID Parser", () => {
  describe("parseComponentId", () => {
    it("should parse simple component IDs", () => {
      const result = parseComponentId("j_id_3x");
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: "j_id_3x",
        type: "component",
        depth: 0,
      });
    });

    it("should parse nested component IDs", () => {
      const result = parseComponentId("j_id_3x:j_id_40:j_id_42");
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        id: "j_id_3x",
        type: "component",
        depth: 0,
      });
      expect(result[1]).toEqual({
        id: "j_id_40",
        type: "component",
        depth: 1,
      });
      expect(result[2]).toEqual({
        id: "j_id_42",
        type: "component",
        depth: 2,
      });
    });

    it("should identify numeric indices", () => {
      const result = parseComponentId("j_id_3x:j_id_40:0:j_id_42");
      expect(result).toHaveLength(4);
      expect(result[2]).toEqual({
        id: "0",
        type: "index",
        depth: 2,
      });
    });

    it("should handle complex hierarchies with mixed components and indices", () => {
      const result = parseComponentId("j_id_3x:j_id_40:0:j_id_42:0:j_id_45");
      expect(result).toHaveLength(6);
      expect(result[0].type).toBe("component");
      expect(result[1].type).toBe("component");
      expect(result[2].type).toBe("index");
      expect(result[3].type).toBe("component");
      expect(result[4].type).toBe("index");
      expect(result[5].type).toBe("component");
    });

    it("should handle multi-digit indices", () => {
      const result = parseComponentId("j_id_3x:123:j_id_40");
      expect(result).toHaveLength(3);
      expect(result[1]).toEqual({
        id: "123",
        type: "index",
        depth: 1,
      });
    });

    it("should handle empty strings", () => {
      expect(parseComponentId("")).toEqual([]);
      expect(parseComponentId(null as any)).toEqual([]);
      expect(parseComponentId(undefined as any)).toEqual([]);
    });

    it("should handle single colon", () => {
      const result = parseComponentId(":");
      expect(result).toHaveLength(2);
      expect(result[0].type).toBe("unknown");
      expect(result[1].type).toBe("unknown");
    });

    it("should set correct depth values", () => {
      const result = parseComponentId("a:b:c:d");
      result.forEach((level, index) => {
        expect(level.depth).toBe(index);
      });
    });
  });

  describe("formatComponentIdTree", () => {
    it("should reconstruct simple component IDs", () => {
      const levels = parseComponentId("j_id_3x");
      const result = formatComponentIdTree(levels);
      expect(result).toBe("j_id_3x");
    });

    it("should reconstruct nested component IDs", () => {
      const levels = parseComponentId("j_id_3x:j_id_40:j_id_42");
      const result = formatComponentIdTree(levels);
      expect(result).toBe("j_id_3x:j_id_40:j_id_42");
    });

    it("should reconstruct complex hierarchies", () => {
      const original = "j_id_3x:j_id_40:0:j_id_42:0:j_id_45";
      const levels = parseComponentId(original);
      const result = formatComponentIdTree(levels);
      expect(result).toBe(original);
    });

    it("should handle empty levels array", () => {
      expect(formatComponentIdTree([])).toBe("");
      expect(formatComponentIdTree(null as any)).toBe("");
    });
  });

  describe("formatComponentIdHierarchy", () => {
    it("should format simple component IDs", () => {
      const levels = parseComponentId("j_id_3x");
      const result = formatComponentIdHierarchy(levels);
      expect(result).toBe("j_id_3x");
    });

    it("should format nested component IDs with indentation", () => {
      const levels = parseComponentId("j_id_3x:j_id_40:j_id_42");
      const result = formatComponentIdHierarchy(levels);
      expect(result).toContain("j_id_3x");
      expect(result).toContain("└─ j_id_40");
      expect(result).toContain("└─ j_id_42");
    });

    it("should label numeric indices correctly", () => {
      const levels = parseComponentId("j_id_3x:0:j_id_40");
      const result = formatComponentIdHierarchy(levels);
      expect(result).toContain("[0] (iteration index)");
    });

    it("should handle empty levels array", () => {
      expect(formatComponentIdHierarchy([])).toBe("");
      expect(formatComponentIdHierarchy(null as any)).toBe("");
    });
  });

  describe("isComponentId", () => {
    it("should detect j_id_ pattern", () => {
      expect(isComponentId("j_id_3x")).toBe(true);
      expect(isComponentId("j_id_40:j_id_42")).toBe(true);
    });

    it("should detect colon-separated numeric patterns", () => {
      expect(isComponentId("component:0:nested")).toBe(true);
      expect(isComponentId("a:123:b")).toBe(true);
    });

    it("should return false for non-component IDs", () => {
      expect(isComponentId("simple_param")).toBe(false);
      expect(isComponentId("javax.faces.source")).toBe(false);
    });

    it("should handle empty strings", () => {
      expect(isComponentId("")).toBe(false);
      expect(isComponentId(null as any)).toBe(false);
    });
  });

  describe("Property 4: Component ID Hierarchy Preservation", () => {
    it("should satisfy round-trip property: parse then format preserves original", () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.oneof(
              fc.stringMatching(/^j_id_[a-z0-9]+$/),
              fc.integer({ min: 0, max: 999 }).map(String)
            ),
            { minLength: 1, maxLength: 10 }
          ),
          (parts) => {
            const original = parts.join(":");
            const levels = parseComponentId(original);
            const reconstructed = formatComponentIdTree(levels);

            return reconstructed === original;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe("Property 5: Component ID Index Detection", () => {
    it("should correctly identify numeric indices in component IDs", () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.oneof(
              fc.stringMatching(/^j_id_[a-z0-9]+$/),
              fc.integer({ min: 0, max: 999 }).map(String)
            ),
            { minLength: 1, maxLength: 10 }
          ),
          (parts) => {
            const id = parts.join(":");
            const levels = parseComponentId(id);

            // For each part, verify the type matches
            return levels.every((level, index) => {
              const part = parts[index];
              const isNumeric = /^\d+$/.test(part);

              if (isNumeric) {
                return level.type === "index";
              } else {
                return level.type === "component";
              }
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
