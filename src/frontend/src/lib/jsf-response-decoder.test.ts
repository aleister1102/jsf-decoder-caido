/**
 * Tests for JSF Response Decoder
 * Tests detection and parsing of JSF partial response XML
 * 
 * Feature: jsf-response-decoder
 */

import { describe, it, expect } from "bun:test";
import fc from "fast-check";

// ============================================================================
// Inline implementations for testing
// These functions are duplicated from workflows/jsf-response-decoder/javascript.ts
// since workflows don't have module resolution for testing
// ============================================================================

interface DetectionResult {
  isJsfResponse: boolean;
  confidence: "high" | "medium" | "low";
  partialResponseId: string | null;
}

interface ChangeElement {
  type: "update" | "insert" | "delete" | "eval" | "redirect" | "error" | "extension";
  id: string | null;
  content: string;
  position?: "before" | "after";
  attributes: Record<string, string>;
}

interface ParsedPartialResponse {
  id: string;
  changes: ChangeElement[];
  parseErrors: string[];
}

interface CategorizedChange extends ChangeElement {
  annotation: string;
  category: ChangeCategory;
}

type ChangeCategory = "dom-modification" | "script-execution" | "navigation" | "error" | "custom";

interface ExtractedContent {
  raw: string;
  contentType: "html" | "javascript" | "text" | "viewstate";
  formatted: string;
}

function detectJsfResponse(responseBody: string, contentType?: string): DetectionResult {
  const result: DetectionResult = {
    isJsfResponse: false,
    confidence: "low",
    partialResponseId: null,
  };

  if (!responseBody || typeof responseBody !== "string") {
    return result;
  }

  const partialResponseRegex = /<partial-response\b/i;
  
  if (!partialResponseRegex.test(responseBody)) {
    return result;
  }

  result.isJsfResponse = true;

  const isXmlContentType = contentType && 
    (contentType.includes("text/xml") || contentType.includes("application/xml"));
  
  const hasClosingTag = /<\/partial-response\s*>/i.test(responseBody);
  const hasChangesElement = /<changes\b/i.test(responseBody);

  if (isXmlContentType && hasClosingTag && hasChangesElement) {
    result.confidence = "high";
  } else if (hasClosingTag || hasChangesElement) {
    result.confidence = "medium";
  } else {
    result.confidence = "low";
  }

  const idMatch = responseBody.match(/<partial-response[^>]*\bid\s*=\s*["']([^"']*)["']/i);
  if (idMatch) {
    result.partialResponseId = idMatch[1];
  }

  return result;
}

const CHANGE_ELEMENT_TYPES = new Set([
  "update", "insert", "delete", "eval", "redirect", "error", "extension",
]);

function extractCdataOrText(content: string): string {
  if (!content) {
    return "";
  }
  const cdataMatch = content.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
  if (cdataMatch) {
    return cdataMatch[1];
  }
  return content.trim();
}

function parsePartialResponse(xml: string): ParsedPartialResponse {
  const result: ParsedPartialResponse = {
    id: "",
    changes: [],
    parseErrors: [],
  };

  if (!xml || typeof xml !== "string") {
    result.parseErrors.push("Empty or invalid XML input");
    return result;
  }

  const partialResponseMatch = xml.match(/<partial-response[^>]*>/i);
  if (!partialResponseMatch) {
    result.parseErrors.push("No <partial-response> element found");
    return result;
  }

  const idMatch = partialResponseMatch[0].match(/\bid\s*=\s*["']([^"']*)["']/i);
  if (idMatch) {
    result.id = idMatch[1];
  }

  const changesMatch = xml.match(/<changes\b[^>]*>([\s\S]*?)<\/changes>/i);
  if (!changesMatch) {
    return result;
  }

  const changesContent = changesMatch[1];

  for (const elementType of CHANGE_ELEMENT_TYPES) {
    const elementRegex = new RegExp(
      `<${elementType}\\b([^>]*)>([\\s\\S]*?)<\\/${elementType}>`,
      "gi"
    );

    let match;
    while ((match = elementRegex.exec(changesContent)) !== null) {
      const attributesStr = match[1];
      const content = match[2];

      const change: ChangeElement = {
        type: elementType as ChangeElement["type"],
        id: null,
        content: extractCdataOrText(content),
        attributes: {},
      };

      const elemIdMatch = attributesStr.match(/\bid\s*=\s*["']([^"']*)["']/i);
      if (elemIdMatch) {
        change.id = elemIdMatch[1];
      }

      if (elementType === "insert") {
        const beforeMatch = attributesStr.match(/\bbefore\s*=\s*["']([^"']*)["']/i);
        const afterMatch = attributesStr.match(/\bafter\s*=\s*["']([^"']*)["']/i);
        if (beforeMatch) {
          change.position = "before";
          change.attributes["before"] = beforeMatch[1];
        } else if (afterMatch) {
          change.position = "after";
          change.attributes["after"] = afterMatch[1];
        }
      }

      const attrRegex = /\b(\w+)\s*=\s*["']([^"']*)["']/gi;
      let attrMatch;
      while ((attrMatch = attrRegex.exec(attributesStr)) !== null) {
        const attrName = attrMatch[1].toLowerCase();
        if (attrName !== "id") {
          change.attributes[attrName] = attrMatch[2];
        }
      }

      result.changes.push(change);
    }
  }

  const openTags = (xml.match(/<partial-response\b/gi) || []).length;
  const closeTags = (xml.match(/<\/partial-response>/gi) || []).length;
  if (openTags !== closeTags) {
    result.parseErrors.push(`Mismatched partial-response tags: ${openTags} open, ${closeTags} close`);
  }

  return result;
}

