import {
  AcceptanceCriterion,
  ParsedAcceptanceCriteria,
  TestCase,
  TestCategory,
  TestPlan,
  TestPriority,
  TestScenario,
  TestStep,
} from '../types';
import { ApiTestGenerator } from './apiTestGenerator';

/**
 * Generates a unique ID for test artifacts
 */
function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
}

/**
 * TestCaseGenerator
 *
 * Generates comprehensive test cases from parsed acceptance criteria.
 * Produces positive, negative, edge case, boundary, functional, and API tests.
 */
export class TestCaseGenerator {
  private apiGenerator = new ApiTestGenerator();

  /**
   * Generate a full test plan from parsed acceptance criteria
   */
  generateTestPlan(parsed: ParsedAcceptanceCriteria): TestPlan {
    const scenarios: TestScenario[] = [];

    for (const criterion of parsed.criteria) {
      // Generate all test categories for each criterion
      scenarios.push(this.generatePositiveScenario(criterion));
      scenarios.push(this.generateNegativeScenario(criterion));
      scenarios.push(this.generateEdgeCaseScenario(criterion));
      scenarios.push(this.generateFunctionalScenario(criterion));
      scenarios.push(this.generateBoundaryScenario(criterion));
      scenarios.push(this.generateErrorHandlingScenario(criterion));
    }

    // Generate API-specific test scenarios
    const apiScenarios = this.apiGenerator.generateApiScenarios(parsed);
    scenarios.push(...apiScenarios);

    // Filter out empty scenarios
    const validScenarios = scenarios.filter(s => s.testCases.length > 0);

    return {
      name: `Test Plan: ${parsed.title}`,
      description: `Comprehensive test plan generated from acceptance criteria for "${parsed.title}"`,
      scenarios: validScenarios,
      summary: this.computeSummary(validScenarios),
    };
  }

  // ================================================================
  // POSITIVE TEST SCENARIOS
  // ================================================================

  private generatePositiveScenario(criterion: AcceptanceCriterion): TestScenario {
    const testCases: TestCase[] = [];

    // Happy path - exact match of the criterion
    testCases.push({
      id: generateId('tc'),
      summary: `[Positive] Verify: ${this.truncate(criterion.then, 80)}`,
      description: `Validate that when the preconditions are met and the action is performed, the expected outcome occurs as specified.`,
      preconditions: `Given ${criterion.given}`,
      category: 'positive',
      priority: 'high',
      steps: [
        {
          stepNumber: 1,
          action: `Set up precondition: ${criterion.given}`,
          data: '',
          expectedResult: 'System is in the expected initial state',
        },
        {
          stepNumber: 2,
          action: `Perform action: ${criterion.when}`,
          data: 'Use valid, expected input data',
          expectedResult: 'Action is accepted and processed',
        },
        {
          stepNumber: 3,
          action: 'Verify the outcome',
          data: '',
          expectedResult: `${criterion.then}`,
        },
      ],
      expectedResult: criterion.then,
      labels: ['positive', 'happy-path', ...criterion.tags],
      linkedCriterionId: criterion.id,
    });

    // Repeat action verification
    testCases.push({
      id: generateId('tc'),
      summary: `[Positive] Verify repeated action: ${this.truncate(criterion.when, 60)}`,
      description: `Validate that the action can be performed multiple times with consistent results.`,
      preconditions: `Given ${criterion.given}`,
      category: 'positive',
      priority: 'medium',
      steps: [
        {
          stepNumber: 1,
          action: `Set up precondition: ${criterion.given}`,
          data: '',
          expectedResult: 'System is in the expected initial state',
        },
        {
          stepNumber: 2,
          action: `Perform action first time: ${criterion.when}`,
          data: 'Valid input data',
          expectedResult: criterion.then,
        },
        {
          stepNumber: 3,
          action: 'Reset to initial state if applicable',
          data: '',
          expectedResult: 'System returns to initial state',
        },
        {
          stepNumber: 4,
          action: `Perform action second time: ${criterion.when}`,
          data: 'Same valid input data',
          expectedResult: `Same result as first execution: ${criterion.then}`,
        },
      ],
      expectedResult: 'Consistent behavior across multiple executions',
      labels: ['positive', 'repeatability', ...criterion.tags],
      linkedCriterionId: criterion.id,
    });

    return {
      id: generateId('ts'),
      name: `Positive Tests: ${this.truncate(criterion.then, 50)}`,
      description: 'Verify the system behaves correctly under expected conditions',
      testCases,
      category: 'positive',
    };
  }

