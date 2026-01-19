/**
 * JSF Body Parser
 * Extracts and decodes URL-encoded form parameters from HTTP request bodies
 * Requirements: 2.1, 2.2
 */

import { decodeParameter } from "./decoder";
import type { ParsedParameter, ParseResult } from "../types";

/**
 * Extracts the body from a raw HTTP request
 * Handles the separation of headers and body
 * 
 * @param raw - The raw HTTP request string
 * @returns The request body, or empty string if not found
 */
export function extractBodyFromRaw(raw: string): string {
  if (!raw || typeof raw !== "string") {
    return "";
  }

  // Split by double CRLF or double LF to separate headers from body
  const crlfIndex = raw.indexOf("\r\n\r\n");
  const lfIndex = raw.indexOf("\n\n");

  let bodyStartIndex = -1;

  if (crlfIndex !== -1) {
    bodyStartIndex = crlfIndex + 4;
  } else if (lfIndex !== -1) {
    bodyStartIndex = lfIndex + 2;
  }

  if (bodyStartIndex === -1) {
    return "";
  }

  return raw.substring(bodyStartIndex);
}

/**
 * Parses URL-encoded form parameters into key-value pairs
 * 
 * @param body - The URL-encoded form body
 * @returns Array of parsed parameters
 */
export function parseUrlEncodedBody(body: string): ParsedParameter[] {
  if (!body || typeof body !== "string") {
    return [];
  }

  const parameters: ParsedParameter[] = [];

  // Split by & to get individual parameters
  const pairs = body.split("&");

  for (const pair of pairs) {
    if (!pair) continue;

    // Split by first = to separate name and value
    const eqIndex = pair.indexOf("=");
    let name: string;
    let value: string;

    if (eqIndex === -1) {
      // Parameter with no value
      name = pair;
      value = "";
    } else {
      name = pair.substring(0, eqIndex);
      value = pair.substring(eqIndex + 1);
    }

    // Decode both name and value
    const decodedName = decodeParameter(name);
    const decodedValue = decodeParameter(value);

    parameters.push({
      name,
      decodedName,
      value,
      decodedValue,
    });
  }

  return parameters;
}

/**
 * Parses a JSF request body
 * Extracts body from raw HTTP request and parses URL-encoded parameters
 * 
 * @param body - Either raw HTTP request or just the body content
 * @returns ParseResult containing parsed parameters and raw body
 */
export function parseJsfBody(body: string): ParseResult {
  if (!body || typeof body !== "string") {
    return {
      parameters: [],
      rawBody: "",
    };
  }

  // Try to extract body from raw HTTP request
  // If it looks like a full HTTP request (has headers), extract the body
  let actualBody = body;
  if (body.includes("\r\n\r\n") || body.includes("\n\n")) {
    actualBody = extractBodyFromRaw(body);
  }

  // Parse the URL-encoded parameters
  const parameters = parseUrlEncodedBody(actualBody);

  return {
    parameters,
    rawBody: actualBody,
  };
}