// ============================================================================
// Change Element Categorizer
// Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7
// ============================================================================

const CHANGE_ANNOTATIONS: Record<ChangeElement["type"], string> = {
  update: "Replaces content of DOM element with specified ID",
  insert: "Inserts new content before or after specified element",
  delete: "Removes DOM element with specified ID",
  eval: "Executes JavaScript code on the client",
  redirect: "Redirects browser to specified URL",
  error: "Server-side error occurred during processing",
  extension: "Custom extension data from JSF implementation",
};

const CHANGE_CATEGORIES: Record<ChangeElement["type"], ChangeCategory> = {
  update: "dom-modification",
  insert: "dom-modification",
  delete: "dom-modification",
  eval: "script-execution",
  redirect: "navigation",
  error: "error",
  extension: "custom",
};

function categorizeChangeElement(change: ChangeElement): CategorizedChange {
  return {
    ...change,
    annotation: CHANGE_ANNOTATIONS[change.type] ?? "Unknown change type",
    category: CHANGE_CATEGORIES[change.type] ?? "custom",
  };
}

function categorizeChanges(changes: ChangeElement[]): CategorizedChange[] {
  return changes.map(categorizeChangeElement);
}

function getChangeAnnotation(type: ChangeElement["type"]): string {
  return CHANGE_ANNOTATIONS[type] ?? "Unknown change type";
}

function getChangeCategory(type: ChangeElement["type"]): ChangeCategory {
  return CHANGE_CATEGORIES[type] ?? "custom";
}

// ============================================================================
// CDATA Content Extractor
// Requirements: 4.1, 4.2, 4.3, 4.4
// ============================================================================

