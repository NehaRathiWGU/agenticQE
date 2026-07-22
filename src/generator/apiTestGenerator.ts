import {
  AcceptanceCriterion,
  ParsedAcceptanceCriteria,
  TestCase,
  TestScenario,
} from '../types';

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
}

/**
 * ApiTestGenerator
 *
 * Generates 5 crucial API test cases per criterion — one from each area:
 *  1. Happy path (POST create + verify)
 *  2. Status code (401 unauthorized)
 *  3. Auth (cross-user data isolation)
 *  4. Method-specific (idempotency)
 *  5. Security (SQL injection)
 */
export class ApiTestGenerator {

  generateApiScenarios(parsed: ParsedAcceptanceCriteria): TestScenario[] {
    const scenarios: TestScenario[] = [];
    for (const criterion of parsed.criteria) {
      if (this.isApiRelated(criterion)) {
        scenarios.push(this.generateCrucialApiTests(criterion));
      }
    }
    return scenarios.filter(s => s.testCases.length > 0);
  }

  private generateCrucialApiTests(c: AcceptanceCriterion): TestScenario {
    const ep = this.extractEndpoint(c);

    const testCases: TestCase[] = [
      // 1. Happy Path
      this.tc(c, `[API-Happy] POST creates resource, GET confirms`, 'critical', [
        { stepNumber: 1, action: `POST ${ep} with valid auth and body`, data: '{"field":"value"}', expectedResult: 'Status: 201 Created' },
        { stepNumber: 2, action: 'GET the new resource by returned ID', data: '', expectedResult: 'Status: 200, body matches posted data' },
      ], ['api', 'happy-path']),

      // 2. Status Code
      this.tc(c, `[API-401] Unauthorized without valid token`, 'critical', [
        { stepNumber: 1, action: `GET ${ep} with no Authorization header`, data: '', expectedResult: 'Status: 401 Unauthorized' },
        { stepNumber: 2, action: `GET ${ep} with expired/invalid token`, data: 'Authorization: Bearer invalid', expectedResult: 'Status: 401, no data leaked' },
      ], ['api', 'status-code', '401']),

      // 3. Auth
      this.tc(c, `[API-Auth] Cross-user data isolation enforced`, 'critical', [
        { stepNumber: 1, action: `Auth as User A, request User B's resource`, data: `GET ${ep}/{userB_id}`, expectedResult: 'Status: 403 or 404' },
        { stepNumber: 2, action: 'Verify zero data from User B in response', data: '', expectedResult: 'No data leakage' },
      ], ['api', 'auth', 'isolation']),

      // 4. Method-Specific
      this.tc(c, `[API-Method] PUT/DELETE are idempotent`, 'high', [
        { stepNumber: 1, action: `PUT ${ep}/{id} with same body twice`, data: '{"name":"same"}', expectedResult: 'Both return 200, identical response' },
        { stepNumber: 2, action: `DELETE ${ep}/{id} twice`, data: '', expectedResult: '1st: 204, 2nd: 204 or 404 (no crash)' },
      ], ['api', 'idempotency']),

      // 5. Security
      this.tc(c, `[API-Security] SQL injection blocked`, 'critical', [
        { stepNumber: 1, action: `POST ${ep} with SQL payload`, data: '{"name":"\' OR 1=1 --"}', expectedResult: 'Status: 400/422 or stored as literal string' },
        { stepNumber: 2, action: 'Verify DB integrity (no tables dropped)', data: '', expectedResult: 'Database unchanged' },
      ], ['api', 'security', 'injection']),
    ];

    return {
      id: generateId('ts'),
      name: `API Tests: ${this.truncate(c.then, 60)}`,
      description: '5 crucial API tests: happy path, status code, auth, method behavior, security',
      testCases,
      category: 'api',
    };
  }

  private tc(
    c: AcceptanceCriterion,
    summary: string,
    priority: 'critical' | 'high' | 'medium' | 'low',
    steps: TestCase['steps'],
    labels: string[]
  ): TestCase {
    return {
      id: generateId('tc'),
      summary,
      description: summary,
      preconditions: `API running. ${c.given}`,
      category: 'api',
      priority,
      steps,
      expectedResult: steps[steps.length - 1].expectedResult,
      labels: [...labels, ...c.tags],
      linkedCriterionId: c.id,
    };
  }

  private isApiRelated(criterion: AcceptanceCriterion): boolean {
    const text = `${criterion.given} ${criterion.when} ${criterion.then} ${criterion.rawText}`.toLowerCase();
    const keywords = ['api', 'endpoint', 'request', 'response', 'rest', 'graphql',
      'http', 'get', 'post', 'put', 'patch', 'delete', 'json', 'status',
      'payload', 'header', 'token', 'bearer', 'url', 'uri', 'webhook'];
    return keywords.some(kw => text.includes(kw));
  }

  private extractEndpoint(criterion: AcceptanceCriterion): string {
    const text = `${criterion.rawText} ${criterion.when} ${criterion.then}`;
    const match = text.match(/\/[a-z][a-z0-9\-_/{}]*/i);
    return match ? match[0] : '/api/v1/resource';
  }

  private truncate(text: string, max: number): string {
    return text.length <= max ? text : text.substring(0, max - 3) + '...';
  }
}
