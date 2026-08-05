import {
  AcceptanceCriterion,
  ParsedAcceptanceCriteria,
  TestCase,
  TestCategory,
  TestPlan,
  TestPriority,
  TestScenario,
} from '../types';
import { ApiTestGenerator } from './apiTestGenerator';

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
}

/**
 * TestCaseGenerator (Senior QE approach)
 *
 * Per criterion, generates only what matters:
 *  1. Happy path — does the thing work?
 *  2. Primary failure — what's the most likely way it breaks?
 *  3. Critical edge case — what will bite us in prod?
 *
 * Plus API tests (5 per API criterion) when applicable.
 * Total: ~3 tests per criterion + 5 API tests per API criterion.
 */
export class TestCaseGenerator {
  private apiGenerator = new ApiTestGenerator();

  generateTestPlan(parsed: ParsedAcceptanceCriteria): TestPlan {
    const scenarios: TestScenario[] = [];

    for (const criterion of parsed.criteria) {
      scenarios.push(this.generateCoreTests(criterion));
    }

    // API tests only for API-related criteria
    const apiScenarios = this.apiGenerator.generateApiScenarios(parsed);
    scenarios.push(...apiScenarios);

    const validScenarios = scenarios.filter(s => s.testCases.length > 0);

    return {
      name: `Test Plan: ${parsed.title}`,
      description: `Focused test plan — critical path, primary failures, and edge cases`,
      scenarios: validScenarios,
      summary: this.computeSummary(validScenarios),
    };
  }

  /**
   * 3 tests per criterion: happy path, primary failure, edge case
   */
  private generateCoreTests(c: AcceptanceCriterion): TestScenario {
    const testCases: TestCase[] = [
      // 1. HAPPY PATH — verify the AC works as stated
      {
        id: generateId('tc'),
        summary: `Verify: ${this.truncate(c.then, 100)}`,
        description: `Confirm the expected behavior when all preconditions are met.`,
        preconditions: c.given,
        category: 'positive',
        priority: 'critical',
        steps: [
          { stepNumber: 1, action: `Setup: ${c.given}`, data: '', expectedResult: 'Precondition established' },
          { stepNumber: 2, action: `Action: ${c.when}`, data: 'Valid data', expectedResult: 'Action accepted' },
          { stepNumber: 3, action: `Verify: ${c.then}`, data: '', expectedResult: c.then },
        ],
        expectedResult: c.then,
        labels: ['critical-path', ...c.tags],
        linkedCriterionId: c.id,
      },

      // 2. PRIMARY FAILURE — precondition not met or invalid input
      {
        id: generateId('tc'),
        summary: `Negative: ${this.inferFailureMode(c)}`,
        description: `Verify graceful handling when the primary failure condition occurs.`,
        preconditions: `${c.given} is NOT satisfied or input is invalid`,
        category: 'negative',
        priority: 'high',
        steps: [
          { stepNumber: 1, action: `Invalidate precondition or provide bad input for: ${c.when}`, data: 'Invalid/missing data', expectedResult: 'System in invalid state' },
          { stepNumber: 2, action: 'Attempt the action', data: '', expectedResult: 'Action blocked or error shown' },
          { stepNumber: 3, action: 'Verify no side effects (no data corruption, no partial state)', data: '', expectedResult: 'System unchanged, clear error to user' },
        ],
        expectedResult: 'Operation fails safely with clear feedback',
        labels: ['failure-mode', ...c.tags],
        linkedCriterionId: c.id,
      },

      // 3. EDGE CASE — the prod-breaking scenario
      {
        id: generateId('tc'),
        summary: `Edge: ${this.inferEdgeCase(c)}`,
        description: `Test the boundary/edge condition most likely to cause issues in production.`,
        preconditions: c.given,
        category: 'edge_case',
        priority: 'high',
        steps: [
          { stepNumber: 1, action: `Setup: ${c.given}`, data: '', expectedResult: 'Ready' },
          { stepNumber: 2, action: `${this.inferEdgeCaseAction(c)}`, data: this.inferEdgeCaseData(c), expectedResult: 'System handles gracefully' },
          { stepNumber: 3, action: 'Verify system stability and data integrity', data: '', expectedResult: 'No crash, no corruption, recoverable state' },
        ],
        expectedResult: 'System handles edge condition without failure',
        labels: ['edge-case', ...c.tags],
        linkedCriterionId: c.id,
      },
    ];

    return {
      id: generateId('ts'),
      name: this.truncate(c.then, 80),
      description: `Happy path + failure + edge case for: ${c.then}`,
      testCases,
      category: 'functional',
    };
  }

