/**
 * Caido SDK Singleton
 * Provides global access to the Caido SDK instance
 * Requirements: 9.1
 */

import type { Caido } from "@caido/sdk-frontend";

let caido: Caido | null = null;

/**
 * Sets the Caido SDK instance for global access
 * Called during plugin initialization
 * 
 * @param instance - The Caido SDK instance
 */
export function setCaido(instance: Caido): void {
  caido = instance;
}

/**
 * Gets the Caido SDK instance
 * 
 * @returns The Caido SDK instance
 * @throws Error if Caido has not been initialized
 */
export function getCaido(): Caido {
  if (!caido) {
    throw new Error("Caido SDK not initialized. Call setCaido() first.");
  }
  return caido;
}