  // ================================================================
  // NEGATIVE TEST SCENARIOS
  // ================================================================

  private generateNegativeScenario(criterion: AcceptanceCriterion): TestScenario {
    const testCases: TestCase[] = [];

    // Missing precondition
    testCases.push({
      id: generateId('tc'),
      summary: `[Negative] Attempt action without precondition: ${this.truncate(criterion.given, 50)}`,
      description: `Validate that the system handles the case when preconditions are NOT met.`,
      preconditions: `Given ${criterion.given} is NOT satisfied`,
      category: 'negative',
      priority: 'high',
      steps: [
        {
          stepNumber: 1,
          action: `Ensure precondition is NOT met: Skip or invalidate "${criterion.given}"`,
          data: '',
          expectedResult: 'System is NOT in the expected initial state',
        },
        {
          stepNumber: 2,
          action: `Attempt to perform: ${criterion.when}`,
          data: 'Valid input data but invalid precondition',
          expectedResult: 'System prevents the action or shows appropriate error',
        },
        {
          stepNumber: 3,
          action: 'Verify error handling',
          data: '',
          expectedResult: 'Appropriate error message is displayed; no data corruption occurs',
        },
      ],
      expectedResult: 'System gracefully handles missing preconditions',
      labels: ['negative', 'precondition-failure', ...criterion.tags],
      linkedCriterionId: criterion.id,
    });

    // Invalid input data
    testCases.push({
      id: generateId('tc'),
      summary: `[Negative] Provide invalid input for: ${this.truncate(criterion.when, 60)}`,
      description: `Validate that the system correctly rejects invalid input data.`,
      preconditions: `Given ${criterion.given}`,
      category: 'negative',
      priority: 'high',
      steps: [
        {
          stepNumber: 1,
          action: `Set up precondition: ${criterion.given}`,
          data: '',
          expectedResult: 'System is in the expected initial state',
        },
        {
          stepNumber: 2,
          action: `Perform action with invalid data: ${criterion.when}`,
          data: 'Invalid/malformed input (empty strings, wrong types, special characters)',
          expectedResult: 'System rejects the input with a validation error',
        },
        {
          stepNumber: 3,
          action: 'Verify no side effects occurred',
          data: '',
          expectedResult: 'System state remains unchanged; no partial updates',
        },
      ],
      expectedResult: 'Input validation prevents processing of invalid data',
      labels: ['negative', 'invalid-input', ...criterion.tags],
      linkedCriterionId: criterion.id,
    });

    // Unauthorized access
    testCases.push({
      id: generateId('tc'),
      summary: `[Negative] Attempt action without proper authorization`,
      description: `Validate that unauthorized users cannot perform the action.`,
      preconditions: `User is NOT authorized or not logged in`,
      category: 'negative',
      priority: 'high',
      steps: [
        {
          stepNumber: 1,
          action: 'Ensure user is not authenticated or lacks required permissions',
          data: 'Use unauthenticated session or low-privilege account',
          expectedResult: 'User has insufficient permissions',
        },
        {
          stepNumber: 2,
          action: `Attempt to perform: ${criterion.when}`,
          data: '',
          expectedResult: 'System denies access with 401/403 or appropriate error',
        },
        {
          stepNumber: 3,
          action: 'Verify no data was modified',
          data: '',
          expectedResult: 'No changes were made to the system',
        },
      ],
      expectedResult: 'Unauthorized access is properly blocked',
      labels: ['negative', 'security', 'authorization', ...criterion.tags],
      linkedCriterionId: criterion.id,
    });

    return {
      id: generateId('ts'),
      name: `Negative Tests: ${this.truncate(criterion.then, 50)}`,
      description: 'Verify the system handles invalid/unexpected conditions gracefully',
      testCases,
      category: 'negative',
    };
  }

  // ================================================================
  // EDGE CASE SCENARIOS
  // ================================================================

