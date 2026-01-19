/**
 * JSF Decoder Plugin Entry Point
 * Registers the JSF view mode with Caido across all surfaces
 * Requirements: 9.1, 9.2
 */

import type { Caido } from "@caido/sdk-frontend";
import { setCaido } from "./caido";
import { isJsfRequest } from "./lib/detector";
import JsfViewMode from "./views/JsfViewMode.vue";

/**
 * Plugin initialization function
 * Called by Caido when the plugin is loaded
 * 
 * @param caido - The Caido SDK instance
 */
export const init = (caido: Caido) => {
  // Store the Caido instance for global access
  setCaido(caido);

  // Define the condition function that determines when to show the JSF view mode
  // Handles various prop structures from different Caido surfaces
  const condition = (data: any): boolean => {
    // Try multiple possible locations for the raw request data
    const raw = data?.raw 
      || data?.request?.raw 
      || data?.data?.raw 
      || data?.value?.raw 
      || data?.item?.raw;
    
    if (!raw || typeof raw !== "string") {
      return false;
    }
    return isJsfRequest(raw);
  };

  // Define the view mode configuration
  const viewMode = {
    label: "JSF",
    view: { component: JsfViewMode },
    condition,
  };

  // Register the view mode across all Caido surfaces
  // httpHistory: The main request/response history view
  if (caido.httpHistory) {
    caido.httpHistory.addRequestViewMode(viewMode);
  }

  // replay: The replay/resend request view
  if (caido.replay) {
    caido.replay.addRequestViewMode(viewMode);
  }

  // search: The search results view
  if (caido.search) {
    caido.search.addRequestViewMode(viewMode);
  }

  // sitemap: The sitemap/site structure view
  if (caido.sitemap) {
    caido.sitemap.addRequestViewMode(viewMode);
  }
};
