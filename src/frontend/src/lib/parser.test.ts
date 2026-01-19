/**
 * Tests for JSF Body Parser
 * Validates: Requirements 2.1, 2.2
 */

import { describe, it, expect } from "bun:test";
import {
  extractBodyFromRaw,
  parseUrlEncodedBody,
  parseJsfBody,
} from "./parser";

describe("JSF Body Parser", () => {
  describe("extractBodyFromRaw", () => {
    it("should extract body from raw HTTP request with CRLF", () => {
      const raw =
        "POST /test HTTP/1.1\r\nHost: example.com\r\nContent-Length: 10\r\n\r\nkey=value";
      const body = extractBodyFromRaw(raw);
      expect(body).toBe("key=value");
    });

    it("should extract body from raw HTTP request with LF", () => {
      const raw =
        "POST /test HTTP/1.1\nHost: example.com\nContent-Length: 10\n\nkey=value";
      const body = extractBodyFromRaw(raw);
      expect(body).toBe("key=value");
    });

    it("should handle empty body", () => {
      const raw = "POST /test HTTP/1.1\r\nHost: example.com\r\n\r\n";
      const body = extractBodyFromRaw(raw);
      expect(body).toBe("");
    });

    it("should return empty string if no header/body separator found", () => {
      const raw = "POST /test HTTP/1.1\r\nHost: example.com";
      const body = extractBodyFromRaw(raw);
      expect(body).toBe("");
    });

    it("should handle null/undefined input", () => {
      expect(extractBodyFromRaw("")).toBe("");
      expect(extractBodyFromRaw(null as any)).toBe("");
      expect(extractBodyFromRaw(undefined as any)).toBe("");
    });

    it("should preserve body content with special characters", () => {
      const raw =
        "POST /test HTTP/1.1\r\n\r\nkey=value%20with%20spaces&foo=bar%3Dbaz";
      const body = extractBodyFromRaw(raw);
      expect(body).toBe("key=value%20with%20spaces&foo=bar%3Dbaz");
    });
  });

  describe("parseUrlEncodedBody", () => {
    it("should parse simple key-value pairs", () => {
      const body = "key=value&foo=bar";
      const params = parseUrlEncodedBody(body);

      expect(params).toHaveLength(2);
      expect(params[0]).toEqual({
        name: "key",
        decodedName: "key",
        value: "value",
        decodedValue: "value",
      });
      expect(params[1]).toEqual({
        name: "foo",
        decodedName: "foo",
        value: "bar",
        decodedValue: "bar",
      });
    });

    it("should decode URL-encoded parameters", () => {
      const body = "key%20name=value%20data&test%40email=data%3Dvalue";
      const params = parseUrlEncodedBody(body);

      expect(params).toHaveLength(2);
      expect(params[0].decodedName).toBe("key name");
      expect(params[0].decodedValue).toBe("value data");
      expect(params[1].decodedName).toBe("test@email");
      expect(params[1].decodedValue).toBe("data=value");
    });

    it("should handle parameters with no value", () => {
      const body = "key1&key2=value2&key3";
      const params = parseUrlEncodedBody(body);

      expect(params).toHaveLength(3);
      expect(params[0]).toEqual({
        name: "key1",
        decodedName: "key1",
        value: "",
        decodedValue: "",
      });
      expect(params[2]).toEqual({
        name: "key3",
        decodedName: "key3",
        value: "",
        decodedValue: "",
      });
    });

    it("should handle empty body", () => {
      const params = parseUrlEncodedBody("");
      expect(params).toHaveLength(0);
    });

    it("should skip empty pairs", () => {
      const body = "key=value&&foo=bar";
      const params = parseUrlEncodedBody(body);

      expect(params).toHaveLength(2);
      expect(params[0].name).toBe("key");
      expect(params[1].name).toBe("foo");
    });

    it("should handle JSF-specific parameters", () => {
      const body =
        "javax.faces.ViewState=abc123&j_id_3x%3Aj_id_40%3A0%3Aj_id_42=test&form_SUBMIT=1";
      const params = parseUrlEncodedBody(body);

      expect(params).toHaveLength(3);
      expect(params[0].decodedName).toBe("javax.faces.ViewState");
      expect(params[1].decodedName).toBe("j_id_3x:j_id_40:0:j_id_42");
      expect(params[2].decodedName).toBe("form_SUBMIT");
    });

    it("should handle null/undefined input", () => {
      expect(parseUrlEncodedBody("")).toHaveLength(0);
      expect(parseUrlEncodedBody(null as any)).toHaveLength(0);
      expect(parseUrlEncodedBody(undefined as any)).toHaveLength(0);
    });
  });

  describe("parseJsfBody", () => {
    it("should parse body directly if no headers present", () => {
      const body = "key=value&foo=bar";
      const result = parseJsfBody(body);

      expect(result.parameters).toHaveLength(2);
      expect(result.rawBody).toBe("key=value&foo=bar");
    });

    it("should extract and parse body from full HTTP request", () => {
      const raw =
        "POST /test HTTP/1.1\r\nHost: example.com\r\n\r\nkey=value&foo=bar";
      const result = parseJsfBody(raw);

      expect(result.parameters).toHaveLength(2);
      expect(result.rawBody).toBe("key=value&foo=bar");
    });

    it("should handle empty body", () => {
      const result = parseJsfBody("");
      expect(result.parameters).toHaveLength(0);
      expect(result.rawBody).toBe("");
    });

    it("should handle JSF request with ViewState and component IDs", () => {
      const body =
        "javax.faces.ViewState=abc123&j_id_3x%3Aj_id_40=test&form_SUBMIT=1";
      const result = parseJsfBody(body);

      expect(result.parameters).toHaveLength(3);
      expect(result.parameters[0].decodedName).toBe("javax.faces.ViewState");
      expect(result.parameters[1].decodedName).toBe("j_id_3x:j_id_40");
      expect(result.parameters[2].decodedName).toBe("form_SUBMIT");
    });

    it("should handle multi-level URL encoding", () => {
      const body = "key=value%2520encoded";
      const result = parseJsfBody(body);

      expect(result.parameters).toHaveLength(1);
      expect(result.parameters[0].decodedValue).toBe("value%20encoded");
    });

    it("should return empty result for null/undefined", () => {
      const result1 = parseJsfBody(null as any);
      const result2 = parseJsfBody(undefined as any);

      expect(result1.parameters).toHaveLength(0);
      expect(result2.parameters).toHaveLength(0);
    });
  });
});