  private generateEdgeCaseScenario(criterion: AcceptanceCriterion): TestScenario {
    const testCases: TestCase[] = [];

    // Empty/null input
    testCases.push({
      id: generateId('tc'),
      summary: `[Edge Case] Empty/null input for: ${this.truncate(criterion.when, 60)}`,
      description: `Test behavior when input is empty, null, or undefined.`,
      preconditions: `Given ${criterion.given}`,
      category: 'edge_case',
      priority: 'medium',
      steps: [
        {
          stepNumber: 1,
          action: `Set up precondition: ${criterion.given}`,
          data: '',
          expectedResult: 'System is ready',
        },
        {
          stepNumber: 2,
          action: `Perform action with empty/null values: ${criterion.when}`,
          data: 'null, undefined, empty string "", empty array []',
          expectedResult: 'System handles gracefully without crashing',
        },
        {
          stepNumber: 3,
          action: 'Verify system stability',
          data: '',
          expectedResult: 'No unhandled exceptions; appropriate feedback provided',
        },
      ],
      expectedResult: 'System handles empty/null input without failure',
      labels: ['edge-case', 'null-handling', ...criterion.tags],
      linkedCriterionId: criterion.id,
    });

    // Concurrent/simultaneous actions
    testCases.push({
      id: generateId('tc'),
      summary: `[Edge Case] Concurrent execution: ${this.truncate(criterion.when, 50)}`,
      description: `Test behavior when multiple users/processes perform the action simultaneously.`,
      preconditions: `Given ${criterion.given} (multiple concurrent sessions)`,
      category: 'edge_case',
      priority: 'medium',
      steps: [
        {
          stepNumber: 1,
          action: `Set up precondition for multiple users: ${criterion.given}`,
          data: '2+ concurrent sessions',
          expectedResult: 'Multiple sessions established',
        },
        {
          stepNumber: 2,
          action: `Simultaneously perform: ${criterion.when}`,
          data: 'Execute from multiple sessions at the same time',
          expectedResult: 'No race conditions or data corruption',
        },
        {
          stepNumber: 3,
          action: 'Verify data integrity',
          data: '',
          expectedResult: 'All operations complete correctly or fail gracefully with proper locking',
        },
      ],
      expectedResult: 'System handles concurrent access without data corruption',
      labels: ['edge-case', 'concurrency', ...criterion.tags],
      linkedCriterionId: criterion.id,
    });

    // Special characters and encoding
    testCases.push({
      id: generateId('tc'),
      summary: `[Edge Case] Special characters in input`,
      description: `Test with special characters, unicode, emojis, and extreme-length input.`,
      preconditions: `Given ${criterion.given}`,
      category: 'edge_case',
      priority: 'low',
      steps: [
        {
          stepNumber: 1,
          action: `Set up precondition: ${criterion.given}`,
          data: '',
          expectedResult: 'System is ready',
        },
        {
          stepNumber: 2,
          action: `Perform action with special input: ${criterion.when}`,
          data: 'Unicode: émojis 🎉, HTML: <script>alert(1)</script>, SQL: \' OR 1=1 --, Very long string (10000+ chars)',
          expectedResult: 'Input is sanitized and processed or rejected safely',
        },
        {
          stepNumber: 3,
          action: 'Check for XSS, injection, or display issues',
          data: '',
          expectedResult: 'No security vulnerabilities; content displayed/stored correctly',
        },
      ],
      expectedResult: 'Special characters are handled safely',
      labels: ['edge-case', 'special-chars', 'security', ...criterion.tags],
      linkedCriterionId: criterion.id,
    });

    return {
      id: generateId('ts'),
      name: `Edge Case Tests: ${this.truncate(criterion.then, 50)}`,
      description: 'Verify system behavior at boundaries and unusual conditions',
      testCases,
      category: 'edge_case',
    };
  }

  // ================================================================
  // FUNCTIONAL TEST SCENARIOS
  // ================================================================

