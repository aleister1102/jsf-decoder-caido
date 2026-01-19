/**
 * Export utilities for JSF Decoder
 * Provides functions to export parsed JSF requests as JSON and formatted text
 * Requirements: 8.1, 8.2, 8.3
 */

import type {
  JsfParsedRequest,
  AnnotatedParameter,
  ComponentIdParameter,
  ViewStateParameter,
  ParsedParameter,
} from "../types";

/**
 * Export parsed JSF request as formatted JSON
 * Includes category groupings and annotations
 * 
 * @param parsed - The parsed JSF request
 * @returns JSON string representation
 */
export function exportAsJson(parsed: JsfParsedRequest): string {
  const exportData = {
    detection: {
      isJsf: parsed.detection.isJsf,
      confidence: parsed.detection.confidence,
      indicators: parsed.detection.indicators,
    },
    statistics: {
      totalParameters: parsed.stats.totalParams,
      standardJsfCount: parsed.stats.standardJsfCount,
      componentIdCount: parsed.stats.componentIdCount,
      customCount: parsed.stats.customCount,
    },
    parameters: {
      standardJsf: parsed.categories.standardJsf.map((param) =>
        formatAnnotatedParameter(param)
      ),
      componentIds: parsed.categories.componentIds.map((param) =>
        formatComponentIdParameter(param)
      ),
      viewState: parsed.categories.viewState
        ? formatViewStateParameter(parsed.categories.viewState)
        : null,
      formSubmit: parsed.categories.formSubmit.map((param) =>
        formatAnnotatedParameter(param)
      ),
      custom: parsed.categories.custom.map((param) =>
        formatParsedParameter(param)
      ),
    },
  };

  return JSON.stringify(exportData, null, 2);
}

/**
 * Export parsed JSF request as formatted text
 * Includes category groupings and annotations in human-readable format
 * 
 * @param parsed - The parsed JSF request
 * @returns Formatted text representation
 */
export function exportAsText(parsed: JsfParsedRequest): string {
  const lines: string[] = [];

  // Header
  lines.push("=== JSF Request Analysis ===\n");

  // Detection info
  lines.push("Detection:");
  lines.push(`  JSF Request: ${parsed.detection.isJsf ? "Yes" : "No"}`);
  lines.push(`  Confidence: ${parsed.detection.confidence}`);
  if (parsed.detection.indicators.length > 0) {
    lines.push("  Indicators:");
    for (const indicator of parsed.detection.indicators) {
      lines.push(`    - ${indicator}`);
    }
  }
  lines.push("");

  // Statistics
  lines.push("Statistics:");
  lines.push(`  Total Parameters: ${parsed.stats.totalParams}`);
  lines.push(`  Standard JSF: ${parsed.stats.standardJsfCount}`);
  lines.push(`  Component IDs: ${parsed.stats.componentIdCount}`);
  lines.push(`  Custom: ${parsed.stats.customCount}`);
  lines.push("");

  // Standard JSF Parameters
  if (parsed.categories.standardJsf.length > 0) {
    lines.push("Standard JSF Parameters:");
    for (const param of parsed.categories.standardJsf) {
      lines.push(`  ${param.decodedName}`);
      lines.push(`    Value: ${param.decodedValue}`);
      if (param.annotation) {
        lines.push(`    Purpose: ${param.annotation}`);
      }
    }
    lines.push("");
  }

  // Component ID Parameters
  if (parsed.categories.componentIds.length > 0) {
    lines.push("Component ID Parameters:");
    for (const param of parsed.categories.componentIds) {
      lines.push(`  ${param.decodedName}`);
      lines.push(`    Value: ${param.decodedValue}`);
      if (param.hierarchy && param.hierarchy.length > 0) {
        lines.push("    Hierarchy:");
        for (const level of param.hierarchy) {
          const indent = "      " + "  ".repeat(level.depth);
          lines.push(`${indent}[${level.type}] ${level.id}`);
        }
      }
    }
    lines.push("");
  }

  // ViewState Parameter
  if (parsed.categories.viewState) {
    const vs = parsed.categories.viewState;
    lines.push("ViewState Parameter:");
    lines.push(`  Name: ${vs.decodedName}`);
    lines.push(`  Encoding: ${vs.encoding}`);
    if (vs.decodedContent) {
      lines.push(`  Decoded Content: ${vs.decodedContent.substring(0, 100)}${vs.decodedContent.length > 100 ? "..." : ""}`);
    }
    if (vs.warnings.length > 0) {
      lines.push("  Warnings:");
      for (const warning of vs.warnings) {
        lines.push(`    ⚠ ${warning}`);
      }
    }
    lines.push("");
  }

  // Form Submit Parameters
  if (parsed.categories.formSubmit.length > 0) {
    lines.push("Form Submission Markers:");
    for (const param of parsed.categories.formSubmit) {
      lines.push(`  ${param.decodedName}`);
      lines.push(`    Value: ${param.decodedValue}`);
      if (param.annotation) {
        lines.push(`    Purpose: ${param.annotation}`);
      }
    }
    lines.push("");
  }

  // Custom Parameters
  if (parsed.categories.custom.length > 0) {
    lines.push("Custom Parameters:");
    for (const param of parsed.categories.custom) {
      lines.push(`  ${param.decodedName}`);
      lines.push(`    Value: ${param.decodedValue}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Format an annotated parameter for JSON export
 */
function formatAnnotatedParameter(param: AnnotatedParameter): Record<string, unknown> {
  return {
    name: param.decodedName,
    value: param.decodedValue,
    annotation: param.annotation,
  };
}

/**
 * Format a component ID parameter for JSON export
 */
function formatComponentIdParameter(param: ComponentIdParameter): Record<string, unknown> {
  return {
    name: param.decodedName,
    value: param.decodedValue,
    hierarchy: param.hierarchy.map((level) => ({
      id: level.id,
      type: level.type,
      depth: level.depth,
    })),
  };
}

/**
 * Format a ViewState parameter for JSON export
 */
function formatViewStateParameter(param: ViewStateParameter): Record<string, unknown> {
  return {
    name: param.decodedName,
    value: param.decodedValue,
    encoding: param.encoding,
    decodedContent: param.decodedContent,
    warnings: param.warnings,
  };
}

/**
 * Format a parsed parameter for JSON export
 */
function formatParsedParameter(param: ParsedParameter): Record<string, unknown> {
  return {
    name: param.decodedName,
    value: param.decodedValue,
  };
}
