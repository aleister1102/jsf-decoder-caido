/**
 * JSF Detection Utilities
 * Detects JavaServer Faces (JSF) requests based on parameter patterns
 * Requirements: 1.1, 1.2, 1.3
 */

import { parseJsfBody } from "./parser";
import type { JsfDetectionResult } from "../types";
import { detectImplementation } from "./annotations";

/**
 * Standard JSF framework parameters that indicate a JSF request
 */
const STANDARD_JSF_PARAMS = [
  "javax.faces.partial.ajax",
  "javax.faces.source",
  "javax.faces.partial.execute",
  "javax.faces.partial.render",
  "javax.faces.behavior.event",
  "javax.faces.partial.event",
  "javax.faces.ViewState",
  "javax.faces.ClientWindow",
  "javax.faces.FormSignature",
];

/**
 * JSF version indicators based on parameter presence
 */
const VERSION_INDICATORS: Record<string, string> = {
  "javax.faces.ClientWindow": "JSF 2.2+ (Multi-window support)",
  "javax.faces.FormSignature": "JSF 2.2+ (CSRF protection)",
  "jffi": "JSF 2.2+ (Faces Flow)",
  "javax.faces.partial.ajax": "JSF 2.0+ (AJAX support)",
  "javax.faces.ViewState": "JSF 1.0+ (Core framework)",
};

/**
 * Checks if a request is a JSF request by examining the body for JSF indicators
 * 
 * @param raw - The raw HTTP request string
 * @returns true if the request appears to be a JSF request
 */
export function isJsfRequest(raw: string): boolean {
  const result = detectJsf(raw);
  return result.isJsf;
}

/**
 * Detects JSF requests and returns detailed detection information
 * 
 * Looks for:
 * 1. Parameters starting with "javax.faces."
 * 2. Parameters ending with "_SUBMIT"
 * 3. JSF version indicators
 * 4. Implementation-specific parameters
 * 
 * @param raw - The raw HTTP request string
 * @returns JsfDetectionResult with detection status, confidence, and indicators
 */
export function detectJsf(raw: string): JsfDetectionResult {
  if (!raw || typeof raw !== "string") {
    return {
      isJsf: false,
      confidence: "low",
      indicators: [],
    };
  }

  const indicators: string[] = [];

  try {
    // Parse the request body to get parameters
    const parseResult = parseJsfBody(raw);
    const parameters = parseResult.parameters;

    if (parameters.length === 0) {
      return {
        isJsf: false,
        confidence: "low",
        indicators: [],
      };
    }

    const paramNames = parameters.map(p => p.decodedName);
    let hasStandardJsf = false;
    let hasAjax = false;
    let hasViewState = false;
    const versionFeatures: string[] = [];

    // Check for javax.faces.* parameters
    for (const param of parameters) {
      const decodedName = param.decodedName;

      // Check for standard JSF parameters
      if (decodedName.startsWith("javax.faces.")) {
        hasStandardJsf = true;
        indicators.push(`Standard JSF parameter: ${decodedName}`);
        
        // Track specific features
        if (decodedName === "javax.faces.partial.ajax") {
          hasAjax = true;
        }
        if (decodedName === "javax.faces.ViewState") {
          hasViewState = true;
        }
      }

      // Check for _SUBMIT suffix (form submission markers)
      if (decodedName.endsWith("_SUBMIT")) {
        indicators.push(`Form submission marker: ${decodedName}`);
      }

      // Check for version indicators
      for (const [key, version] of Object.entries(VERSION_INDICATORS)) {
        if (decodedName === key && !versionFeatures.includes(version)) {
          versionFeatures.push(version);
        }
      }
    }

    // Detect implementation
    const implementation = detectImplementation(paramNames);
    if (implementation) {
      indicators.push(`Implementation: ${implementation}`);
    }

    // Add version information
    if (versionFeatures.length > 0) {
      indicators.push(`Version features: ${versionFeatures.join(", ")}`);
    }

    // Add request type information
    if (hasAjax) {
      indicators.push("Request type: AJAX Partial Request");
    } else if (hasViewState) {
      indicators.push("Request type: Full Page Postback");
    }

    // Determine if this is a JSF request based on indicators
    const isJsf = indicators.length > 0;

    // Determine confidence level
    let confidence: "high" | "medium" | "low" = "low";
    if (isJsf) {
      // High confidence if we found standard JSF parameters
      confidence = hasStandardJsf ? "high" : "medium";
    }

    return {
      isJsf,
      confidence,
      indicators,
    };
  } catch (error) {
    // If parsing fails, return negative result
    return {
      isJsf: false,
      confidence: "low",
      indicators: [],
    };
  }
}