  // ================================================================
  // INTELLIGENT INFERENCE — Senior QE thinking
  // ================================================================

  private inferFailureMode(c: AcceptanceCriterion): string {
    const text = `${c.given} ${c.when} ${c.then}`.toLowerCase();

    if (text.includes('login') || text.includes('auth') || text.includes('token'))
      return 'Attempt with expired/invalid credentials';
    if (text.includes('create') || text.includes('save') || text.includes('add'))
      return 'Submit with missing required fields';
    if (text.includes('delete') || text.includes('remove'))
      return 'Delete non-existent or already-deleted resource';
    if (text.includes('update') || text.includes('edit') || text.includes('modify'))
      return 'Update with stale/conflicting data';
    if (text.includes('display') || text.includes('show') || text.includes('render'))
      return 'Render with missing or null data source';
    if (text.includes('deploy') || text.includes('pipeline') || text.includes('build'))
      return 'Deployment with invalid configuration';
    if (text.includes('api') || text.includes('request') || text.includes('endpoint'))
      return 'Request with malformed payload';
    if (text.includes('flag') || text.includes('toggle') || text.includes('enable'))
      return 'Feature toggled mid-operation';

    return `Attempt action when "${this.truncate(c.given, 40)}" is not satisfied`;
  }

  private inferEdgeCase(c: AcceptanceCriterion): string {
    const text = `${c.given} ${c.when} ${c.then}`.toLowerCase();

    if (text.includes('concurrent') || text.includes('simultaneous'))
      return 'Race condition with concurrent operations';
    if (text.includes('deploy') || text.includes('migration'))
      return 'Rollback mid-deployment / partial failure';
    if (text.includes('payload') || text.includes('claim') || text.includes('jwt'))
      return 'Malformed/oversized JWT payload';
    if (text.includes('flag') || text.includes('config'))
      return 'Config change during active session';
    if (text.includes('health') || text.includes('monitor'))
      return 'Flapping health check (intermittent pass/fail)';
    if (text.includes('ui') || text.includes('page') || text.includes('render'))
      return 'Render under slow network / partial DOM load';
    if (text.includes('scale') || text.includes('load'))
      return 'Behavior under max load / resource exhaustion';

    return `Rapid repeated execution of: ${this.truncate(c.when, 50)}`;
  }

  private inferEdgeCaseAction(c: AcceptanceCriterion): string {
    const text = `${c.given} ${c.when} ${c.then}`.toLowerCase();

    if (text.includes('deploy')) return 'Interrupt deployment mid-process (network drop, timeout)';
    if (text.includes('flag') || text.includes('config')) return 'Toggle the config while operation is in-flight';
    if (text.includes('health')) return 'Simulate intermittent health check failure (flapping)';
    if (text.includes('jwt') || text.includes('payload')) return 'Send payload at max size limit';
    if (text.includes('ui') || text.includes('page')) return 'Rapid navigation away and back during load';

    return `Execute action twice rapidly in quick succession`;
  }

  private inferEdgeCaseData(c: AcceptanceCriterion): string {
    const text = `${c.given} ${c.when} ${c.then}`.toLowerCase();

    if (text.includes('url')) return 'URL with special chars: spaces, unicode, 2048+ chars';
    if (text.includes('deploy')) return 'Simulate 50% pod failure during rollout';
    if (text.includes('jwt') || text.includes('claim')) return 'JWT payload at 8KB limit';
    if (text.includes('user') || text.includes('student')) return 'User with max concurrent sessions';

    return 'Boundary values, null fields, rapid repetition';
  }

  // ================================================================
  // UTILITIES
  // ================================================================

  private truncate(text: string, max: number): string {
    return text.length <= max ? text : text.substring(0, max - 3) + '...';
  }

  private computeSummary(scenarios: TestScenario[]): TestPlan['summary'] {
    const byCategory: Record<TestCategory, number> = {
      positive: 0, negative: 0, edge_case: 0, functional: 0,
      boundary: 0, error_handling: 0, security: 0, performance: 0, api: 0,
    };
    const byPriority: Record<TestPriority, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    let totalTestCases = 0;

    for (const scenario of scenarios) {
      for (const tc of scenario.testCases) {
        totalTestCases++;
        byCategory[tc.category]++;
        byPriority[tc.priority]++;
      }
    }

    return { totalScenarios: scenarios.length, totalTestCases, byCategory, byPriority };
  }
}
