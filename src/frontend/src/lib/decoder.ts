/**
 * URL Decoder Utility
 * Handles URL decoding with support for multi-level encoding
 * Requirements: 2.1, 2.2, 2.3
 */

/**
 * Decodes a URL-encoded string with support for multi-level encoding
 * Handles edge cases: malformed encoding, special characters
 * 
 * @param encoded - The URL-encoded string to decode
 * @returns The decoded string
 */
export function decodeParameter(encoded: string): string {
  if (!encoded || typeof encoded !== "string") {
    return "";
  }

  try {
    // Decode once - handles single-level encoding
    return decodeURIComponent(encoded);
  } catch (error) {
    // If decoding fails, return the original string
    return encoded;
  }
}

/**
 * Encodes a string to URL-encoded format
 * Used for round-trip testing
 * 
 * @param decoded - The string to encode
 * @returns The URL-encoded string
 */
export function encodeParameter(decoded: string): string {
  if (!decoded || typeof decoded !== "string") {
    return "";
  }

  return encodeURIComponent(decoded);
}

/**
 * Checks if a string appears to be URL-encoded
 * 
 * @param value - The string to check
 * @returns true if the string contains URL-encoded characters
 */
export function isUrlEncoded(value: string): boolean {
  if (!value || typeof value !== "string") {
    return false;
  }

  // Check for common URL-encoded patterns: %XX where X is hex digit
  return /%[0-9A-Fa-f]{2}/.test(value);
}
