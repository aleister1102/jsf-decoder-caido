/**
 * ViewState Analysis Utilities
 * Analyzes JSF ViewState parameters for encoding type and security issues
 * Requirements: 5.1, 5.2, 5.3, 5.4
 */

import type { ViewStateAnalysis } from "../types";

/**
 * Java serialization magic bytes (0xAC 0xED)
 * Indicates the content is serialized Java object
 */
const JAVA_SERIALIZATION_MAGIC = [0xac, 0xed];

/**
 * Analyzes a ViewState value to determine encoding type and potential security issues
 * 
 * @param value - The ViewState parameter value to analyze
 * @returns ViewStateAnalysis with encoding type, decoded content, and warnings
 */
export function analyzeViewState(value: string): ViewStateAnalysis {
  if (!value || typeof value !== "string") {
    return {
      encoding: "unknown",
      decodedContent: null,
      isSerializedJava: false,
      warnings: ["ViewState value is empty or invalid"],
    };
  }

  const analysis: ViewStateAnalysis = {
    encoding: "unknown",
    decodedContent: null,
    isSerializedJava: false,
    warnings: [],
  };

  // Check if it's Base64 encoded
  if (isBase64(value)) {
    analysis.encoding = "base64";
    try {
      const decoded = atob(value);
      analysis.decodedContent = decoded;

      // Convert decoded string to Uint8Array to check for Java serialization
      const uint8Array = new Uint8Array(decoded.length);
      for (let i = 0; i < decoded.length; i++) {
        uint8Array[i] = decoded.charCodeAt(i);
      }

      if (detectSerializedJava(uint8Array)) {
        analysis.isSerializedJava = true;
        analysis.warnings.push(
          "ViewState contains serialized Java object - potential deserialization vulnerability"
        );
      }
    } catch (error) {
      analysis.warnings.push("Failed to decode Base64 ViewState");
    }
  } else {
    // If not Base64, it's likely encrypted or unknown encoding
    analysis.encoding = "encrypted";
    analysis.warnings.push(
      "ViewState is not Base64 encoded - likely encrypted or using custom encoding"
    );
  }

  return analysis;
}

/**
 * Checks if a string is valid Base64 encoded
 * 
 * @param value - The string to check
 * @returns true if the string appears to be valid Base64
 */
export function isBase64(value: string): boolean {
  if (!value || typeof value !== "string") {
    return false;
  }

  // Base64 regex pattern: allows alphanumeric, +, /, and = for padding
  // Must be multiple of 4 characters (with padding)
  const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;

  // Check if string matches Base64 pattern
  if (!base64Regex.test(value)) {
    return false;
  }

  // Check if length is multiple of 4 (valid Base64)
  if (value.length % 4 !== 0) {
    return false;
  }

  // Try to decode to verify it's valid Base64
  try {
    const decoded = atob(value);
    // If we can decode it and get a non-empty result, it's valid Base64
    return decoded.length > 0;
  } catch (error) {
    return false;
  }
}

/**
 * Detects if a decoded byte array contains Java serialized object magic bytes
 * Java serialization starts with 0xAC 0xED (magic bytes)
 * 
 * @param decoded - The decoded byte array to check
 * @returns true if the byte array starts with Java serialization magic bytes
 */
export function detectSerializedJava(decoded: Uint8Array): boolean {
  if (!decoded || decoded.length < 2) {
    return false;
  }

  // Check for Java serialization magic bytes: 0xAC 0xED
  return (
    decoded[0] === JAVA_SERIALIZATION_MAGIC[0] &&
    decoded[1] === JAVA_SERIALIZATION_MAGIC[1]
  );
}
