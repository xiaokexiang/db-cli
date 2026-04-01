import { ALL_TEMPLATES } from "./commands.js";

/**
 * Result of matching user input against a command template
 */
export interface MatchResult {
  /** The matched tool name */
  tool: string;
  /** Extracted parameters from the input */
  params: Record<string, string>;
  /** Confidence score (0-1) based on match quality */
  confidence: number;
  /** Parameters that are required but missing */
  missingParams: string[];
  /** Original matched pattern index */
  patternIndex: number;
}

/**
 * Command template interface for natural language parsing
 */
export interface CommandTemplate {
  /** Tool name to call */
  name: string;
  /** Array of regex patterns to match */
  patterns: RegExp[];
  /** Function to extract parameters from regex match */
  extractParams: (match: RegExpMatchArray) => Record<string, string>;
  /** List of required parameter names */
  requiredParams?: string[];
}

/**
 * Get all available command templates
 * @returns Array of all command templates
 */
export function getAllTemplates(): CommandTemplate[] {
  return ALL_TEMPLATES;
}

/**
 * Match user input against all command templates
 * @param input - User's natural language input
 * @returns MatchResult if matched, null otherwise
 */
export function matchUserIntent(input: string): MatchResult | null {
  const results: MatchResult[] = [];

  for (const template of ALL_TEMPLATES) {
    for (let i = 0; i < template.patterns.length; i++) {
      const pattern = template.patterns[i];
      // Reset lastIndex for global patterns
      pattern.lastIndex = 0;

      // Use exec() instead of match() to properly capture groups
      const match = pattern.exec(input);
      if (match) {
        const params = template.extractParams(match);
        const missingParams = template.requiredParams?.filter(
          (param) => !params[param] || params[param].trim() === ""
        ) || [];

        // Calculate confidence based on match quality
        const confidence = calculateConfidence(input, match, missingParams);

        results.push({
          tool: template.name,
          params,
          confidence,
          missingParams,
          patternIndex: i,
        });

        // Break after first pattern match for this template
        // (prefer first matching pattern)
        break;
      }
    }
  }

  if (results.length === 0) {
    return null;
  }

  // Return highest confidence match
  results.sort((a, b) => b.confidence - a.confidence);
  return results[0];
}

/**
 * Calculate confidence score for a match
 * Higher score = better match quality
 */
function calculateConfidence(
  input: string,
  match: RegExpMatchArray,
  missingParams: string[]
): number {
  let score = 1.0;

  // Reduce confidence for missing required params
  if (missingParams.length > 0) {
    score -= 0.3 * missingParams.length;
  }

  // Boost confidence if match covers most of the input
  const matchCoverage = match[0].length / input.length;
  if (matchCoverage > 0.8) {
    score += 0.1;
  } else if (matchCoverage < 0.3) {
    score -= 0.2;
  }

  // Boost confidence for exact pattern matches
  if (match.index === 0) {
    score += 0.05;
  }

  // Clamp to 0-1 range
  return Math.max(0, Math.min(1, score));
}

/**
 * Get a template by name
 * @param name - Template name to find
 * @returns The template or undefined if not found
 */
export function getTemplateByName(name: string): CommandTemplate | undefined {
  return ALL_TEMPLATES.find((t) => t.name === name);
}

/**
 * Validate that all required params are present
 * @param params - Parameters to validate
 * @param required - List of required parameter names
 * @returns Array of missing parameter names
 */
export function validateParams(
  params: Record<string, string>,
  required: string[]
): string[] {
  return required.filter((param) => !params[param] || params[param].trim() === "");
}