  private generateFunctionalScenario(criterion: AcceptanceCriterion): TestScenario {
    const testCases: TestCase[] = [];

    // End-to-end flow
    testCases.push({
      id: generateId('tc'),
      summary: `[Functional] Complete flow: ${this.truncate(criterion.then, 60)}`,
      description: `End-to-end functional test covering the full user journey.`,
      preconditions: `Given ${criterion.given}`,
      category: 'functional',
      priority: 'critical',
      steps: [
        {
          stepNumber: 1,
          action: 'Start from a clean state',
          data: '',
          expectedResult: 'System is in initial state',
        },
        {
          stepNumber: 2,
          action: `Establish preconditions: ${criterion.given}`,
          data: 'Set up all required preconditions',
          expectedResult: 'All preconditions are met',
        },
        {
          stepNumber: 3,
          action: `Execute the main action: ${criterion.when}`,
          data: 'Use realistic, production-like data',
          expectedResult: 'Action completes successfully',
        },
        {
          stepNumber: 4,
          action: `Verify expected outcome: ${criterion.then}`,
          data: '',
          expectedResult: criterion.then,
        },
        {
          stepNumber: 5,
          action: 'Verify any side effects (notifications, logs, data changes)',
          data: '',
          expectedResult: 'All expected side effects occurred correctly',
        },
      ],
      expectedResult: criterion.then,
      labels: ['functional', 'e2e', ...criterion.tags],
      linkedCriterionId: criterion.id,
    });

    // State transition verification
    testCases.push({
      id: generateId('tc'),
      summary: `[Functional] State transition: ${this.truncate(criterion.when, 60)}`,
      description: `Verify the system transitions correctly between states.`,
      preconditions: `Given ${criterion.given}`,
      category: 'functional',
      priority: 'high',
      steps: [
        {
          stepNumber: 1,
          action: 'Document the initial system state',
          data: 'Record current state values',
          expectedResult: 'Initial state recorded',
        },
        {
          stepNumber: 2,
          action: `Perform action: ${criterion.when}`,
          data: '',
          expectedResult: 'Action triggers state change',
        },
        {
          stepNumber: 3,
          action: 'Verify the new system state',
          data: '',
          expectedResult: `System transitioned to new state reflecting: ${criterion.then}`,
        },
        {
          stepNumber: 4,
          action: 'Verify no unintended state changes occurred',
          data: 'Check related entities remain unchanged',
          expectedResult: 'Only the expected state changed',
        },
      ],
      expectedResult: 'Clean state transition with no unintended side effects',
      labels: ['functional', 'state-transition', ...criterion.tags],
      linkedCriterionId: criterion.id,
    });

    return {
      id: generateId('ts'),
      name: `Functional Tests: ${this.truncate(criterion.then, 50)}`,
      description: 'Verify end-to-end functional correctness',
      testCases,
      category: 'functional',
    };
  }

  // ================================================================
  // BOUNDARY TEST SCENARIOS
  // ================================================================

  private generateBoundaryScenario(criterion: AcceptanceCriterion): TestScenario {
    const testCases: TestCase[] = [];

    // Min/max boundary values
    testCases.push({
      id: generateId('tc'),
      summary: `[Boundary] Min/max values for: ${this.truncate(criterion.when, 60)}`,
      description: `Test with minimum and maximum allowed values.`,
      preconditions: `Given ${criterion.given}`,
      category: 'boundary',
      priority: 'medium',
      steps: [
        {
          stepNumber: 1,
          action: `Set up precondition: ${criterion.given}`,
          data: '',
          expectedResult: 'System is ready',
        },
        {
          stepNumber: 2,
          action: `Perform action with minimum valid value: ${criterion.when}`,
          data: 'Minimum allowed value (e.g., 1 char, 0, min date)',
          expectedResult: 'System accepts minimum value',
        },
        {
          stepNumber: 3,
          action: `Perform action with maximum valid value: ${criterion.when}`,
          data: 'Maximum allowed value (e.g., max length, max int, future date)',
          expectedResult: 'System accepts maximum value',
        },
        {
          stepNumber: 4,
          action: 'Perform action with value just beyond maximum',
          data: 'Max + 1, over length limit',
          expectedResult: 'System rejects with appropriate error',
        },
      ],
      expectedResult: 'Boundary values are handled correctly',
      labels: ['boundary', 'min-max', ...criterion.tags],
      linkedCriterionId: criterion.id,
    });

    // Timeout and rate limits
    testCases.push({
      id: generateId('tc'),
      summary: `[Boundary] Timeout/rate limit behavior`,
      description: `Test system behavior at timeout boundaries and rate limits.`,
      preconditions: `Given ${criterion.given}`,
      category: 'boundary',
      priority: 'low',
      steps: [
        {
          stepNumber: 1,
          action: `Set up precondition: ${criterion.given}`,
          data: '',
          expectedResult: 'System is ready',
        },
        {
          stepNumber: 2,
          action: 'Simulate slow network or processing near timeout threshold',
          data: 'Add artificial delay close to timeout limit',
          expectedResult: 'System completes before timeout OR times out gracefully',
        },
        {
          stepNumber: 3,
          action: 'Rapidly repeat the action to test rate limiting',
          data: 'Execute 100+ times in quick succession',
          expectedResult: 'Rate limiting activates; clear feedback provided',
        },
      ],
      expectedResult: 'Timeouts and rate limits are handled gracefully',
      labels: ['boundary', 'timeout', 'rate-limit', ...criterion.tags],
      linkedCriterionId: criterion.id,
    });

    return {
      id: generateId('ts'),
      name: `Boundary Tests: ${this.truncate(criterion.then, 50)}`,
      description: 'Verify behavior at value boundaries and limits',
      testCases,
      category: 'boundary',
    };
  }

