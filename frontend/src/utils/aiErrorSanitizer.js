/**
 * Centralized AI & Backend Error Sanitizer (Frontend).
 * Transforms raw provider errors (e.g. Gemini 503 JSON blobs, 429 rate limits),
 * network timeouts, and internal exceptions into clean, human-readable messages.
 */
export function formatUserFriendlyAiError(rawError) {
  if (!rawError) {
    return 'The AI generation request could not be completed. Please try again.';
  }

  const rawStr = typeof rawError === 'string' ? rawError : (rawError.message || String(rawError));

  // 1. Try parsing embedded JSON error payloads (e.g. Google Gemini 503/429 JSON)
  let parsedMsg = null;
  let parsedCode = null;
  const jsonMatch = rawStr.match(/\{[\s\S]*"error"[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed?.error) {
        parsedMsg = parsed.error.message;
        parsedCode = parsed.error.code || parsed.error.status;
      }
    } catch {
      // ignore JSON parse failure
    }
  }

  const checkText = `${parsedMsg || ''} ${parsedCode || ''} ${rawStr}`.toLowerCase();

  // High demand / 503 / Service Unavailable
  if (
    checkText.includes('503') ||
    checkText.includes('high demand') ||
    checkText.includes('unavailable') ||
    checkText.includes('overloaded') ||
    checkText.includes('temporarily unavailable')
  ) {
    return 'The AI service is currently experiencing temporary high demand. Please try again in a few moments.';
  }

  // Quota / Rate limit / 429
  if (
    checkText.includes('429') ||
    checkText.includes('quota') ||
    checkText.includes('resource_exhausted') ||
    checkText.includes('too many requests') ||
    checkText.includes('rate limit')
  ) {
    return 'AI generation request limit reached. Please wait a moment before trying again.';
  }

  // Timeout & network interruptions
  if (
    checkText.includes('timed out') ||
    checkText.includes('timeout') ||
    checkText.includes('etimedout') ||
    checkText.includes('econnreset') ||
    checkText.includes('esockettimedout') ||
    checkText.includes('network')
  ) {
    return 'The AI request timed out due to a network interruption. Please click Retry Generation.';
  }

  // Content safety policy filters
  if (
    checkText.includes('safety') ||
    checkText.includes('blocked') ||
    checkText.includes('harm_category') ||
    checkText.includes('policy')
  ) {
    return 'Generation was halted by AI content safety guidelines. Please refine your project description and retry.';
  }

  // JSON parsing or Schema verification
  if (
    checkText.includes('valid json') ||
    checkText.includes('parse') ||
    checkText.includes('schema validation') ||
    checkText.includes('syntaxerror')
  ) {
    return 'The AI response could not be verified against the project schema. Please click Retry Generation.';
  }

  // Database / RTDB
  if (
    checkText.includes('set failed') ||
    checkText.includes('undefined in property') ||
    checkText.includes('databaseurl') ||
    checkText.includes('permission_denied')
  ) {
    return 'Blueprint could not be saved to the workspace database. Previous version preserved. Please retry.';
  }

  // Internal exceptions (ReferenceError, TypeError, etc.)
  if (
    checkText.includes('referenceerror') ||
    checkText.includes('typeerror') ||
    checkText.includes('is not defined') ||
    checkText.includes('cannot read property')
  ) {
    return 'An unexpected processing error occurred. Please click Retry Generation.';
  }

  // If already clean prose without JSON or raw technical prefixes, return clean text
  if (!rawStr.includes('{') && !rawStr.includes('[') && !rawStr.toLowerCase().includes('failed:')) {
    return rawStr;
  }

  // Fallback clean message
  return 'Blueprint generation did not complete. Please click Retry Generation to try again.';
}
