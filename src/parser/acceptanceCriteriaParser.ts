import { AcceptanceCriterion, ParsedAcceptanceCriteria } from '../types';

/**
 * Generates a simple unique ID without external dependencies
 */
function generateId(): string {
  return `ac-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * AcceptanceCriteriaParser
 *
 * Parses acceptance criteria text in various formats:
 * - Given/When/Then (Gherkin-style)
 * - Numbered list format
 * - Bullet point format
 * - Free-form text
 */
export class AcceptanceCriteriaParser {
  /**
   * Parse acceptance criteria from raw text input
   */
  parse(input: string, title: string = 'Untitled'): ParsedAcceptanceCriteria {
    const normalizedInput = this.normalizeText(input);
    let criteria: AcceptanceCriterion[];

    // Try parsing as Gherkin (Given/When/Then) first
    criteria = this.parseGherkinFormat(normalizedInput);

    // If no Gherkin found, try numbered/bullet format
    if (criteria.length === 0) {
      criteria = this.parseListFormat(normalizedInput);
    }

    // If still nothing, parse as free-form text
    if (criteria.length === 0) {
      criteria = this.parseFreeFormText(normalizedInput);
    }

    // Extract tags from criteria
    criteria = criteria.map(c => ({
      ...c,
      tags: this.extractTags(c.rawText),
    }));

    return {
      title,
      description: `Parsed acceptance criteria for: ${title}`,
      criteria,
      metadata: {
        source: 'text-input',
        parsedAt: new Date().toISOString(),
        totalCriteria: criteria.length,
      },
    };
  }

  /**
   * Parse Gherkin-style Given/When/Then format
   */
  private parseGherkinFormat(text: string): AcceptanceCriterion[] {
    const criteria: AcceptanceCriterion[] = [];

    // Match scenario blocks
    const scenarioPattern =
      /(?:Scenario[:\s]*(.+?)?\n)?[\s]*Given\s+(.+?)[\s]*When\s+(.+?)[\s]*Then\s+(.+?)(?=(?:\n\s*(?:Scenario|Given|$)))/gis;

    let match: RegExpExecArray | null;
    while ((match = scenarioPattern.exec(text)) !== null) {
      criteria.push({
        id: generateId(),
        given: match[2].trim(),
        when: match[3].trim(),
        then: match[4].trim(),
        rawText: match[0].trim(),
        tags: [],
      });
    }

    // Also try simpler Given/When/Then blocks without Scenario prefix
    if (criteria.length === 0) {
      const simpleGwtPattern =
        /Given\s+(.+?)[\s]*When\s+(.+?)[\s]*Then\s+(.+?)(?=(?:\n\s*Given|\n\s*$|$))/gis;

      while ((match = simpleGwtPattern.exec(text)) !== null) {
        criteria.push({
          id: generateId(),
          given: match[1].trim(),
          when: match[2].trim(),
          then: match[3].trim(),
          rawText: match[0].trim(),
          tags: [],
        });
      }
    }

    return criteria;
  }

  /**
   * Parse numbered or bullet-point list format
   */
  private parseListFormat(text: string): AcceptanceCriterion[] {
    const criteria: AcceptanceCriterion[] = [];

    // Split by numbered items (1. 2. 3.) or bullets (- * •)
    const listItemPattern = /(?:^|\n)\s*(?:\d+[.)]\s*|[-*•]\s*)(.+?)(?=(?:\n\s*(?:\d+[.)]\s*|[-*•]\s*)|\s*$))/gs;

    let match: RegExpExecArray | null;
    while ((match = listItemPattern.exec(text)) !== null) {
      const itemText = match[1].trim();
      if (itemText.length > 10) {
        // Filter out very short items
        const parsed = this.convertToGWT(itemText);
        criteria.push({
          id: generateId(),
          ...parsed,
          rawText: itemText,
          tags: [],
        });
      }
    }

    return criteria;
  }

  /**
   * Parse free-form text by splitting into sentences/paragraphs
   */
  private parseFreeFormText(text: string): AcceptanceCriterion[] {
    const criteria: AcceptanceCriterion[] = [];

    // Split by sentences or paragraph breaks
    const sentences = text
      .split(/[.!?]\s+|\n\n+/)
      .map(s => s.trim())
      .filter(s => s.length > 15);

    for (const sentence of sentences) {
      const parsed = this.convertToGWT(sentence);
      criteria.push({
        id: generateId(),
        ...parsed,
        rawText: sentence,
        tags: [],
      });
    }

    return criteria;
  }

  /**
   * Convert a plain text requirement into Given/When/Then structure
   */
  private convertToGWT(text: string): { given: string; when: string; then: string } {
    // Try to detect implicit structure
    const shouldPattern = /(.+?)\s+should\s+(.+)/i;
    const whenPattern = /when\s+(.+?),?\s+(?:then\s+)?(.+)/i;
    const ifPattern = /if\s+(.+?),?\s+(?:then\s+)?(.+)/i;
    const userPattern = /(?:as a|the)\s+(.+?)\s+(?:can|should|must|will|is able to)\s+(.+)/i;

    let given = 'the system is in its default state';
    let when = '';
    let then = '';

    const shouldMatch = text.match(shouldPattern);
    const whenMatch = text.match(whenPattern);
    const ifMatch = text.match(ifPattern);
    const userMatch = text.match(userPattern);

    if (whenMatch) {
      when = whenMatch[1].trim();
      then = whenMatch[2].trim();
    } else if (ifMatch) {
      given = ifMatch[1].trim();
      when = 'the condition is met';
      then = ifMatch[2].trim();
    } else if (shouldMatch) {
      when = `interacting with ${shouldMatch[1].trim()}`;
      then = shouldMatch[2].trim();
    } else if (userMatch) {
      given = `a ${userMatch[1].trim()} is authenticated`;
      when = 'they perform the action';
      then = userMatch[2].trim();
    } else {
      // Fallback: treat entire text as the "then" (expected behavior)
      when = 'the user performs the described action';
      then = text;
    }

    return { given, when, then };
  }

  /**
   * Extract tags from criterion text for categorization
   */
  private extractTags(text: string): string[] {
    const tags: string[] = [];
    const lowerText = text.toLowerCase();

    // Detect category-related keywords
    const tagPatterns: Record<string, string[]> = {
      authentication: ['login', 'logout', 'auth', 'password', 'credential', 'session', 'token'],
      validation: ['valid', 'invalid', 'format', 'required', 'mandatory', 'pattern'],
      error_handling: ['error', 'fail', 'exception', 'timeout', 'unavailable'],
      performance: ['fast', 'slow', 'response time', 'load', 'performance', 'concurrent'],
      security: ['secure', 'encrypt', 'permission', 'access', 'role', 'authorize'],
      data: ['save', 'store', 'retrieve', 'delete', 'update', 'create', 'database'],
      ui: ['display', 'show', 'hide', 'button', 'form', 'page', 'modal', 'navigate'],
      api: ['api', 'endpoint', 'request', 'response', 'rest', 'graphql'],
      notification: ['email', 'notification', 'alert', 'message', 'sms'],
      payment: ['payment', 'transaction', 'billing', 'invoice', 'charge'],
    };

    for (const [tag, keywords] of Object.entries(tagPatterns)) {
      if (keywords.some(keyword => lowerText.includes(keyword))) {
        tags.push(tag);
      }
    }

    return tags;
  }

  /**
   * Normalize text: fix whitespace, line endings, etc.
   */
  private normalizeText(text: string): string {
    return text
      .replace(/\r\n/g, '\n') // Normalize line endings
      .replace(/\t/g, '  ')   // Replace tabs with spaces
      .replace(/\n{3,}/g, '\n\n') // Collapse multiple blank lines
      .trim();
  }
}