  // ================================================================
  // ERROR HANDLING SCENARIOS
  // ================================================================

  private generateErrorHandlingScenario(criterion: AcceptanceCriterion): TestScenario {
    const testCases: TestCase[] = [];

    // Network failure
    testCases.push({
      id: generateId('tc'),
      summary: `[Error Handling] Network failure during: ${this.truncate(criterion.when, 50)}`,
      description: `Test system behavior when network connectivity is lost during the action.`,
      preconditions: `Given ${criterion.given}`,
      category: 'error_handling',
      priority: 'medium',
      steps: [
        {
          stepNumber: 1,
          action: `Set up precondition: ${criterion.given}`,
          data: '',
          expectedResult: 'System is ready',
        },
        {
          stepNumber: 2,
          action: `Begin action: ${criterion.when}`,
          data: '',
          expectedResult: 'Action starts processing',
        },
        {
          stepNumber: 3,
          action: 'Simulate network disconnection during processing',
          data: 'Drop network connection / simulate timeout',
          expectedResult: 'System detects failure and shows appropriate error',
        },
        {
          stepNumber: 4,
          action: 'Restore network and verify system recovery',
          data: '',
          expectedResult: 'System recovers gracefully; no data loss or corruption',
        },
      ],
      expectedResult: 'System handles network failures without data loss',
      labels: ['error-handling', 'network', 'resilience', ...criterion.tags],
      linkedCriterionId: criterion.id,
    });

    // Service dependency failure
    testCases.push({
      id: generateId('tc'),
      summary: `[Error Handling] Downstream service failure`,
      description: `Test behavior when a dependent service is unavailable.`,
      preconditions: `Given ${criterion.given} AND a dependent service is down`,
      category: 'error_handling',
      priority: 'medium',
      steps: [
        {
          stepNumber: 1,
          action: `Set up precondition: ${criterion.given}`,
          data: '',
          expectedResult: 'System is ready',
        },
        {
          stepNumber: 2,
          action: 'Make a dependent service unavailable (mock 500/503 responses)',
          data: 'Simulate downstream service failure',
          expectedResult: 'Dependent service is unreachable',
        },
        {
          stepNumber: 3,
          action: `Attempt to perform: ${criterion.when}`,
          data: '',
          expectedResult: 'System handles dependency failure gracefully',
        },
        {
          stepNumber: 4,
          action: 'Verify user-facing error message',
          data: '',
          expectedResult: 'Clear, non-technical error message displayed to user',
        },
      ],
      expectedResult: 'Graceful degradation when dependencies fail',
      labels: ['error-handling', 'dependency', 'resilience', ...criterion.tags],
      linkedCriterionId: criterion.id,
    });

    return {
      id: generateId('ts'),
      name: `Error Handling Tests: ${this.truncate(criterion.then, 50)}`,
      description: 'Verify proper error handling and system resilience',
      testCases,
      category: 'error_handling',
    };
  }

  // ================================================================
  // UTILITIES
  // ================================================================

  private truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }

  private computeSummary(scenarios: TestScenario[]): TestPlan['summary'] {
    const byCategory: Record<TestCategory, number> = {
      positive: 0,
      negative: 0,
      edge_case: 0,
      functional: 0,
      boundary: 0,
      error_handling: 0,
      security: 0,
      performance: 0,
      api: 0,
    };

    const byPriority: Record<TestPriority, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };

    let totalTestCases = 0;

    for (const scenario of scenarios) {
      for (const tc of scenario.testCases) {
        totalTestCases++;
        byCategory[tc.category]++;
        byPriority[tc.priority]++;
      }
    }

    return {
      totalScenarios: scenarios.length,
      totalTestCases,
      byCategory,
      byPriority,
    };
  }
}
