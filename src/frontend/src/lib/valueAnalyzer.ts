/**
 * JSF Value Analyzer
 * Analyzes and explains cryptic JSF parameter values
 */

export interface ValueAnalysis {
  type: string;
  explanation: string;
  details?: string[];
  warning?: string;
}

/**
 * Analyze a JSF parameter value and provide explanation
 * 
 * @param paramName - The parameter name
 * @param value - The parameter value to analyze
 * @returns ValueAnalysis with type, explanation, and details
 */
export function analyzeValue(paramName: string, value: string): ValueAnalysis | null {
  if (!value) {
    return null;
  }

  // Analyze based on parameter name
  switch (paramName) {
    case "javax.faces.partial.ajax":
      return analyzeAjaxValue(value);
    
    case "javax.faces.partial.execute":
    case "javax.faces.partial.render":
      return analyzeComponentList(value, paramName);
    
    case "javax.faces.source":
      return analyzeComponentId(value);
    
    case "javax.faces.ViewState":
      return analyzeViewState(value);
    
    case "javax.faces.ClientWindow":
      return analyzeClientWindow(value);
    
    default:
      // Check for component ID patterns
      if (value.includes("j_id") || value.includes(":")) {
        return analyzeComponentId(value);
      }
      
      // Check for encoded data
      if (isBase64(value)) {
        return analyzeBase64Value(value);
      }
      
      return null;
  }
}

/**
 * Analyze AJAX parameter value
 */
function analyzeAjaxValue(value: string): ValueAnalysis {
  const isAjax = value.toLowerCase() === "true";
  return {
    type: "Boolean Flag",
    explanation: isAjax 
      ? "This is an AJAX partial request - only specified components will be processed and updated"
      : "This is a full page postback - entire page will be processed and refreshed",
    details: isAjax ? [
      "Only components in 'execute' list are processed",
      "Only components in 'render' list are updated in response",
      "Faster than full page refresh",
      "Network traffic is reduced"
    ] : [
      "All components on the page are processed",
      "Entire page is refreshed",
      "ViewState is updated for all components"
    ]
  };
}

/**
 * Analyze component list (execute/render)
 */
function analyzeComponentList(value: string, paramName: string): ValueAnalysis {
  const components = value.split(/\s+/).filter(c => c.length > 0);
  const isExecute = paramName.includes("execute");
  
  const specialKeywords: Record<string, string> = {
    "@all": "All components on the page",
    "@form": "All components in the current form",
    "@this": "Only the component that triggered the request",
    "@none": "No components"
  };

  const details: string[] = [];
  const regularComponents: string[] = [];

  for (const comp of components) {
    if (specialKeywords[comp]) {
      details.push(`${comp} → ${specialKeywords[comp]}`);
    } else {
      regularComponents.push(comp);
    }
  }

  if (regularComponents.length > 0) {
    details.push(`Specific components: ${regularComponents.length} component(s)`);
    regularComponents.forEach(comp => {
      details.push(`  • ${comp}`);
    });
  }

  return {
    type: "Component List",
    explanation: isExecute
      ? `Specifies which components to process during server-side lifecycle (${components.length} item(s))`
      : `Specifies which components to update in the client after processing (${components.length} item(s))`,
    details
  };
}

/**
 * Analyze component ID
 */
function analyzeComponentId(value: string): ValueAnalysis {
  const parts = value.split(":");
  const details: string[] = [];

  if (parts.length > 1) {
    details.push(`Component hierarchy depth: ${parts.length} level(s)`);
    parts.forEach((part, idx) => {
      if (part.startsWith("j_id")) {
        details.push(`  Level ${idx + 1}: ${part} (auto-generated ID)`);
      } else {
        details.push(`  Level ${idx + 1}: ${part} (developer-defined ID)`);
      }
    });
  } else if (value.startsWith("j_id")) {
    details.push("Auto-generated component ID (no explicit ID set by developer)");
  } else {
    details.push("Developer-defined component ID");
  }

  return {
    type: "Component Identifier",
    explanation: "Identifies a specific JSF component in the component tree",
    details
  };
}

/**
 * Analyze ViewState value
 */
function analyzeViewState(value: string): ValueAnalysis {
  const details: string[] = [];
  let warning: string | undefined;

  // Check encoding
  if (isBase64(value)) {
    details.push("Encoding: Base64");
    
    // Try to determine if it's encrypted
    if (value.length > 100) {
      details.push("Likely encrypted or compressed");
      details.push("Contains serialized component tree state");
    } else {
      details.push("Short ViewState - possibly stateless mode");
      warning = "Short ViewState may indicate client-side state storage";
    }
  } else if (value.startsWith("stateless")) {
    details.push("Stateless mode enabled");
    details.push("No server-side state stored");
    details.push("State is reconstructed on each request");
  } else {
    details.push("Custom ViewState format");
  }

  // Size analysis
  const sizeKB = (value.length / 1024).toFixed(2);
  details.push(`Size: ${value.length} bytes (${sizeKB} KB)`);
  
  if (value.length > 10000) {
    warning = "Large ViewState detected - may impact performance and bandwidth";
  }

  return {
    type: "ViewState",
    explanation: "Contains the serialized state of the JSF component tree",
    details,
    warning
  };
}

/**
 * Analyze ClientWindow value
 */
function analyzeClientWindow(value: string): ValueAnalysis {
  return {
    type: "Client Window ID",
    explanation: "Unique identifier for this browser tab/window",
    details: [
      "Enables multi-window support (JSF 2.2+)",
      "Tracks state separately for each browser tab",
      "Prevents state conflicts between tabs",
      `Window ID: ${value}`
    ]
  };
}

/**
 * Analyze Base64 encoded value
 */
function analyzeBase64Value(value: string): ValueAnalysis {
  const details: string[] = [];
  
  try {
    const decoded = atob(value);
    details.push(`Decoded length: ${decoded.length} bytes`);
    
    // Check if it's printable text
    if (/^[\x20-\x7E\s]*$/.test(decoded)) {
      details.push("Contains readable text data");
      if (decoded.length < 200) {
        details.push(`Decoded value: ${decoded}`);
      }
    } else {
      details.push("Contains binary or encrypted data");
    }
  } catch (e) {
    details.push("Not valid Base64 or contains special encoding");
  }

  return {
    type: "Base64 Encoded",
    explanation: "Value is Base64 encoded",
    details
  };
}

/**
 * Check if a string is Base64 encoded
 */
function isBase64(str: string): boolean {
  if (!str || str.length < 4) {
    return false;
  }
  
  // Base64 pattern: alphanumeric + / + = padding
  const base64Pattern = /^[A-Za-z0-9+/]+=*$/;
  return base64Pattern.test(str) && str.length % 4 === 0;
}

/**
 * Get a human-readable summary of a value
 * 
 * @param value - The value to summarize
 * @returns A short summary string
 */
export function getValueSummary(value: string): string {
  if (!value) {
    return "Empty value";
  }

  if (value.length < 50) {
    return value;
  }

  // Check type
  if (isBase64(value)) {
    return `Base64 encoded (${value.length} chars)`;
  }

  if (value.includes(":")) {
    const parts = value.split(":");
    return `Component path (${parts.length} levels)`;
  }

  return `${value.substring(0, 47)}...`;
}
