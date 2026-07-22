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
 * Generates a focused set of 15 crucial API test cases per criterion:
 *  - 5 Happy path (GET, POST, PUT, PATCH, DELETE)
 *  - 4 Status codes (401, 403, 404, 422)
 *  - 3 Auth (no token, expired token, cross-user)
 *  - 1 Method-specific (idempotency)
 *  - 2 Security (SQL injection, XSS)
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
      // --- HAPPY PATH (5) ---
      this.tc(c, `[API-GET] Retrieve resource - 200 OK`, 'critical', [
        { stepNumber: 1, action: `GET ${ep} with valid Bearer token`, data: '', expectedResult: 'Status: 200' },
        { stepNumber: 2, action: 'Validate response body schema and data', data: '', expectedResult: 'JSON matches expected schema' },
      ], ['api', 'get', 'happy-path']),

      this.tc(c, `[API-POST] Create resource - 201 Created`, 'critical', [
        { stepNumber: 1, action: `POST ${ep} with valid body`, data: '{"field":"value"}', expectedResult: 'Status: 201' },
        { stepNumber: 2, action: 'Verify resource persisted (GET by new ID)', data: '', expectedResult: 'Resource exists' },
      ], ['api', 'post', 'happy-path']),

      this.tc(c, `[API-PUT] Full update resource - 200 OK`, 'high', [
        { stepNumber: 1, action: `PUT ${ep}/{id} with complete body`, data: '{"field":"updated"}', expectedResult: 'Status: 200' },
        { stepNumber: 2, action: 'Verify all fields replaced', data: '', expectedResult: 'Full replacement confirmed' },
      ], ['api', 'put', 'happy-path']),

      this.tc(c, `[API-PATCH] Partial update - 200 OK`, 'high', [
        { stepNumber: 1, action: `PATCH ${ep}/{id} with partial body`, data: '{"field":"patched"}', expectedResult: 'Status: 200' },
        { stepNumber: 2, action: 'Verify only targeted field changed', data: '', expectedResult: 'Other fields unchanged' },
      ], ['api', 'patch', 'happy-path']),

      this.tc(c, `[API-DELETE] Remove resource - 204`, 'high', [
        { stepNumber: 1, action: `DELETE ${ep}/{id}`, data: '', expectedResult: 'Status: 204 No Content' },
        { stepNumber: 2, action: 'GET same ID returns 404', data: '', expectedResult: 'Resource gone' },
      ], ['api', 'delete', 'happy-path']),

      // --- STATUS CODES (4) ---
      this.tc(c, `[API-401] Unauthorized - invalid/missing token`, 'critical', [
        { stepNumber: 1, action: `GET ${ep} without Authorization header`, data: '', expectedResult: 'Status: 401' },
        { stepNumber: 2, action: `GET ${ep} with invalid token`, data: 'Authorization: Bearer bad_token', expectedResult: 'Status: 401' },
      ], ['api', '401', 'status-code']),

      this.tc(c, `[API-403] Forbidden - insufficient permissions`, 'high', [
        { stepNumber: 1, action: `Auth as viewer, attempt POST ${ep}`, data: '', expectedResult: 'Status: 403' },
        { stepNumber: 2, action: 'Verify error indicates required role', data: '', expectedResult: 'Message names required permission' },
      ], ['api', '403', 'status-code']),

      this.tc(c, `[API-404] Not Found - non-existent resource`, 'high', [
        { stepNumber: 1, action: `GET ${ep}/non-existent-id-999`, data: '', expectedResult: 'Status: 404' },
        { stepNumber: 2, action: 'Verify no internal details leaked', data: '', expectedResult: 'Safe error message only' },
      ], ['api', '404', 'status-code']),

      this.tc(c, `[API-422] Validation error - invalid field values`, 'high', [
        { stepNumber: 1, action: `POST ${ep} with invalid data`, data: '{"email":"not-email","age":-1}', expectedResult: 'Status: 422' },
        { stepNumber: 2, action: 'Verify per-field error messages returned', data: '', expectedResult: 'Errors array with field-level details' },
      ], ['api', '422', 'status-code']),

      // --- AUTH (3) ---
      this.tc(c, `[API-Auth] Expired token rejected`, 'critical', [
        { stepNumber: 1, action: `Send request with expired JWT`, data: 'Authorization: Bearer <expired>', expectedResult: 'Status: 401' },
        { stepNumber: 2, action: 'Verify error indicates expiration', data: '', expectedResult: '"Token expired" or equivalent' },
      ], ['api', 'auth', 'expired-token']),

      this.tc(c, `[API-Auth] Cross-user data isolation`, 'critical', [
        { stepNumber: 1, action: `Auth as User A, request User B's resource`, data: `GET ${ep}/{userB_id}`, expectedResult: 'Status: 403 or 404' },
        { stepNumber: 2, action: 'Verify zero data from User B returned', data: '', expectedResult: 'No data leakage' },
      ], ['api', 'auth', 'isolation']),

      this.tc(c, `[API-Auth] RBAC - read-only cannot write/delete`, 'high', [
        { stepNumber: 1, action: `Auth as read-only role, POST ${ep}`, data: '', expectedResult: 'Status: 403' },
        { stepNumber: 2, action: `Auth as read-only role, DELETE ${ep}/{id}`, data: '', expectedResult: 'Status: 403' },
      ], ['api', 'auth', 'rbac']),

      // --- METHOD-SPECIFIC (1) ---
      this.tc(c, `[API-Method] PUT/DELETE idempotency`, 'high', [
        { stepNumber: 1, action: `PUT ${ep}/{id} same body twice`, data: '{"name":"same"}', expectedResult: 'Both return 200, identical response' },
        { stepNumber: 2, action: `DELETE ${ep}/{id} twice`, data: '', expectedResult: 'First: 204, second: 204 or 404 (no crash)' },
      ], ['api', 'idempotency']),

      // --- SECURITY (2) ---
      this.tc(c, `[API-Security] SQL injection blocked`, 'critical', [
        { stepNumber: 1, action: `POST ${ep} with SQL payload in body`, data: '{"name":"\' OR 1=1 --"}', expectedResult: 'Status: 400/422 or stored as literal' },
        { stepNumber: 2, action: `GET ${ep}?search=admin';DROP TABLE users;--`, data: '', expectedResult: 'No SQL executed, DB intact' },
      ], ['api', 'security', 'injection']),

      this.tc(c, `[API-Security] XSS payload neutralized`, 'high', [
        { stepNumber: 1, action: `POST ${ep} with XSS payload`, data: '{"name":"<script>alert(1)</script>"}', expectedResult: 'Rejected (400) or stored HTML-encoded' },
        { stepNumber: 2, action: 'GET resource, verify no executable script', data: '', expectedResult: 'Value is escaped, not executable' },
      ], ['api', 'security', 'xss']),
    ];

    return {
      id: generateId('ts'),
      name: `API Tests: ${this.truncate(c.then, 60)}`,
      description: '15 crucial API tests: happy path, status codes, auth, method behavior, security',
      testCases,
      category: 'api',
    };
  }

  // ================================================================
  // UTILITIES
  // ================================================================

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
