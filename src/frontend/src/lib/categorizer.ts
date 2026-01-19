/**
 * JSF Parameter Categorizer
 * Groups parameters into categories based on their names and patterns
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
 */

import type {
  ParsedParameter,
  CategorizedParameters,
  AnnotatedParameter,
  ComponentIdParameter,
  ViewStateParameter,
  ComponentIdLevel,
  ViewStateAnalysis,
} from "../types";
import { getAnnotation, SUBMIT_ANNOTATION } from "./annotations";

/**
 * Placeholder for component ID parsing (implemented in task 5.1)
 * For now, returns empty hierarchy
 */
function parseComponentId(id: string): ComponentIdLevel[] {
  // This will be implemented in task 5.1
  // For now, return a simple structure
  return [
    {
      id,
      type: "unknown",
      depth: 0,
    },
  ];
}

/**
 * Placeholder for ViewState analysis (implemented in task 6.1)
 * For now, returns basic analysis
 */
function analyzeViewState(value: string): ViewStateAnalysis {
  // This will be implemented in task 6.1
  // For now, return a basic structure
  return {
    encoding: "unknown",
    decodedContent: null,
    isSerializedJava: false,
    warnings: [],
  };
}

/**
 * Check if a parameter name is a standard JSF parameter
 * Standard JSF parameters start with "javax.faces."
 * 
 * @param name - The parameter name to check
 * @returns true if it's a standard JSF parameter
 */
function isStandardJsfParameter(name: string): boolean {
  return name.startsWith("javax.faces.");
}

/**
 * Check if a parameter name is a component ID parameter
 * Component ID parameters contain "j_id_" pattern
 * 
 * @param name - The parameter name to check
 * @returns true if it's a component ID parameter
 */
function isComponentIdParameter(name: string): boolean {
  return name.includes("j_id_");
}

/**
 * Check if a parameter name is a form submission marker
 * Form submission markers end with "_SUBMIT"
 * 
 * @param name - The parameter name to check
 * @returns true if it's a form submission marker
 */
function isFormSubmitParameter(name: string): boolean {
  return name.endsWith("_SUBMIT");
}

/**
 * Check if a parameter is the ViewState parameter
 * 
 * @param name - The parameter name to check
 * @returns true if it's the ViewState parameter
 */
function isViewStateParameter(name: string): boolean {
  return name === "javax.faces.ViewState";
}

/**
 * Categorize a single parameter
 * 
 * @param param - The parameter to categorize
 * @returns The categorized parameter with appropriate type
 */
function categorizeParameter(
  param: ParsedParameter
): ParsedParameter | AnnotatedParameter | ComponentIdParameter | ViewStateParameter {
  const { decodedName } = param;

  // Check ViewState first (it's also a standard JSF parameter)
  if (isViewStateParameter(decodedName)) {
    const analysis = analyzeViewState(param.decodedValue);
    return {
      ...param,
      category: "viewstate",
      encoding: analysis.encoding,
      decodedContent: analysis.decodedContent,
      warnings: analysis.warnings,
    } as ViewStateParameter;
  }

  // Check standard JSF parameters
  if (isStandardJsfParameter(decodedName)) {
    const annotation = getAnnotation(decodedName);
    return {
      ...param,
      category: "standard-jsf",
      annotation: annotation || "",
    } as AnnotatedParameter;
  }

  // Check component ID parameters
  if (isComponentIdParameter(decodedName)) {
    const hierarchy = parseComponentId(decodedName);
    return {
      ...param,
      category: "component-id",
      hierarchy,
    } as ComponentIdParameter;
  }

  // Check form submission markers
  if (isFormSubmitParameter(decodedName)) {
    return {
      ...param,
      category: "form-submit",
      annotation: SUBMIT_ANNOTATION,
    } as AnnotatedParameter;
  }

  // Default to custom
  return {
    ...param,
    category: "custom",
  };
}

/**
 * Categorize all parameters from a parsed JSF request
 * Groups parameters into categories: standard-jsf, component-id, viewstate, form-submit, custom
 * 
 * @param params - Array of parsed parameters
 * @returns CategorizedParameters with parameters grouped by category
 */
export function categorizeParameters(
  params: ParsedParameter[]
): CategorizedParameters {
  const result: CategorizedParameters = {
    standardJsf: [],
    componentIds: [],
    viewState: null,
    formSubmit: [],
    custom: [],
  };

  for (const param of params) {
    const categorized = categorizeParameter(param);

    switch (categorized.category) {
      case "standard-jsf":
        result.standardJsf.push(categorized as AnnotatedParameter);
        break;
      case "component-id":
        result.componentIds.push(categorized as ComponentIdParameter);
        break;
      case "viewstate":
        result.viewState = categorized as ViewStateParameter;
        break;
      case "form-submit":
        result.formSubmit.push(categorized as AnnotatedParameter);
        break;
      case "custom":
        result.custom.push(categorized as ParsedParameter);
        break;
    }
  }

  return result;
}