function detectContentType(content: string, elementId?: string | null): ExtractedContent["contentType"] {
  if (!content || content.trim() === "") {
    return "text";
  }

  // Check for ViewState by element ID pattern
  if (elementId && /viewstate/i.test(elementId)) {
    return "viewstate";
  }

  // Check for JavaScript patterns
  const jsPatterns = [
    /^\s*(?:var|let|const|function|if|for|while|return|try|catch)\b/,
    /PrimeFaces\./,
    /\bwindow\./,
    /\bdocument\./,
    /\$\(/,
    /;\s*$/m,
    /\bfunction\s*\(/,
  ];
  
  for (const pattern of jsPatterns) {
    if (pattern.test(content)) {
      return "javascript";
    }
  }

  // Check for HTML patterns
  const htmlPatterns = [
    /<[a-z][a-z0-9]*\b[^>]*>/i,
    /<\/[a-z][a-z0-9]*>/i,
    /<!DOCTYPE/i,
    /<html/i,
  ];
  
  for (const pattern of htmlPatterns) {
    if (pattern.test(content)) {
      return "html";
    }
  }

  return "text";
}

function extractCdataContent(change: ChangeElement): ExtractedContent {
  const raw = change.content;
  const contentType = detectContentType(raw, change.id);
  
  return {
    raw,
    contentType,
    formatted: raw,
  };
}

// ============================================================================
// Unit Tests
// ============================================================================

describe("JSF Response Detector", () => {
  describe("detectJsfResponse", () => {
    it("should detect JSF partial response with partial-response tag", () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<partial-response id="j_id1">
  <changes>
    <update id="form:output"><![CDATA[<span>Hello</span>]]></update>
  </changes>
</partial-response>`;
      
      const result = detectJsfResponse(xml, "text/xml");
      expect(result.isJsfResponse).toBe(true);
      expect(result.confidence).toBe("high");
      expect(result.partialResponseId).toBe("j_id1");
    });

    it("should not detect non-JSF XML", () => {
      const xml = `<?xml version="1.0"?><root><item>test</item></root>`;
      const result = detectJsfResponse(xml, "text/xml");
      expect(result.isJsfResponse).toBe(false);
    });

    it("should handle empty input", () => {
      expect(detectJsfResponse("").isJsfResponse).toBe(false);
      expect(detectJsfResponse(null as any).isJsfResponse).toBe(false);
      expect(detectJsfResponse(undefined as any).isJsfResponse).toBe(false);
    });

    it("should detect partial-response without content type", () => {
      const xml = `<partial-response><changes></changes></partial-response>`;
      const result = detectJsfResponse(xml);
      expect(result.isJsfResponse).toBe(true);
      expect(result.confidence).toBe("medium");
    });

    it("should return low confidence for partial-response without closing tag", () => {
      const xml = `<partial-response id="test">`;
      const result = detectJsfResponse(xml);
      expect(result.isJsfResponse).toBe(true);
      expect(result.confidence).toBe("low");
    });

    it("should extract id attribute from partial-response", () => {
      const xml = `<partial-response id="my-response-id"></partial-response>`;
      const result = detectJsfResponse(xml);
      expect(result.partialResponseId).toBe("my-response-id");
    });

    it("should handle case-insensitive tag matching", () => {
      const xml = `<PARTIAL-RESPONSE id="test"><changes></changes></PARTIAL-RESPONSE>`;
      const result = detectJsfResponse(xml);
      expect(result.isJsfResponse).toBe(true);
    });
  });
});

describe("XML Parser", () => {
  describe("parsePartialResponse", () => {
    it("should parse partial-response with id", () => {
      const xml = `<partial-response id="j_id1"><changes></changes></partial-response>`;
      const result = parsePartialResponse(xml);
      expect(result.id).toBe("j_id1");
      expect(result.parseErrors).toHaveLength(0);
    });

    it("should extract update elements", () => {
      const xml = `<partial-response>
        <changes>
          <update id="form:output"><![CDATA[<span>Hello</span>]]></update>
        </changes>
      </partial-response>`;
      
      const result = parsePartialResponse(xml);
      expect(result.changes).toHaveLength(1);
      expect(result.changes[0].type).toBe("update");
      expect(result.changes[0].id).toBe("form:output");
      expect(result.changes[0].content).toBe("<span>Hello</span>");
    });

    it("should extract multiple change types", () => {
      const xml = `<partial-response>
        <changes>
          <update id="u1"><![CDATA[update content]]></update>
          <insert id="i1" after="target"><![CDATA[insert content]]></insert>
          <delete id="d1"></delete>
          <eval><![CDATA[alert('test');]]></eval>
        </changes>
      </partial-response>`;
      
      const result = parsePartialResponse(xml);
      expect(result.changes).toHaveLength(4);
      
      const types = result.changes.map(c => c.type);
      expect(types).toContain("update");
      expect(types).toContain("insert");
      expect(types).toContain("delete");
      expect(types).toContain("eval");
    });

    it("should extract insert position attributes", () => {
      const xml = `<partial-response>
        <changes>
          <insert id="i1" after="target1"><![CDATA[after content]]></insert>
          <insert id="i2" before="target2"><![CDATA[before content]]></insert>
        </changes>
      </partial-response>`;
      
      const result = parsePartialResponse(xml);
      expect(result.changes).toHaveLength(2);
      
      const afterInsert = result.changes.find(c => c.id === "i1");
      expect(afterInsert?.position).toBe("after");
      expect(afterInsert?.attributes["after"]).toBe("target1");
      
      const beforeInsert = result.changes.find(c => c.id === "i2");
      expect(beforeInsert?.position).toBe("before");
      expect(beforeInsert?.attributes["before"]).toBe("target2");
    });

    it("should handle empty input", () => {
      const result = parsePartialResponse("");
      expect(result.parseErrors).toContain("Empty or invalid XML input");
    });

    it("should handle missing partial-response element", () => {
      const result = parsePartialResponse("<root></root>");
      expect(result.parseErrors).toContain("No <partial-response> element found");
    });

    it("should handle missing changes element", () => {
      const xml = `<partial-response id="test"></partial-response>`;
      const result = parsePartialResponse(xml);
      expect(result.id).toBe("test");
      expect(result.changes).toHaveLength(0);
      expect(result.parseErrors).toHaveLength(0);
    });

    it("should report mismatched tags", () => {
      const xml = `<partial-response><changes></changes>`;
      const result = parsePartialResponse(xml);
      expect(result.parseErrors.some(e => e.includes("Mismatched"))).toBe(true);
    });
  });

  describe("extractCdataOrText", () => {
    it("should extract CDATA content", () => {
      const content = "<![CDATA[Hello World]]>";
      expect(extractCdataOrText(content)).toBe("Hello World");
    });

    it("should return trimmed text when no CDATA", () => {
      const content = "  plain text  ";
      expect(extractCdataOrText(content)).toBe("plain text");
    });

    it("should handle empty input", () => {
      expect(extractCdataOrText("")).toBe("");
      expect(extractCdataOrText(null as any)).toBe("");
    });

    it("should preserve content inside CDATA", () => {
      const content = "<![CDATA[<script>alert('test');</script>]]>";
      expect(extractCdataOrText(content)).toBe("<script>alert('test');</script>");
    });
  });
});

// ============================================================================
// Change Element Categorizer Tests
// ============================================================================

describe("Change Element Categorizer", () => {
  describe("categorizeChangeElement", () => {
    it("should categorize update element as dom-modification", () => {
      const change: ChangeElement = {
        type: "update",
        id: "form:output",
        content: "<span>Hello</span>",
        attributes: {},
      };
      const result = categorizeChangeElement(change);
      expect(result.category).toBe("dom-modification");
      expect(result.annotation).toBe("Replaces content of DOM element with specified ID");
    });

    it("should categorize insert element as dom-modification", () => {
      const change: ChangeElement = {
        type: "insert",
        id: "form:item",
        content: "<div>New item</div>",
        position: "after",
        attributes: { after: "target" },
      };
      const result = categorizeChangeElement(change);
      expect(result.category).toBe("dom-modification");
      expect(result.annotation).toBe("Inserts new content before or after specified element");
    });

    it("should categorize delete element as dom-modification", () => {
      const change: ChangeElement = {
        type: "delete",
        id: "form:item",
        content: "",
        attributes: {},
      };
      const result = categorizeChangeElement(change);
      expect(result.category).toBe("dom-modification");
      expect(result.annotation).toBe("Removes DOM element with specified ID");
    });

    it("should categorize eval element as script-execution", () => {
      const change: ChangeElement = {
        type: "eval",
        id: null,
        content: "alert('test');",
        attributes: {},
      };
      const result = categorizeChangeElement(change);
      expect(result.category).toBe("script-execution");
      expect(result.annotation).toBe("Executes JavaScript code on the client");
    });

    it("should categorize redirect element as navigation", () => {
      const change: ChangeElement = {
        type: "redirect",
        id: null,
        content: "/new-page",
        attributes: { url: "/new-page" },
      };
      const result = categorizeChangeElement(change);
      expect(result.category).toBe("navigation");
      expect(result.annotation).toBe("Redirects browser to specified URL");
    });

    it("should categorize error element as error", () => {
      const change: ChangeElement = {
        type: "error",
        id: null,
        content: "Server error occurred",
        attributes: {},
      };
      const result = categorizeChangeElement(change);
      expect(result.category).toBe("error");
      expect(result.annotation).toBe("Server-side error occurred during processing");
    });

    it("should categorize extension element as custom", () => {
      const change: ChangeElement = {
        type: "extension",
        id: null,
        content: "custom data",
        attributes: {},
      };
      const result = categorizeChangeElement(change);
      expect(result.category).toBe("custom");
      expect(result.annotation).toBe("Custom extension data from JSF implementation");
    });
  });

  describe("categorizeChanges", () => {
    it("should categorize all changes in array", () => {
      const changes: ChangeElement[] = [
        { type: "update", id: "u1", content: "content", attributes: {} },
        { type: "eval", id: null, content: "script", attributes: {} },
        { type: "redirect", id: null, content: "/url", attributes: {} },
      ];
      const result = categorizeChanges(changes);
      expect(result).toHaveLength(3);
      expect(result[0].category).toBe("dom-modification");
      expect(result[1].category).toBe("script-execution");
      expect(result[2].category).toBe("navigation");
    });

    it("should preserve original change properties", () => {
      const changes: ChangeElement[] = [
        { type: "insert", id: "i1", content: "content", position: "before", attributes: { before: "target" } },
      ];
      const result = categorizeChanges(changes);
      expect(result[0].id).toBe("i1");
      expect(result[0].content).toBe("content");
      expect(result[0].position).toBe("before");
      expect(result[0].attributes["before"]).toBe("target");
    });
  });

  describe("getChangeAnnotation", () => {
    it("should return correct annotation for each type", () => {
      expect(getChangeAnnotation("update")).toBe("Replaces content of DOM element with specified ID");
      expect(getChangeAnnotation("insert")).toBe("Inserts new content before or after specified element");
      expect(getChangeAnnotation("delete")).toBe("Removes DOM element with specified ID");
      expect(getChangeAnnotation("eval")).toBe("Executes JavaScript code on the client");
      expect(getChangeAnnotation("redirect")).toBe("Redirects browser to specified URL");
      expect(getChangeAnnotation("error")).toBe("Server-side error occurred during processing");
      expect(getChangeAnnotation("extension")).toBe("Custom extension data from JSF implementation");
    });
  });

  describe("getChangeCategory", () => {
    it("should return correct category for each type", () => {
      expect(getChangeCategory("update")).toBe("dom-modification");
      expect(getChangeCategory("insert")).toBe("dom-modification");
      expect(getChangeCategory("delete")).toBe("dom-modification");
      expect(getChangeCategory("eval")).toBe("script-execution");
      expect(getChangeCategory("redirect")).toBe("navigation");
      expect(getChangeCategory("error")).toBe("error");
      expect(getChangeCategory("extension")).toBe("custom");
    });
  });
});

// ============================================================================
// CDATA Content Extractor Tests
// ============================================================================

describe("CDATA Content Extractor", () => {
  describe("detectContentType", () => {
    it("should detect HTML content", () => {
      expect(detectContentType("<div>Hello</div>")).toBe("html");
      expect(detectContentType("<span class='test'>Text</span>")).toBe("html");
      expect(detectContentType("<!DOCTYPE html>")).toBe("html");
    });

    it("should detect JavaScript content", () => {
      expect(detectContentType("var x = 1;")).toBe("javascript");
      expect(detectContentType("function test() {}")).toBe("javascript");
      expect(detectContentType("PrimeFaces.cw('Widget', 'name', {});")).toBe("javascript");
      expect(detectContentType("window.location = '/';")).toBe("javascript");
      expect(detectContentType("document.getElementById('test');")).toBe("javascript");
      expect(detectContentType("$('#test').show();")).toBe("javascript");
    });

    it("should detect ViewState by element ID", () => {
      expect(detectContentType("someBase64Value", "javax.faces.ViewState")).toBe("viewstate");
      expect(detectContentType("someBase64Value", "form:ViewState")).toBe("viewstate");
    });

    it("should return text for plain content", () => {
      expect(detectContentType("Hello World")).toBe("text");
      expect(detectContentType("Just some text")).toBe("text");
    });

    it("should return text for empty content", () => {
      expect(detectContentType("")).toBe("text");
      expect(detectContentType("   ")).toBe("text");
    });
  });

  describe("extractCdataContent", () => {
    it("should extract content and detect HTML type", () => {
      const change: ChangeElement = {
        type: "update",
        id: "form:output",
        content: "<span>Hello</span>",
        attributes: {},
      };
      const result = extractCdataContent(change);
      expect(result.raw).toBe("<span>Hello</span>");
      expect(result.contentType).toBe("html");
      expect(result.formatted).toBe("<span>Hello</span>");
    });

    it("should extract content and detect JavaScript type", () => {
      const change: ChangeElement = {
        type: "eval",
        id: null,
        content: "PrimeFaces.cw('DataTable', 'dt', {});",
        attributes: {},
      };
      const result = extractCdataContent(change);
      expect(result.raw).toBe("PrimeFaces.cw('DataTable', 'dt', {});");
      expect(result.contentType).toBe("javascript");
    });

    it("should detect ViewState content type by ID", () => {
      const change: ChangeElement = {
        type: "update",
        id: "javax.faces.ViewState",
        content: "H4sIAAAAAAAA/wvOz0nVBQBWu2VLBQAAAA==",
        attributes: {},
      };
      const result = extractCdataContent(change);
      expect(result.contentType).toBe("viewstate");
    });

    it("should preserve original formatting", () => {
      const multilineContent = `<div>
  <span>Line 1</span>
  <span>Line 2</span>
</div>`;
      const change: ChangeElement = {
        type: "update",
        id: "form:output",
        content: multilineContent,
        attributes: {},
      };
      const result = extractCdataContent(change);
      expect(result.raw).toBe(multilineContent);
      expect(result.formatted).toBe(multilineContent);
    });
  });
});

// ============================================================================
// Property-Based Tests
// ============================================================================

describe("Property Tests", () => {
  /**
   * Property 1: JSF Response Detection Consistency
   * Feature: jsf-response-decoder, Property 1: JSF Response Detection Consistency
   * Validates: Requirements 1.1, 1.3
   */
  describe("Property 1: JSF Response Detection Consistency", () => {
    it("should return isJsfResponse=true iff body contains <partial-response tag", () => {
      fc.assert(
        fc.property(
          fc.record({
            hasPartialResponse: fc.boolean(),
            prefix: fc.string({ minLength: 0, maxLength: 50 }),
            suffix: fc.string({ minLength: 0, maxLength: 50 }),
          }),
          (data) => {
            // Filter out strings that accidentally contain partial-response
            if (data.prefix.toLowerCase().includes("partial-response") ||
                data.suffix.toLowerCase().includes("partial-response")) {
              return true; // Skip this case
            }

            let body: string;
            if (data.hasPartialResponse) {
              body = `${data.prefix}<partial-response>${data.suffix}`;
            } else {
              body = `${data.prefix}${data.suffix}`;
            }

            const result = detectJsfResponse(body);
            return result.isJsfResponse === data.hasPartialResponse;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 2: Partial Response ID Extraction
   * Feature: jsf-response-decoder, Property 2: Partial Response ID Extraction
   * Validates: Requirements 2.2
   */
  describe("Property 2: Partial Response ID Extraction", () => {
    it("should extract exact id value from partial-response", () => {
      fc.assert(
        fc.property(
          // Generate valid XML id values (alphanumeric with some special chars)
          fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789_-:'.split('')), { minLength: 1, maxLength: 20 }),
          (id) => {
            const xml = `<partial-response id="${id}"><changes></changes></partial-response>`;
            const result = parsePartialResponse(xml);
            return result.id === id;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

// ============================================================================
// Security Highlighter Implementation (inline for testing)
// Requirements: 8.1, 8.2, 8.3, 8.4, 8.5
// ============================================================================

type SecurityCategory = "error" | "sql" | "path" | "stacktrace" | "pii" | "sensitive";
type SecuritySeverity = "high" | "medium" | "low";

interface SecurityHighlight {
  category: SecurityCategory;
  content: string;
  context: string;
  severity: SecuritySeverity;
}

interface PatternDefinition {
  pattern: RegExp;
  severity: SecuritySeverity;
  description: string;
}

const SECURITY_PATTERNS: Record<SecurityCategory, PatternDefinition[]> = {
  sql: [
    { pattern: /SQL\s*syntax/i, severity: "high", description: "SQL syntax error" },
    { pattern: /ORA-\d+/i, severity: "high", description: "Oracle database error" },
    { pattern: /mysql.*error/i, severity: "high", description: "MySQL error" },
    { pattern: /syntax.*near/i, severity: "high", description: "SQL syntax error near" },
    { pattern: /SELECT\s+.{1,50}\s+FROM/i, severity: "medium", description: "SQL SELECT statement" },
    { pattern: /INSERT\s+INTO/i, severity: "medium", description: "SQL INSERT statement" },
    { pattern: /UPDATE\s+\w+\s+SET/i, severity: "medium", description: "SQL UPDATE statement" },
    { pattern: /DELETE\s+FROM/i, severity: "medium", description: "SQL DELETE statement" },
    { pattern: /UNION\s+SELECT/i, severity: "high", description: "SQL UNION injection pattern" },
    { pattern: /postgresql.*error/i, severity: "high", description: "PostgreSQL error" },
    { pattern: /sqlite.*error/i, severity: "high", description: "SQLite error" },
    { pattern: /SQLSTATE\[/i, severity: "high", description: "SQL state error" },
  ],
  path: [
    { pattern: /\/(?:usr|etc|var|home|opt|tmp)\/[^\s<>"']+/i, severity: "medium", description: "Unix file path" },
    { pattern: /[A-Z]:\\(?:Users|Windows|Program Files|temp)[^<>"']+/i, severity: "medium", description: "Windows file path" },
    { pattern: /\/home\/[a-zA-Z0-9_-]+/i, severity: "high", description: "Home directory path" },
    { pattern: /\/var\/(?:log|www|lib)\/[^\s<>"']+/i, severity: "medium", description: "System path disclosure" },
    { pattern: /WEB-INF\//i, severity: "high", description: "Java WEB-INF path" },
    { pattern: /META-INF\//i, severity: "medium", description: "Java META-INF path" },
    { pattern: /\.(?:properties|xml|conf|config|ini)\b/i, severity: "low", description: "Configuration file reference" },
  ],
  stacktrace: [
    { pattern: /at\s+[\w.$]+\([\w.]+:\d+\)/, severity: "high", description: "Java stack trace" },
    { pattern: /Exception.*:\s*.+/i, severity: "high", description: "Exception message" },
    { pattern: /Caused by:/i, severity: "high", description: "Chained exception" },
    { pattern: /java\.\w+\.\w+Exception/i, severity: "high", description: "Java exception class" },
    { pattern: /javax\.\w+\.\w+Exception/i, severity: "high", description: "Javax exception class" },
    { pattern: /org\.[\w.]+Exception/i, severity: "high", description: "Framework exception" },
    { pattern: /Traceback \(most recent call last\)/i, severity: "high", description: "Python traceback" },
    { pattern: /File ".*", line \d+/i, severity: "high", description: "Python stack frame" },
    { pattern: /Error:\s+at\s+/i, severity: "medium", description: "JavaScript stack trace" },
    { pattern: /NullPointerException/i, severity: "high", description: "Null pointer exception" },
    { pattern: /ClassNotFoundException/i, severity: "medium", description: "Class not found" },
    { pattern: /NoSuchMethodException/i, severity: "medium", description: "Method not found" },
  ],
  error: [
    { pattern: /error\s+(?:occurred|happened)/i, severity: "low", description: "Generic error message" },
    { pattern: /failed\s*:/i, severity: "low", description: "Failure message" },
    { pattern: /invalid\s+(?:value|input|parameter|argument)/i, severity: "low", description: "Validation error" },
    { pattern: /not\s+found/i, severity: "low", description: "Not found error" },
    { pattern: /access\s+denied/i, severity: "medium", description: "Access denied" },
    { pattern: /permission\s+denied/i, severity: "medium", description: "Permission denied" },
    { pattern: /unauthorized/i, severity: "medium", description: "Unauthorized access" },
    { pattern: /authentication\s+failed/i, severity: "medium", description: "Authentication failure" },
    { pattern: /connection\s+(?:refused|failed|timeout)/i, severity: "low", description: "Connection error" },
    { pattern: /internal\s+(?:server\s+)?error/i, severity: "medium", description: "Internal error" },
  ],
  pii: [
    { pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/, severity: "medium", description: "Email address" },
    { pattern: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/, severity: "medium", description: "Phone number (US format)" },
    { pattern: /\b\d{3}-\d{2}-\d{4}\b/, severity: "high", description: "SSN pattern" },
    { pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/, severity: "high", description: "Credit card number pattern" },
    { pattern: /\b(?:password|passwd|pwd)\s*[:=]\s*\S+/i, severity: "high", description: "Password in plaintext" },
    { pattern: /\b(?:api[_-]?key|apikey|secret[_-]?key)\s*[:=]\s*\S+/i, severity: "high", description: "API key exposure" },
    { pattern: /\b(?:token|auth[_-]?token|access[_-]?token)\s*[:=]\s*[a-zA-Z0-9_-]{20,}/i, severity: "high", description: "Token exposure" },
  ],
  sensitive: [
    { pattern: /\bDEBUG\s*[:=]/i, severity: "low", description: "Debug information" },
    { pattern: /\bversion\s*[:=]\s*[\d.]+/i, severity: "low", description: "Version disclosure" },
    { pattern: /\bserver\s*[:=]\s*\S+/i, severity: "low", description: "Server information" },
    { pattern: /\bpowered[_-]?by\s*[:=]?\s*\S+/i, severity: "low", description: "Technology disclosure" },
    { pattern: /<!--[\s\S]*?(?:TODO|FIXME|HACK|XXX|BUG)[\s\S]*?-->/i, severity: "low", description: "Developer comment" },
    { pattern: /\broot\s*[:@]/i, severity: "medium", description: "Root user reference" },
    { pattern: /\badmin(?:istrator)?\s*[:@]/i, severity: "medium", description: "Admin user reference" },
    { pattern: /jdbc:[a-z]+:\/\/[^\s<>"']+/i, severity: "high", description: "JDBC connection string" },
    { pattern: /mongodb(?:\+srv)?:\/\/[^\s<>"']+/i, severity: "high", description: "MongoDB connection string" },
  ],
};

const MAX_CONTEXT_LENGTH = 100;

function extractContext(content: string, matchStart: number, matchEnd: number): string {
  const contextPadding = Math.floor((MAX_CONTEXT_LENGTH - (matchEnd - matchStart)) / 2);
  const contextStart = Math.max(0, matchStart - contextPadding);
  const contextEnd = Math.min(content.length, matchEnd + contextPadding);
  
  let context = content.substring(contextStart, contextEnd);
  
  if (contextStart > 0) {
    context = "..." + context;
  }
  if (contextEnd < content.length) {
    context = context + "...";
  }
  
  context = context.replace(/\s+/g, " ").trim();
  
  return context;
}

function scanForSecurityPatterns(content: string): SecurityHighlight[] {
  const highlights: SecurityHighlight[] = [];
  
  if (!content || typeof content !== "string") {
    return highlights;
  }

  const matchedContent = new Set<string>();

  for (const [category, patterns] of Object.entries(SECURITY_PATTERNS)) {
    for (const { pattern, severity } of patterns) {
      const globalPattern = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g");
      
      let match: RegExpExecArray | null;
      while ((match = globalPattern.exec(content)) !== null) {
        const matchedText = match[0];
        
        const dedupeKey = `${category}:${matchedText}`;
        if (matchedContent.has(dedupeKey)) {
          continue;
        }
        matchedContent.add(dedupeKey);
        
        const context = extractContext(content, match.index, match.index + matchedText.length);
        
        highlights.push({
          category: category as SecurityCategory,
          content: matchedText,
          context,
          severity,
        });
      }
    }
  }

  const severityOrder: Record<SecuritySeverity, number> = { high: 0, medium: 1, low: 2 };
  highlights.sort((a, b) => {
    const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
    if (severityDiff !== 0) return severityDiff;
    return a.category.localeCompare(b.category);
  });

  return highlights;
}

// ============================================================================
// Security Highlighter Unit Tests
// Requirements: 8.1, 8.2, 8.3, 8.4, 8.5
// ============================================================================

describe("Security Highlighter", () => {
  describe("scanForSecurityPatterns", () => {
    // Requirement 8.1: Error messages
    describe("Error Message Detection (Requirement 8.1)", () => {
      it("should detect generic error messages", () => {
        const content = "An error occurred while processing your request";
        const highlights = scanForSecurityPatterns(content);
        expect(highlights.some(h => h.category === "error")).toBe(true);
      });

      it("should detect failed messages", () => {
        const content = "Operation failed: connection timeout";
        const highlights = scanForSecurityPatterns(content);
        expect(highlights.some(h => h.category === "error")).toBe(true);
      });

      it("should detect access denied messages", () => {
        const content = "Access denied for user admin";
        const highlights = scanForSecurityPatterns(content);
        const accessDenied = highlights.find(h => h.content.toLowerCase().includes("access denied"));
        expect(accessDenied).toBeDefined();
        expect(accessDenied?.severity).toBe("medium");
      });
    });

    // Requirement 8.2: SQL-related text
    describe("SQL Pattern Detection (Requirement 8.2)", () => {
      it("should detect SQL syntax errors", () => {
        const content = "You have an error in your SQL syntax near 'SELECT'";
        const highlights = scanForSecurityPatterns(content);
        expect(highlights.some(h => h.category === "sql")).toBe(true);
      });

      it("should detect Oracle errors", () => {
        const content = "ORA-00942: table or view does not exist";
        const highlights = scanForSecurityPatterns(content);
        const oraError = highlights.find(h => h.content.includes("ORA-"));
        expect(oraError).toBeDefined();
        expect(oraError?.category).toBe("sql");
        expect(oraError?.severity).toBe("high");
      });

      it("should detect MySQL errors", () => {
        const content = "MySQL error: Unknown column 'test' in 'field list'";
        const highlights = scanForSecurityPatterns(content);
        expect(highlights.some(h => h.category === "sql")).toBe(true);
      });

      it("should detect SQL statements", () => {
        const content = "SELECT username FROM users WHERE id = 1";
        const highlights = scanForSecurityPatterns(content);
        expect(highlights.some(h => h.category === "sql")).toBe(true);
      });

      it("should detect UNION injection patterns", () => {
        const content = "UNION SELECT password FROM admin";
        const highlights = scanForSecurityPatterns(content);
        const unionSelect = highlights.find(h => h.content.includes("UNION SELECT"));
        expect(unionSelect).toBeDefined();
        expect(unionSelect?.severity).toBe("high");
      });
    });

    // Requirement 8.3: File paths
    describe("Path Disclosure Detection (Requirement 8.3)", () => {
      it("should detect Unix file paths", () => {
        const content = "Error reading file /var/log/application.log";
        const highlights = scanForSecurityPatterns(content);
        expect(highlights.some(h => h.category === "path")).toBe(true);
      });

      it("should detect Windows file paths", () => {
        const content = "File not found: C:\\Users\\admin\\config.xml";
        const highlights = scanForSecurityPatterns(content);
        expect(highlights.some(h => h.category === "path")).toBe(true);
      });

      it("should detect home directory paths", () => {
        const content = "Loading config from /home/webapp/.config";
        const highlights = scanForSecurityPatterns(content);
        const homePath = highlights.find(h => h.content.includes("/home/"));
        expect(homePath).toBeDefined();
        expect(homePath?.severity).toBe("high");
      });

      it("should detect WEB-INF paths", () => {
        const content = "Error in WEB-INF/web.xml configuration";
        const highlights = scanForSecurityPatterns(content);
        const webInf = highlights.find(h => h.content.includes("WEB-INF/"));
        expect(webInf).toBeDefined();
        expect(webInf?.severity).toBe("high");
      });
    });

    // Requirement 8.4: Stack traces
    describe("Stack Trace Detection (Requirement 8.4)", () => {
      it("should detect Java stack traces", () => {
        const content = "at com.example.MyClass.myMethod(MyClass.java:42)";
        const highlights = scanForSecurityPatterns(content);
        expect(highlights.some(h => h.category === "stacktrace")).toBe(true);
      });

      it("should detect Java exceptions", () => {
        const content = "java.lang.NullPointerException: Cannot invoke method on null";
        const highlights = scanForSecurityPatterns(content);
        expect(highlights.some(h => h.category === "stacktrace")).toBe(true);
      });

      it("should detect Caused by chains", () => {
        const content = "Caused by: java.io.IOException: Connection reset";
        const highlights = scanForSecurityPatterns(content);
        expect(highlights.some(h => h.content.includes("Caused by:"))).toBe(true);
      });

      it("should detect Python tracebacks", () => {
        const content = 'Traceback (most recent call last):\n  File "app.py", line 42';
        const highlights = scanForSecurityPatterns(content);
        expect(highlights.some(h => h.category === "stacktrace")).toBe(true);
      });
    });

    // Requirement 8.5: PII exposure
    describe("PII Detection (Requirement 8.5)", () => {
      it("should detect email addresses", () => {
        const content = "User email: john.doe@example.com";
        const highlights = scanForSecurityPatterns(content);
        const email = highlights.find(h => h.content.includes("@"));
        expect(email).toBeDefined();
        expect(email?.category).toBe("pii");
      });

      it("should detect phone numbers", () => {
        const content = "Contact: 555-123-4567";
        const highlights = scanForSecurityPatterns(content);
        expect(highlights.some(h => h.category === "pii")).toBe(true);
      });

      it("should detect SSN patterns", () => {
        const content = "SSN: 123-45-6789";
        const highlights = scanForSecurityPatterns(content);
        const ssn = highlights.find(h => h.content.includes("123-45-6789"));
        expect(ssn).toBeDefined();
        expect(ssn?.severity).toBe("high");
      });

      it("should detect password exposure", () => {
        const content = "password=secretpass123";
        const highlights = scanForSecurityPatterns(content);
        const password = highlights.find(h => h.content.toLowerCase().includes("password"));
        expect(password).toBeDefined();
        expect(password?.severity).toBe("high");
      });

      it("should detect API key exposure", () => {
        const content = "api_key=sk_live_abcdef123456789";
        const highlights = scanForSecurityPatterns(content);
        const apiKey = highlights.find(h => h.content.includes("api_key"));
        expect(apiKey).toBeDefined();
        expect(apiKey?.severity).toBe("high");
      });
    });

    // Sensitive information detection
    describe("Sensitive Information Detection", () => {
      it("should detect JDBC connection strings", () => {
        const content = "jdbc:mysql://localhost:3306/mydb?user=root&password=secret";
        const highlights = scanForSecurityPatterns(content);
        const jdbc = highlights.find(h => h.content.includes("jdbc:"));
        expect(jdbc).toBeDefined();
        expect(jdbc?.severity).toBe("high");
      });

      it("should detect MongoDB connection strings", () => {
        const content = "mongodb://admin:password@localhost:27017/mydb";
        const highlights = scanForSecurityPatterns(content);
        const mongo = highlights.find(h => h.content.includes("mongodb://"));
        expect(mongo).toBeDefined();
        expect(mongo?.severity).toBe("high");
      });

      it("should detect developer comments", () => {
        const content = "<!-- TODO: Remove this before production -->";
        const highlights = scanForSecurityPatterns(content);
        expect(highlights.some(h => h.category === "sensitive")).toBe(true);
      });
    });

    // Edge cases
    describe("Edge Cases", () => {
      it("should handle empty content", () => {
        const highlights = scanForSecurityPatterns("");
        expect(highlights).toHaveLength(0);
      });

      it("should handle null/undefined content", () => {
        expect(scanForSecurityPatterns(null as any)).toHaveLength(0);
        expect(scanForSecurityPatterns(undefined as any)).toHaveLength(0);
      });

      it("should handle content with no security patterns", () => {
        const content = "Hello, this is a normal message with no security issues.";
        const highlights = scanForSecurityPatterns(content);
        expect(highlights).toHaveLength(0);
      });

      it("should deduplicate identical matches", () => {
        const content = "ORA-00942 error occurred. ORA-00942 error occurred again.";
        const highlights = scanForSecurityPatterns(content);
        const oraErrors = highlights.filter(h => h.content === "ORA-00942");
        expect(oraErrors.length).toBe(1);
      });

      it("should sort by severity (high first)", () => {
        const content = "error occurred and ORA-00942 database error";
        const highlights = scanForSecurityPatterns(content);
        if (highlights.length >= 2) {
          const severityOrder = { high: 0, medium: 1, low: 2 };
          for (let i = 1; i < highlights.length; i++) {
            expect(severityOrder[highlights[i].severity]).toBeGreaterThanOrEqual(
              severityOrder[highlights[i - 1].severity]
            );
          }
        }
      });

      it("should include context around matches", () => {
        const content = "Some prefix text ORA-00942 some suffix text";
        const highlights = scanForSecurityPatterns(content);
        const oraError = highlights.find(h => h.content.includes("ORA-"));
        expect(oraError?.context).toContain("ORA-00942");
        expect(oraError?.context.length).toBeGreaterThan(oraError?.content.length ?? 0);
      });
    });

    // Multiple patterns in same content
    describe("Multiple Pattern Detection", () => {
      it("should detect multiple different security issues", () => {
        const content = `
          Error: java.lang.NullPointerException at com.example.App.main(App.java:10)
          SQL Error: ORA-00942 table not found
          User email: admin@example.com
          Path: /var/log/app.log
        `;
        const highlights = scanForSecurityPatterns(content);
        
        const categories = new Set(highlights.map(h => h.category));
        expect(categories.has("stacktrace")).toBe(true);
        expect(categories.has("sql")).toBe(true);
        expect(categories.has("pii")).toBe(true);
        expect(categories.has("path")).toBe(true);
      });
    });
  });
});
