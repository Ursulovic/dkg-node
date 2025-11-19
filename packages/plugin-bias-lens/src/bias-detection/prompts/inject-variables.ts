/**
 * Injects variables into a prompt template.
 * Template syntax: {{variableName}}
 *
 * @example
 * injectPromptVariables("Max: {{max}}", { max: 5 })
 * // Returns: "Max: 5"
 */
export function injectPromptVariables(
  template: string,
  variables: Record<string, string | number | boolean>,
): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{{${key}}}`, "g");
    result = result.replace(regex, String(value));
  }
  return result;
}

/**
 * Configuration variables for bias detection prompts
 */
export interface BiasDetectionPromptVariables
  extends Record<string, string | number | boolean> {
  // Empty for now - easy to extend with variables in future if needed
}
