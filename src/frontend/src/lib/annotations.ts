/**
 * JSF Parameter Annotations
 * Provides human-readable descriptions for standard JSF parameters
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6
 */

/**
 * Annotations for standard JSF parameters
 * Maps parameter names to their descriptions with detailed explanations
 */
export const JSF_ANNOTATIONS: Record<string, string> = {
  // AJAX and Partial Request Parameters
  "javax.faces.partial.ajax": "Indicates AJAX partial request - When 'true', only specified components are processed and rendered",
  "javax.faces.source": "Component that triggered the request - Client ID of the component that initiated the AJAX request",
  "javax.faces.partial.execute": "Components to process on server - Space-separated list of component IDs to execute during Apply Request Values, Process Validations, and Update Model phases",
  "javax.faces.partial.render": "Components to re-render on client - Space-separated list of component IDs whose markup should be returned in the response",
  "javax.faces.behavior.event": "Client behavior event type - The name of the behavior event that triggered this request (e.g., 'action', 'valueChange', 'click')",
  "javax.faces.partial.event": "Partial request event type - The DOM event that triggered the partial request (e.g., 'click', 'change', 'blur')",
  
  // ViewState Parameter
  "javax.faces.ViewState": "Serialized server-side state - Contains the component tree state, can be stateful (server-side) or stateless (client-side encrypted)",
  
  // Form and Navigation Parameters
  "javax.faces.FormSignature": "Form signature for CSRF protection - Cryptographic signature to prevent Cross-Site Request Forgery attacks",
  "javax.faces.ClientWindow": "Client window identifier - Tracks browser tabs/windows for multi-window support in JSF 2.2+",
  "javax.faces.encodedURL": "Encoded URL for navigation - URL with view parameters and conversation state encoded",
  
  // Resource Handling
  "javax.faces.resource": "Resource identifier - Identifies a JSF resource (CSS, JS, images) to be served by the ResourceHandler",
  "ln": "Resource library name - Groups related resources together (e.g., 'primefaces', 'css', 'js')",
  "v": "Resource version - Version number for cache busting and resource versioning",
  
  // Validation and Conversion
  "javax.faces.validator.REQUIRED": "Required field validation - Indicates a required field validation message",
  "javax.faces.converter.STRING": "String converter - Converts between String and Object representations",
  "javax.faces.converter.DateTimeConverter.PATTERN": "Date/time pattern - Format pattern for date/time conversion",
  
  // Flow and Conversation
  "jffi": "Faces Flow instance identifier - Tracks the current Faces Flow instance (JSF 2.2+)",
  "jffi.token": "Flow token - Security token for Faces Flow transitions",
  "cid": "Conversation ID - CDI conversation identifier for stateful conversations",
  
  // PrimeFaces Extensions (common in JSF apps)
  "primefaces.resetvalues": "PrimeFaces reset values - Resets input components to their initial values",
  "primefaces.ignoreautoupdate": "PrimeFaces ignore auto-update - Prevents automatic update of components",
};

/**
 * Annotation for form submission marker parameters
 */
export const SUBMIT_ANNOTATION = "Form submission marker - Indicates which form was submitted";

/**
 * Security-related parameter patterns
 */
export const SECURITY_INDICATORS: Record<string, string> = {
  "ViewState": "⚠️ Security: ViewState may contain sensitive data if not encrypted",
  "FormSignature": "✓ Security: CSRF protection enabled",
  "ClientWindow": "ℹ️ Multi-window support enabled (JSF 2.2+)",
};

/**
 * JSF Implementation indicators
 */
export const IMPLEMENTATION_INDICATORS: Record<string, string> = {
  "com.sun.faces": "Mojarra (Oracle/Sun JSF Reference Implementation)",
  "org.apache.myfaces": "Apache MyFaces",
  "org.primefaces": "PrimeFaces Component Library",
  "org.richfaces": "RichFaces Component Library",
  "org.icefaces": "ICEfaces Component Library",
};

/**
 * Get annotation for a parameter name
 * 
 * @param paramName - The parameter name to look up
 * @returns The annotation string, or undefined if not found
 */
export function getAnnotation(paramName: string): string | undefined {
  return JSF_ANNOTATIONS[paramName];
}

/**
 * Get security indicator for a parameter
 * 
 * @param paramName - The parameter name to check
 * @returns Security indicator string, or undefined if not security-related
 */
export function getSecurityIndicator(paramName: string): string | undefined {
  for (const [key, value] of Object.entries(SECURITY_INDICATORS)) {
    if (paramName.includes(key)) {
      return value;
    }
  }
  return undefined;
}

/**
 * Detect JSF implementation from parameter names
 * 
 * @param paramNames - Array of parameter names
 * @returns Implementation name, or undefined if not detected
 */
export function detectImplementation(paramNames: string[]): string | undefined {
  for (const paramName of paramNames) {
    for (const [key, value] of Object.entries(IMPLEMENTATION_INDICATORS)) {
      if (paramName.includes(key)) {
        return value;
      }
    }
  }
  return undefined;
}
