/**
 * Tests for URL Decoder Utility
 * Property 2: URL Decoding Round Trip
 * Validates: Requirements 2.1, 2.2
 */

import { describe, it, expect } from "bun:test";
import fc from "fast-check";
import { decodeParameter, encodeParameter, isUrlEncoded } from "./decoder";

describe("URL Decoder", () => {
  describe("decodeParameter", () => {
    it("should decode single-encoded parameters", () => {
      expect(decodeParameter("hello%20world")).toBe("hello world");
      expect(decodeParameter("test%40example.com")).toBe("test@example.com");
      expect(decodeParameter("foo%3Dbar")).toBe("foo=bar");
    });

    it("should decode double-encoded parameters", () => {
      // First decode: %25 becomes %, so %2520 becomes %20
      expect(decodeParameter("hello%2520world")).toBe("hello%20world");
      expect(decodeParameter("test%2540example.com")).toBe("test%40example.com");
    });

    it("should handle special characters", () => {
      expect(decodeParameter("test%2B1")).toBe("test+1");
      expect(decodeParameter("path%2Fto%2Ffile")).toBe("path/to/file");
      expect(decodeParameter("query%3Fkey%3Dvalue")).toBe("query?key=value");
    });

    it("should handle malformed encoding gracefully", () => {
      // Invalid percent encoding should return the last valid result
      const result = decodeParameter("test%ZZinvalid");
      expect(typeof result).toBe("string");
    });

    it("should handle empty strings", () => {
      expect(decodeParameter("")).toBe("");
      expect(decodeParameter(null as any)).toBe("");
      expect(decodeParameter(undefined as any)).toBe("");
    });

    it("should handle already-decoded strings", () => {
      expect(decodeParameter("hello world")).toBe("hello world");
      expect(decodeParameter("test@example.com")).toBe("test@example.com");
    });

    it("should prevent infinite loops on stable results", () => {
      // This should not hang
      const result = decodeParameter("test");
      expect(result).toBe("test");
    });
  });

  describe("encodeParameter", () => {
    it("should encode strings to URL format", () => {
      expect(encodeParameter("hello world")).toBe("hello%20world");
      expect(encodeParameter("test@example.com")).toBe("test%40example.com");
      expect(encodeParameter("foo=bar")).toBe("foo%3Dbar");
    });

    it("should handle empty strings", () => {
      expect(encodeParameter("")).toBe("");
      expect(encodeParameter(null as any)).toBe("");
    });
  });

  describe("isUrlEncoded", () => {
    it("should detect URL-encoded strings", () => {
      expect(isUrlEncoded("hello%20world")).toBe(true);
      expect(isUrlEncoded("test%40example.com")).toBe(true);
      expect(isUrlEncoded("foo%3Dbar")).toBe(true);
    });

    it("should return false for non-encoded strings", () => {
      expect(isUrlEncoded("hello world")).toBe(false);
      expect(isUrlEncoded("test@example.com")).toBe(false);
      expect(isUrlEncoded("")).toBe(false);
    });
  });

  describe("Property 2: URL Decoding Round Trip", () => {
    it("should satisfy round-trip property: decode(encode(x)) ≈ x", () => {
      fc.assert(
        fc.property(fc.string(), (original) => {
          // Skip strings that contain % to avoid conflicts with encoding
          if (original.includes("%")) {
            return true;
          }

          const encoded = encodeParameter(original);
          const decoded = decodeParameter(encoded);

          // The decoded value should match the original
          return decoded === original;
        }),
        { numRuns: 100 }
      );
    });

    it("should handle multi-level encoding round trip", () => {
      fc.assert(
        fc.property(fc.string(), (original) => {
          if (original.includes("%")) {
            return true;
          }

          // Double encode
          const encoded1 = encodeParameter(original);
          const encoded2 = encodeParameter(encoded1);

          // Decode twice
          const decoded1 = decodeParameter(encoded2);
          const decoded2 = decodeParameter(decoded1);

          // Should get back to original
          return decoded2 === original;
        }),
        { numRuns: 100 }
      );
    });
  });
});
