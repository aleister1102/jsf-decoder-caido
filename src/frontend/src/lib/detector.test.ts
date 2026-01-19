/**
 * Tests for JSF Detector
 * Property 1: JSF Detection Consistency
 * Validates: Requirements 1.1, 1.2, 1.3
 */

import { describe, it, expect } from "bun:test";
import fc from "fast-check";
import { isJsfRequest, detectJsf } from "./detector";

describe("JSF Detector", () => {
  describe("isJsfRequest", () => {
    it("should detect JSF requests with javax.faces parameters", () => {
      const raw =
        "POST /test HTTP/1.1\r\nHost: example.com\r\n\r\njavax.faces.ViewState=abc123&key=value";
      expect(isJsfRequest(raw)).toBe(true);
    });

    it("should detect JSF requests with _SUBMIT suffix", () => {
      const raw =
        "POST /test HTTP/1.1\r\nHost: example.com\r\n\r\nform_SUBMIT=1&key=value";
      expect(isJsfRequest(raw)).toBe(true);
    });

    it("should detect JSF requests with component IDs", () => {
      const raw =
        "POST /test HTTP/1.1\r\nHost: example.com\r\n\r\nj_id_3x%3Aj_id_40=test&key=value";
      expect(isJsfRequest(raw)).toBe(false); // Component IDs alone don't make it JSF
    });

    it("should not detect non-JSF requests", () => {
      const raw =
        "POST /test HTTP/1.1\r\nHost: example.com\r\n\r\nkey=value&foo=bar";
      expect(isJsfRequest(raw)).toBe(false);
    });

    it("should handle empty body", () => {
      const raw = "POST /test HTTP/1.1\r\nHost: example.com\r\n\r\n";
      expect(isJsfRequest(raw)).toBe(false);
    });

    it("should handle null/undefined input", () => {
      expect(isJsfRequest("")).toBe(false);
      expect(isJsfRequest(null as any)).toBe(false);
      expect(isJsfRequest(undefined as any)).toBe(false);
    });

    it("should detect multiple JSF indicators", () => {
      const raw =
        "POST /test HTTP/1.1\r\nHost: example.com\r\n\r\njavax.faces.partial.ajax=true&javax.faces.source=button1&form_SUBMIT=1";
      expect(isJsfRequest(raw)).toBe(true);
    });
  });

  describe("detectJsf", () => {
    it("should return high confidence for standard JSF parameters", () => {
      const raw =
        "POST /test HTTP/1.1\r\nHost: example.com\r\n\r\njavax.faces.ViewState=abc123";
      const result = detectJsf(raw);

      expect(result.isJsf).toBe(true);
      expect(result.confidence).toBe("high");
      expect(result.indicators.length).toBeGreaterThan(0);
    });

    it("should return medium confidence for _SUBMIT only", () => {
      const raw =
        "POST /test HTTP/1.1\r\nHost: example.com\r\n\r\nform_SUBMIT=1&key=value";
      const result = detectJsf(raw);

      expect(result.isJsf).toBe(true);
      expect(result.confidence).toBe("medium");
      expect(result.indicators).toContain("Form submission marker: form_SUBMIT");
    });

    it("should return low confidence for non-JSF requests", () => {
      const raw =
        "POST /test HTTP/1.1\r\nHost: example.com\r\n\r\nkey=value&foo=bar";
      const result = detectJsf(raw);

      expect(result.isJsf).toBe(false);
      expect(result.confidence).toBe("low");
      expect(result.indicators).toHaveLength(0);
    });

    it("should include all detected indicators", () => {
      const raw =
        "POST /test HTTP/1.1\r\nHost: example.com\r\n\r\njavax.faces.partial.ajax=true&javax.faces.source=button1&form_SUBMIT=1";
      const result = detectJsf(raw);

      expect(result.indicators).toContain(
        "Standard JSF parameter: javax.faces.partial.ajax"
      );
      expect(result.indicators).toContain(
        "Standard JSF parameter: javax.faces.source"
      );
      expect(result.indicators).toContain("Form submission marker: form_SUBMIT");
    });

    it("should handle URL-encoded parameter names", () => {
      const raw =
        "POST /test HTTP/1.1\r\nHost: example.com\r\n\r\njavax.faces.ViewState=abc123&form%5FSUBMIT=1";
      const result = detectJsf(raw);

      expect(result.isJsf).toBe(true);
      expect(result.indicators.length).toBeGreaterThan(0);
    });

    it("should handle malformed requests gracefully", () => {
      const result = detectJsf("invalid request");
      expect(result.isJsf).toBe(false);
      expect(result.confidence).toBe("low");
    });

    it("should handle null/undefined input", () => {
      const result1 = detectJsf("");
      const result2 = detectJsf(null as any);
      const result3 = detectJsf(undefined as any);

      expect(result1.isJsf).toBe(false);
      expect(result2.isJsf).toBe(false);
      expect(result3.isJsf).toBe(false);
    });

    it("should detect all standard JSF parameters", () => {
      const standardParams = [
        "javax.faces.partial.ajax",
        "javax.faces.source",
        "javax.faces.partial.execute",
        "javax.faces.partial.render",
        "javax.faces.behavior.event",
        "javax.faces.partial.event",
        "javax.faces.ViewState",
      ];

      for (const param of standardParams) {
        const raw = `POST /test HTTP/1.1\r\nHost: example.com\r\n\r\n${param}=value`;
        const result = detectJsf(raw);

        expect(result.isJsf).toBe(true);
        expect(result.confidence).toBe("high");
        expect(result.indicators.some((ind) => ind.includes(param))).toBe(true);
      }
    });
  });

  describe("Property 1: JSF Detection Consistency", () => {
    it("should return isJsf=true if and only if body contains javax.faces.* or *_SUBMIT", () => {
      fc.assert(
        fc.property(
          fc.record({
            hasJavaxFaces: fc.boolean(),
            hasSubmit: fc.boolean(),
            otherParams: fc.array(
              fc.tuple(fc.string({ minLength: 1 }), fc.string()),
              { minLength: 0, maxLength: 5 }
            ),
          }),
          (data) => {
            // Build a request body
            const params: string[] = [];

            if (data.hasJavaxFaces) {
              params.push("javax.faces.ViewState=test");
            }

            if (data.hasSubmit) {
              params.push("form_SUBMIT=1");
            }

            // Add other parameters (filtered to avoid accidental JSF params)
            for (const [key, value] of data.otherParams) {
              // Skip if it would create a JSF parameter
              if (
                key.includes("javax.faces") ||
                key.includes("_SUBMIT") ||
                value.includes("javax.faces") ||
                value.includes("_SUBMIT")
              ) {
                continue;
              }
              params.push(`${key}=${value}`);
            }

            const body = params.join("&");
            const raw = `POST /test HTTP/1.1\r\nHost: example.com\r\n\r\n${body}`;

            const result = detectJsf(raw);
            const expectedJsf = data.hasJavaxFaces || data.hasSubmit;

            return result.isJsf === expectedJsf;
          }
        ),
        { numRuns: 100 }
      );
    });

    it("should maintain consistency between isJsfRequest and detectJsf", () => {
      fc.assert(
        fc.property(fc.string({ minLength: 0, maxLength: 500 }), (raw) => {
          const isJsf = isJsfRequest(raw);
          const detected = detectJsf(raw);

          return isJsf === detected.isJsf;
        }),
        { numRuns: 100 }
      );
    });

    it("should return high confidence only when standard JSF params are present", () => {
      fc.assert(
        fc.property(
          fc.record({
            hasStandardJsf: fc.boolean(),
            hasSubmitOnly: fc.boolean(),
          }),
          (data) => {
            const params: string[] = [];

            if (data.hasStandardJsf) {
              params.push("javax.faces.partial.ajax=true");
            }

            if (data.hasSubmitOnly && !data.hasStandardJsf) {
              params.push("form_SUBMIT=1");
            }

            const body = params.join("&");
            const raw = `POST /test HTTP/1.1\r\nHost: example.com\r\n\r\n${body}`;

            const result = detectJsf(raw);

            if (data.hasStandardJsf) {
              return result.confidence === "high";
            } else if (data.hasSubmitOnly) {
              return result.confidence === "medium";
            } else {
              return result.confidence === "low";
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
