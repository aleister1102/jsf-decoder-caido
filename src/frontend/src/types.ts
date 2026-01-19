/**
 * Type definitions for JSF Decoder plugin
 */

export type ParameterCategory =
  | "standard-jsf"
  | "component-id"
  | "viewstate"
  | "form-submit"
  | "custom";

export interface ParsedParameter {
  name: string;
  decodedName: string;
  value: string;
  decodedValue: string;
  category?: ParameterCategory;
}

export interface ParseResult {
  parameters: ParsedParameter[];
  rawBody: string;
}

export interface AnnotatedParameter extends ParsedParameter {
  annotation: string;
}

export interface ComponentIdLevel {
  id: string;
  type: "component" | "index" | "unknown";
  depth: number;
}

export interface ComponentIdParameter extends ParsedParameter {
  hierarchy: ComponentIdLevel[];
}

export interface ViewStateParameter extends ParsedParameter {
  encoding: "base64" | "encrypted" | "unknown";
  decodedContent: string | null;
  warnings: string[];
}

export interface CategorizedParameters {
  standardJsf: AnnotatedParameter[];
  componentIds: ComponentIdParameter[];
  viewState: ViewStateParameter | null;
  formSubmit: AnnotatedParameter[];
  custom: ParsedParameter[];
}

export interface ViewStateAnalysis {
  encoding: "base64" | "encrypted" | "unknown";
  decodedContent: string | null;
  isSerializedJava: boolean;
  warnings: string[];
}

export interface JsfDetectionResult {
  isJsf: boolean;
  confidence: "high" | "medium" | "low";
  indicators: string[];
}

export interface JsfParsedRequest {
  detection: JsfDetectionResult;
  categories: CategorizedParameters;
  stats: {
    totalParams: number;
    standardJsfCount: number;
    componentIdCount: number;
    customCount: number;
  };
}

export interface JsfDecoderSettings {
  expandedSections: string[];
  showVerbose: boolean;
}
