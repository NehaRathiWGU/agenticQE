import axios, { AxiosInstance } from 'axios';
import {
  AppConfig,
  TestCase,
  TestPlan,
  TestScenario,
  XrayCreationResult,
  XrayTestStep,
  ParsedAcceptanceCriteria,
  AcceptanceCriterion,
} from '../types';

/**
 * XrayClient
 *
 * Handles communication with Jira and Xray Cloud APIs to create:
 * - Test Cases (Xray Test issues)
 * - Test Sets (grouped test cases)
 * - Test Plans (execution planning)
 */
export class XrayClient {
  private jiraClient: AxiosInstance;
  private xrayToken: string | null = null;
  private config: AppConfig;

  constructor(config: AppConfig) {
    this.config = config;

    // Initialize Jira REST client (API v2 for better compatibility)
    this.jiraClient = axios.create({
      baseURL: `${config.jira.baseUrl}/rest/api/2`,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(
          `${config.jira.email}:${config.jira.apiToken}`
        ).toString('base64')}`,
      },
    });
  }

  // ================================================================
  // AUTHENTICATION
  // ================================================================

  /**
   * Authenticate with Xray Cloud and get a bearer token
   */
  async authenticate(): Promise<void> {
    try {
      const response = await axios.post(
        'https://xray.cloud.getxray.app/api/v2/authenticate',
        {
          client_id: this.config.xray.clientId,
          client_secret: this.config.xray.clientSecret,
        }
      );

      this.xrayToken = response.data;
      console.log('✓ Authenticated with Xray Cloud');
    } catch (error: any) {
      throw new Error(
        `Failed to authenticate with Xray: ${error.response?.data?.message || error.message}`
      );
    }
  }

  /**
   * Get an authenticated Xray axios instance
   */
  private getXrayClient(): AxiosInstance {
    if (!this.xrayToken) {
      throw new Error('Not authenticated with Xray. Call authenticate() first.');
    }

    return axios.create({
      baseURL: 'https://xray.cloud.getxray.app/api/v2',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.xrayToken}`,
      },
    });
  }

  // ================================================================
  // TEST CASE CREATION
  // ================================================================

  /**
   * Create a single test case in Xray
   */
  async createTestCase(testCase: TestCase): Promise<string> {
    const issueData = {
      fields: {
        project: { key: this.config.jira.projectKey },
        summary: testCase.summary,
        description: this.formatDescription(testCase),
        issuetype: { name: 'Test' },
        labels: testCase.labels.slice(0, 10), // Jira limit
        priority: { name: this.mapPriority(testCase.priority) },
      },
    };

    try {
      // Create the Jira issue first
      const issueResponse = await this.jiraClient.post('/issue', issueData);
      const issueKey = issueResponse.data.key;

      // Then add test steps via Xray API
      await this.addTestSteps(issueKey, testCase.steps);

      return issueKey;
    } catch (error: any) {
      const errorMsg = error.response?.data?.errors
        ? JSON.stringify(error.response.data.errors)
        : error.message;
      throw new Error(`Failed to create test case "${testCase.summary}": ${errorMsg}`);
    }
  }

  /**
   * Add test steps to an existing test issue via Xray
   */
  private async addTestSteps(issueKey: string, steps: TestCase['steps']): Promise<void> {
    const xrayClient = this.getXrayClient();

    const xraySteps: XrayTestStep[] = steps.map(step => ({
      action: step.action,
      data: step.data || '',
      result: step.expectedResult,
    }));

    try {
      await xrayClient.put(`/test/${issueKey}/steps`, xraySteps);
    } catch (error: any) {
      // Non-fatal: test case was created, steps failed
      console.warn(`⚠ Could not add steps to ${issueKey}: ${error.message}`);
    }
  }

  /**
   * Create multiple test cases in bulk
   */
  async createTestCases(testCases: TestCase[]): Promise<string[]> {
    const createdKeys: string[] = [];

    for (const testCase of testCases) {
      try {
        const key = await this.createTestCase(testCase);
        createdKeys.push(key);
        // Small delay to avoid rate limiting
        await this.delay(200);
      } catch (error: any) {
        console.error(`✗ Failed: ${testCase.summary} - ${error.message}`);
      }
    }

    return createdKeys;
  }

  // ================================================================
  // TEST SET CREATION
  // ================================================================

  /**
   * Create a Test Set (groups related test cases)
   */
  async createTestSet(scenario: TestScenario, testCaseKeys: string[]): Promise<string> {
    const issueData = {
      fields: {
        project: { key: this.config.jira.projectKey },
        summary: scenario.name,
        description: {
          type: 'doc',
          version: 1,
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: scenario.description,
                },
              ],
            },
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: `Category: ${scenario.category} | Tests: ${testCaseKeys.length}`,
                },
              ],
            },
          ],
        },
        issuetype: { name: 'Test Set' },
        labels: [scenario.category, 'auto-generated'],
      },
    };

    try {
      const response = await this.jiraClient.post('/issue', issueData);
      const setKey = response.data.key;

      // Link test cases to the test set via Xray
      if (testCaseKeys.length > 0) {
        await this.addTestsToTestSet(setKey, testCaseKeys);
      }

      return setKey;
    } catch (error: any) {
      throw new Error(`Failed to create test set "${scenario.name}": ${error.message}`);
    }
  }

  /**
   * Add test case keys to a test set
   */
  private async addTestsToTestSet(testSetKey: string, testKeys: string[]): Promise<void> {
    const xrayClient = this.getXrayClient();

    try {
      await xrayClient.post(`/testset/${testSetKey}/test`, {
        add: testKeys,
      });
    } catch (error: any) {
      console.warn(`⚠ Could not link tests to ${testSetKey}: ${error.message}`);
    }
  }

  // ================================================================
  // TEST PLAN CREATION
  // ================================================================

  /**
   * Create a Test Plan in Xray
   */
  async createTestPlan(testPlan: TestPlan, allTestKeys: string[]): Promise<string> {
    const issueData = {
      fields: {
        project: { key: this.config.jira.projectKey },
        summary: testPlan.name,
        description: {
          type: 'doc',
          version: 1,
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: testPlan.description,
                },
              ],
            },
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: `Total Scenarios: ${testPlan.summary.totalScenarios} | Total Test Cases: ${testPlan.summary.totalTestCases}`,
                },
              ],
            },
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: `Coverage: Positive(${testPlan.summary.byCategory.positive}) | Negative(${testPlan.summary.byCategory.negative}) | Edge Cases(${testPlan.summary.byCategory.edge_case}) | Functional(${testPlan.summary.byCategory.functional}) | Boundary(${testPlan.summary.byCategory.boundary}) | Error Handling(${testPlan.summary.byCategory.error_handling})`,
                },
              ],
            },
          ],
        },
        issuetype: { name: 'Test Plan' },
        labels: ['auto-generated', 'comprehensive'],
      },
    };

    try {
      const response = await this.jiraClient.post('/issue', issueData);
      const planKey = response.data.key;

      // Link all tests to the plan via Xray
      if (allTestKeys.length > 0) {
        await this.addTestsToTestPlan(planKey, allTestKeys);
      }

      return planKey;
    } catch (error: any) {
      throw new Error(`Failed to create test plan "${testPlan.name}": ${error.message}`);
    }
  }

  /**
   * Add test case keys to a test plan
   */
  private async addTestsToTestPlan(testPlanKey: string, testKeys: string[]): Promise<void> {
    const xrayClient = this.getXrayClient();

    try {
      await xrayClient.post(`/testplan/${testPlanKey}/test`, {
        add: testKeys,
      });
    } catch (error: any) {
      console.warn(`⚠ Could not link tests to plan ${testPlanKey}: ${error.message}`);
    }
  }

  // ================================================================
  // FULL PLAN EXECUTION
  // ================================================================

  /**
   * Execute full creation: test cases → test sets → test plan
   */
  async createFullTestPlan(testPlan: TestPlan): Promise<XrayCreationResult> {
    const result: XrayCreationResult = {
      testCaseKeys: [],
      testSetKeys: [],
      errors: [],
      summary: '',
    };

    console.log(`\nCreating ${testPlan.summary.totalTestCases} test cases across ${testPlan.summary.totalScenarios} scenarios...\n`);

    // Step 1: Create all test cases
    for (const scenario of testPlan.scenarios) {
      console.log(`  Creating tests for: ${scenario.name}`);

      const scenarioTestKeys: string[] = [];

      for (const testCase of scenario.testCases) {
        try {
          const key = await this.createTestCase(testCase);
          scenarioTestKeys.push(key);
          result.testCaseKeys.push(key);
          console.log(`    ✓ ${key}: ${testCase.summary.substring(0, 60)}`);
          await this.delay(300);
        } catch (error: any) {
          result.errors.push(`${testCase.summary}: ${error.message}`);
          console.log(`    ✗ Failed: ${testCase.summary.substring(0, 60)}`);
        }
      }

      // Step 2: Create test set for this scenario
      if (scenarioTestKeys.length > 0) {
        try {
          const setKey = await this.createTestSet(scenario, scenarioTestKeys);
          result.testSetKeys.push(setKey);
          console.log(`  ✓ Test Set: ${setKey} (${scenarioTestKeys.length} tests)`);
        } catch (error: any) {
          result.errors.push(`Test Set "${scenario.name}": ${error.message}`);
        }
      }
    }

    // Step 3: Create the test plan
    if (result.testCaseKeys.length > 0) {
      try {
        const planKey = await this.createTestPlan(testPlan, result.testCaseKeys);
        result.testPlanKey = planKey;
        console.log(`\n✓ Test Plan created: ${planKey}`);
      } catch (error: any) {
        result.errors.push(`Test Plan: ${error.message}`);
      }
    }

    result.summary = [
      `Test Plan: ${result.testPlanKey || 'Not created'}`,
      `Test Sets: ${result.testSetKeys.length} created`,
      `Test Cases: ${result.testCaseKeys.length} created`,
      `Errors: ${result.errors.length}`,
    ].join(' | ');

    return result;
  }

  // ================================================================
  // LINK TO EXISTING JIRA ISSUE
  // ================================================================

  /**
   * Link test cases to an existing Jira story/requirement
   */
  async linkTestsToIssue(issueKey: string, testKeys: string[]): Promise<void> {
    for (const testKey of testKeys) {
      try {
        await this.jiraClient.post('/issueLink', {
          type: { name: 'Test' },
          inwardIssue: { key: testKey },
          outwardIssue: { key: issueKey },
        });
        await this.delay(100);
      } catch (error: any) {
        console.warn(`⚠ Could not link ${testKey} to ${issueKey}: ${error.message}`);
      }
    }
  }

  // ================================================================
  // UTILITIES
  // ================================================================

  /**
   * Format test case description for Jira (Atlassian Document Format)
   */
  private formatDescription(testCase: TestCase): object {
    return {
      type: 'doc',
      version: 1,
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: testCase.description, marks: [{ type: 'strong' }] },
          ],
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: `Preconditions: ${testCase.preconditions}` },
          ],
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: `Category: ${testCase.category} | Priority: ${testCase.priority}` },
          ],
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: `Expected Result: ${testCase.expectedResult}` },
          ],
        },
      ],
    };
  }

  /**
   * Map internal priority to Jira priority name
   */
  private mapPriority(priority: string): string {
    const map: Record<string, string> = {
      critical: 'Highest',
      high: 'High',
      medium: 'Medium',
      low: 'Low',
    };
    return map[priority] || 'Medium';
  }

  /**
   * Simple delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ================================================================
  // JIRA STORY INGESTION
  // ================================================================

  /**
   * Fetch acceptance criteria from a Jira issue (Story/Task)
   * Pulls issue description and custom field "acceptance criteria"
   */
  async fetchStoryCriteria(issueKey: string): Promise<ParsedAcceptanceCriteria> {
    try {
      // Fetch the issue with summary, description, and acceptance criteria field
      const response = await this.jiraClient.get(`/issue/${issueKey}`, {
        params: {
          fields: 'summary,description,acceptance%20criteria,description',
          expand: 'renderedFields',
        },
      });

      const issue = response.data;
      const fields = issue.fields;

      // Extract summary and description
      // API v2 returns plain text with Wiki Markup (e.g., h2., **bold**)
      const summary = fields.summary || 'Untitled Story';
      const description = (typeof fields.description === 'string' ? fields.description : '') || '';

      // Try to extract acceptance criteria from custom field
      // Try multiple possible field names for acceptance criteria
      let acceptanceCriteriaText = '';

      // Check for common custom field names (API v2 uses direct field IDs)
      const possibleNames = [
        'customfield_10195',  // The actual field ID for Acceptance Criteria at WGU
        'acceptance criteria',
        'Acceptance Criteria',
        'acceptanceCriteria',
        'acceptance_criteria',
        'AcceptanceCriteria',
        'customfield_acceptancecriteria',
      ];

      for (const fieldName of possibleNames) {
        if (fields[fieldName]) {
          acceptanceCriteriaText = fields[fieldName];
          break;
        }
      }

      // If custom field not found, try to extract from description
      if (!acceptanceCriteriaText && description) {
        acceptanceCriteriaText = this.extractAcceptanceCriteriaFromDescription(description);
      }

      // Parse the acceptance criteria
      const criteria = this.parseJiraAcceptanceCriteria(acceptanceCriteriaText);

      return {
        title: summary,
        description: description || `Acceptance criteria from Jira issue ${issueKey}`,
        criteria: criteria,
        metadata: {
          source: 'jira-issue',
          parsedAt: new Date().toISOString(),
          totalCriteria: criteria.length,
        },
      };
    } catch (error: any) {
      const errorMsg = error.response?.data?.errorMessages
        ? JSON.stringify(error.response.data.errorMessages)
        : error.message;
      throw new Error(`Failed to fetch Jira issue ${issueKey}: ${errorMsg}`);
    }
  }

  /**
   * Extract acceptance criteria from Jira issue description
   * Looks for patterns like "Acceptance Criteria:", "AC:", "Given/When/Then", etc.
   * Handles Jira's Wiki Markup format (h2., **bold**, etc.)
   */
  private extractAcceptanceCriteriaFromDescription(description: string): string {
    // Strip Wiki Markup formatting (h2., h3., **bold**, etc.)
    const cleanDescription = description
      .replace(/h[1-6]\.\s+/gi, '')  // Remove h1., h2., etc.
      .replace(/\*\*([^*]+)\*\*/g, '$1')  // Remove bold **text**
      .replace(/\*([^*]+)\*/g, '$1')  // Remove italic *text*
      .replace(/`([^`]+)`/g, '$1')  // Remove inline code `text`
      .trim();

    // Look for sections marked as acceptance criteria
    const patterns = [
      /Acceptance\s*Criteria[:\s]*((?:\n.*)+)/i,
      /AC[:\s]*((?:\n.*)+)/i,
      /Given\s+When\s+Then((?:\n.*)+)/i,
      /Expected\s+Behavior[:\s]*((?:\n.*)+)/i,
    ];

    for (const pattern of patterns) {
      const match = cleanDescription.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }

    // If no explicit marker found, return the cleaned description
    // (assuming it contains the acceptance criteria)
    return cleanDescription;
  }

  /**
   * Parse acceptance criteria from Jira issue text format
   * Handles Gherkin-style Given/When/Then, numbered lists, and bullet points
   */
  private parseJiraAcceptanceCriteria(text: string): AcceptanceCriterion[] {
    const criteria: AcceptanceCriterion[] = [];

    if (!text || text.trim().length === 0) {
      return criteria;
    }

    const normalizedText = text
      .replace(/\r\n/g, '\n')
      .replace(/\t/g, '  ')
      .trim();

    // Try Gherkin format first (Given/When/Then)
    const gherkinPattern =
      /(?:^|\n)\s*(?:Given\s+(.+?)[\s]*When\s+(.+?)[\s]*Then\s+(.+?))(?=(?:\n\s*Given|\n\s*$|$))/gis;

    let match: RegExpExecArray | null;
    while ((match = gherkinPattern.exec(normalizedText)) !== null) {
      criteria.push({
        id: `ac-${criteria.length + 1}-${Date.now()}`,
        given: match[1].trim(),
        when: match[2].trim(),
        then: match[3].trim(),
        rawText: match[0].trim(),
        tags: [],
      });
    }

    // If Gherkin format found, return those
    if (criteria.length > 0) {
      return criteria;
    }

    // Try numbered list format
    const numberedPattern =
      /(?:^|\n)\s*(\d+[.)]\s*)(.+?)(?=(?:\n\s*\d+[.)]\s*|\s*$))/gs;

    while ((match = numberedPattern.exec(normalizedText)) !== null) {
      const itemText = match[2].trim();
      const parsed = this.convertJiraCriterionToGWT(itemText);
      criteria.push({
        id: `ac-${criteria.length + 1}-${Date.now()}`,
        ...parsed,
        rawText: itemText,
        tags: [],
      });
    }

    // If numbered format found, return those
    if (criteria.length > 0) {
      return criteria;
    }

    // Try bullet point format - multiple bullet patterns
    const bulletPatterns = [
      /(?:^|\n)-\s*\[[xX ]?\]\s+(.+?)(?=(?:\n-\s*\[[xX ]?\]\s+|\s*$))/gs,  // [x] checkbox
      /(?:^|\n)\s*[-•]\s+(.+?)(?=(?:\n\s*[-•]\s+|\s*$))/gs,  // - or • with space
      /(?:^|\n)\s*-\s+(.+?)(?=(?:\n\s*-\s+|\s*$))/gs,         // - dash
      /(?:^|\n)\s*\*\s+(.+?)(?=(?:\n\s*\*\s+|\s*$))/gs,       // * asterisk
      /(?:^|\n)\s*[•]\s+(.+?)(?=(?:\n\s*[•]\s+|\s*$))/gs,     // • bullet
    ];

    for (const bulletPattern of bulletPatterns) {
      while ((match = bulletPattern.exec(normalizedText)) !== null) {
        const itemText = match[1].trim();
        if (itemText.length > 10 && !itemText.startsWith('[') && !itemText.toLowerCase().includes('references')) {
          const parsed = this.convertJiraCriterionToGWT(itemText);
          criteria.push({
            id: `ac-${criteria.length + 1}-${Date.now()}`,
            ...parsed,
            rawText: itemText,
            tags: [],
          });
        }
      }
    }

    // If still nothing, treat entire text as one criterion
    if (criteria.length === 0) {
      const parsed = this.convertJiraCriterionToGWT(normalizedText);
      criteria.push({
        id: `ac-1-${Date.now()}`,
        ...parsed,
        rawText: normalizedText,
        tags: [],
      });
    }

    return criteria;
  }

  /**
   * Convert a plain text criterion from Jira into Given/When/Then structure
   */
  private convertJiraCriterionToGWT(text: string): { given: string; when: string; then: string } {
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

  // ================================================================
  // VALIDATION
  // ================================================================

  /**
   * Validate that the Jira project exists and is accessible
   */
  async validateConnection(): Promise<boolean> {
    try {
      const response = await this.jiraClient.get(
        `/project/${this.config.jira.projectKey}`
      );
      console.log(`✓ Connected to project: ${response.data.name} (${response.data.key})`);
      return true;
    } catch (error: any) {
      console.error(`✗ Cannot access project ${this.config.jira.projectKey}: ${error.message}`);
      return false;
    }
  }
}
