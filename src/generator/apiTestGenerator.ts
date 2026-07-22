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
 * Generates API test scenarios covering:
 * 1. Happy path (GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS)
 * 2. Status codes (400, 401, 403, 404, 405, 409, 422, 429, 500)
 * 3. Authentication & Authorization
 * 4. Method-specific behavior (idempotency, partial updates)
 * 5. Security (SQL injection, XSS, mass assignment)
 */
export class ApiTestGenerator {

  generateApiScenarios(parsed: ParsedAcceptanceCriteria): TestScenario[] {
    const scenarios: TestScenario[] = [];
    for (const criterion of parsed.criteria) {
      if (this.isApiRelated(criterion)) {
        scenarios.push(this.happyPath(criterion));
        scenarios.push(this.statusCodes(criterion));
        scenarios.push(this.authTests(criterion));
        scenarios.push(this.methodSpecific(criterion));
        scenarios.push(this.securityTests(criterion));
      }
    }
    return scenarios.filter(s => s.testCases.length > 0);
  }

  // ================================================================
  // 1. HAPPY PATH - All HTTP Methods
  // ================================================================

  private happyPath(c: AcceptanceCriterion): TestScenario {
    const ep = this.extractEndpoint(c);
    const tc: TestCase[] = [
      this.makeCase(c, `[API-GET] Retrieve resource successfully`, 'critical', [
        { stepNumber: 1, action: `Send GET ${ep} with valid auth`, data: 'Authorization: Bearer <valid_token>', expectedResult: 'Status: 200 OK' },
        { stepNumber: 2, action: 'Verify response body matches schema', data: '', expectedResult: 'JSON body with expected fields and types' },
        { stepNumber: 3, action: 'Verify response time', data: '', expectedResult: 'Response < 2000ms' },
      ], ['api', 'get', 'happy-path']),

      this.makeCase(c, `[API-POST] Create resource successfully`, 'critical', [
        { stepNumber: 1, action: `Send POST ${ep} with valid body`, data: '{"field1":"value1","field2":"value2"}', expectedResult: 'Status: 201 Created' },
        { stepNumber: 2, action: 'Verify Location header', data: '', expectedResult: 'Location header contains new resource URL' },
        { stepNumber: 3, action: 'Verify resource persisted via GET', data: '', expectedResult: 'GET returns the created resource' },
      ], ['api', 'post', 'happy-path']),

      this.makeCase(c, `[API-PUT] Full update resource successfully`, 'high', [
        { stepNumber: 1, action: `Send PUT ${ep}/{id} with complete body`, data: '{"field1":"updated","field2":"updated"}', expectedResult: 'Status: 200 OK' },
        { stepNumber: 2, action: 'Verify all fields replaced', data: '', expectedResult: 'Response shows all fields updated' },
        { stepNumber: 3, action: 'Verify via GET', data: '', expectedResult: 'GET confirms full replacement' },
      ], ['api', 'put', 'happy-path']),

      this.makeCase(c, `[API-PATCH] Partial update resource`, 'high', [
        { stepNumber: 1, action: `Send PATCH ${ep}/{id} with partial body`, data: '{"field1":"patched"}', expectedResult: 'Status: 200 OK' },
        { stepNumber: 2, action: 'Verify only specified field changed', data: '', expectedResult: 'field1 updated, field2 unchanged' },
      ], ['api', 'patch', 'happy-path']),

      this.makeCase(c, `[API-DELETE] Remove resource successfully`, 'high', [
        { stepNumber: 1, action: `Send DELETE ${ep}/{id}`, data: '', expectedResult: 'Status: 204 No Content' },
        { stepNumber: 2, action: 'Verify resource removed via GET', data: '', expectedResult: 'GET returns 404' },
      ], ['api', 'delete', 'happy-path']),

      this.makeCase(c, `[API-HEAD] Retrieve headers without body`, 'medium', [
        { stepNumber: 1, action: `Send HEAD ${ep}`, data: '', expectedResult: 'Status: 200 OK' },
        { stepNumber: 2, action: 'Verify response has no body', data: '', expectedResult: 'Content-Length present but body empty' },
      ], ['api', 'head', 'happy-path']),

      this.makeCase(c, `[API-OPTIONS] Retrieve allowed methods`, 'medium', [
        { stepNumber: 1, action: `Send OPTIONS ${ep}`, data: '', expectedResult: 'Status: 200 or 204' },
        { stepNumber: 2, action: 'Verify Allow header', data: '', expectedResult: 'Allow: GET, POST, PUT, PATCH, DELETE' },
      ], ['api', 'options', 'happy-path']),
    ];

    return { id: generateId('ts'), name: `API Happy Path: ${this.truncate(c.then, 50)}`, description: 'All HTTP methods succeed with valid input', testCases: tc, category: 'api' };
  }

  // ================================================================
  // 2. STATUS CODES
  // ================================================================

  private statusCodes(c: AcceptanceCriterion): TestScenario {
    const ep = this.extractEndpoint(c);
    const tc: TestCase[] = [
      this.makeCase(c, `[API-400] Bad Request - malformed JSON`, 'high', [
        { stepNumber: 1, action: `Send POST ${ep} with malformed body`, data: '{"invalid json:}', expectedResult: 'Status: 400 Bad Request' },
        { stepNumber: 2, action: 'Verify error structure', data: '', expectedResult: '{"error":"...", "message":"..."}' },
      ], ['api', '400']),

      this.makeCase(c, `[API-401] Unauthorized - no/invalid token`, 'critical', [
        { stepNumber: 1, action: `Send GET ${ep} with no auth header`, data: '', expectedResult: 'Status: 401 Unauthorized' },
        { stepNumber: 2, action: `Send GET ${ep} with invalid token`, data: 'Authorization: Bearer invalid_xyz', expectedResult: 'Status: 401' },
      ], ['api', '401']),

      this.makeCase(c, `[API-403] Forbidden - insufficient role`, 'high', [
        { stepNumber: 1, action: `Auth as low-privilege user, send request to admin endpoint`, data: 'Role: viewer', expectedResult: 'Status: 403 Forbidden' },
        { stepNumber: 2, action: 'Verify error indicates missing permission', data: '', expectedResult: 'Message identifies required role' },
      ], ['api', '403']),

      this.makeCase(c, `[API-404] Not Found - non-existent resource`, 'high', [
        { stepNumber: 1, action: `Send GET ${ep}/non-existent-id-999`, data: '', expectedResult: 'Status: 404 Not Found' },
        { stepNumber: 2, action: 'Verify no stack trace exposed', data: '', expectedResult: 'Safe error message only' },
      ], ['api', '404']),

      this.makeCase(c, `[API-405] Method Not Allowed`, 'medium', [
        { stepNumber: 1, action: `Send TRACE ${ep}`, data: '', expectedResult: 'Status: 405' },
        { stepNumber: 2, action: 'Verify Allow header lists valid methods', data: '', expectedResult: 'Allow: GET, POST, ...' },
      ], ['api', '405']),

      this.makeCase(c, `[API-409] Conflict - duplicate creation`, 'medium', [
        { stepNumber: 1, action: `Send POST ${ep} with duplicate unique field`, data: '{"email":"existing@test.com"}', expectedResult: 'Status: 409 Conflict' },
        { stepNumber: 2, action: 'Verify conflict field identified', data: '', expectedResult: 'Error identifies conflicting field' },
      ], ['api', '409']),

      this.makeCase(c, `[API-422] Unprocessable Entity - validation failure`, 'high', [
        { stepNumber: 1, action: `Send POST ${ep} with semantically invalid data`, data: '{"email":"not-an-email","age":-1}', expectedResult: 'Status: 422' },
        { stepNumber: 2, action: 'Verify per-field error messages', data: '', expectedResult: 'Array of {field, message} errors' },
      ], ['api', '422']),

      this.makeCase(c, `[API-429] Rate limit exceeded`, 'medium', [
        { stepNumber: 1, action: `Send 100+ rapid requests to ${ep}`, data: '', expectedResult: 'Status: 429 Too Many Requests' },
        { stepNumber: 2, action: 'Verify Retry-After header', data: '', expectedResult: 'Retry-After: <seconds>' },
      ], ['api', '429']),

      this.makeCase(c, `[API-500] Server error - no info leakage`, 'high', [
        { stepNumber: 1, action: 'Trigger server error condition', data: '', expectedResult: 'Status: 500' },
        { stepNumber: 2, action: 'Verify no stack trace or internal path exposed', data: '', expectedResult: 'Generic error with correlation_id only' },
      ], ['api', '500']),
    ];

    return { id: generateId('ts'), name: `API Status Codes: ${this.truncate(c.then, 50)}`, description: 'Verify correct HTTP status codes for error conditions', testCases: tc, category: 'api' };
  }

  // ================================================================
  // 3. AUTHENTICATION & AUTHORIZATION
  // ================================================================

  private authTests(c: AcceptanceCriterion): TestScenario {
    const ep = this.extractEndpoint(c);
    const tc: TestCase[] = [
      this.makeCase(c, `[API-Auth] No token provided`, 'critical', [
        { stepNumber: 1, action: `Send GET ${ep} without Authorization header`, data: '', expectedResult: 'Status: 401' },
        { stepNumber: 2, action: 'Verify no resource data leaked', data: '', expectedResult: 'Response body has error only, no data' },
      ], ['api', 'auth', 'security']),

      this.makeCase(c, `[API-Auth] Expired token`, 'critical', [
        { stepNumber: 1, action: `Send request with expired JWT`, data: 'Authorization: Bearer <expired_token>', expectedResult: 'Status: 401' },
        { stepNumber: 2, action: 'Verify token expiry indicated', data: '', expectedResult: 'Error: "Token expired"' },
      ], ['api', 'auth', 'token']),

      this.makeCase(c, `[API-Auth] Malformed/tampered token`, 'high', [
        { stepNumber: 1, action: `Send request with tampered JWT signature`, data: 'Authorization: Bearer abc.def.tampered', expectedResult: 'Status: 401' },
        { stepNumber: 2, action: 'Verify no info about validation logic', data: '', expectedResult: 'Generic auth error only' },
      ], ['api', 'auth', 'token']),

      this.makeCase(c, `[API-Auth] Cross-tenant / cross-user access`, 'critical', [
        { stepNumber: 1, action: `Auth as User A, access User B's resource`, data: `GET ${ep}/{userB_id}`, expectedResult: 'Status: 403 or 404' },
        { stepNumber: 2, action: 'Verify no data from User B returned', data: '', expectedResult: 'Zero data leakage' },
      ], ['api', 'auth', 'tenant-isolation']),

      this.makeCase(c, `[API-Auth] RBAC enforcement`, 'high', [
        { stepNumber: 1, action: `Auth as viewer, attempt POST ${ep}`, data: '', expectedResult: 'Status: 403 (write denied)' },
        { stepNumber: 2, action: `Auth as viewer, attempt DELETE ${ep}/{id}`, data: '', expectedResult: 'Status: 403 (delete denied)' },
        { stepNumber: 3, action: `Auth as admin, repeat same operations`, data: '', expectedResult: 'Status: 201 / 204 (all succeed)' },
      ], ['api', 'auth', 'rbac']),
    ];

    return { id: generateId('ts'), name: `API Auth: ${this.truncate(c.then, 50)}`, description: 'Authentication and authorization enforcement', testCases: tc, category: 'api' };
  }

  // ================================================================
  // 4. METHOD-SPECIFIC BEHAVIOR
  // ================================================================

  private methodSpecific(c: AcceptanceCriterion): TestScenario {
    const ep = this.extractEndpoint(c);
    const tc: TestCase[] = [
      this.makeCase(c, `[API-Method] PUT is idempotent`, 'high', [
        { stepNumber: 1, action: `Send PUT ${ep}/{id} with same body twice`, data: '{"name":"same"}', expectedResult: 'Both return 200 with identical response' },
        { stepNumber: 2, action: 'Verify resource unchanged after second PUT', data: '', expectedResult: 'No extra records, no version bump beyond first' },
      ], ['api', 'idempotency', 'put']),

      this.makeCase(c, `[API-Method] DELETE is idempotent`, 'high', [
        { stepNumber: 1, action: `Send DELETE ${ep}/{id} (resource exists)`, data: '', expectedResult: 'Status: 204' },
        { stepNumber: 2, action: `Send DELETE ${ep}/{id} again (already deleted)`, data: '', expectedResult: 'Status: 204 or 404 (no error/crash)' },
      ], ['api', 'idempotency', 'delete']),

      this.makeCase(c, `[API-Method] POST is NOT idempotent`, 'medium', [
        { stepNumber: 1, action: `Send POST ${ep} with same body twice`, data: '{"name":"item"}', expectedResult: 'Two 201 responses with different IDs' },
        { stepNumber: 2, action: 'Verify two distinct resources created', data: '', expectedResult: 'GET returns both resources' },
      ], ['api', 'idempotency', 'post']),

      this.makeCase(c, `[API-Method] PATCH with no-op body`, 'medium', [
        { stepNumber: 1, action: `Send PATCH ${ep}/{id} with empty changes`, data: '{}', expectedResult: 'Status: 200 (no error)' },
        { stepNumber: 2, action: 'Verify resource unchanged', data: '', expectedResult: 'All fields retain original values' },
      ], ['api', 'patch', 'no-op']),

      this.makeCase(c, `[API-Method] GET with query params/filtering`, 'high', [
        { stepNumber: 1, action: `Send GET ${ep}?status=active&limit=10&offset=0`, data: '', expectedResult: 'Status: 200 with filtered results' },
        { stepNumber: 2, action: 'Verify pagination metadata', data: '', expectedResult: 'Response includes total, page, limit fields' },
        { stepNumber: 3, action: `Send GET ${ep}?sort=created_at&order=desc`, data: '', expectedResult: 'Results sorted correctly' },
      ], ['api', 'get', 'filtering', 'pagination']),

      this.makeCase(c, `[API-Method] GET with invalid query params`, 'medium', [
        { stepNumber: 1, action: `Send GET ${ep}?limit=-1&offset=abc`, data: '', expectedResult: 'Status: 400 or uses defaults' },
        { stepNumber: 2, action: `Send GET ${ep}?unknown_param=xyz`, data: '', expectedResult: 'Unknown params ignored (200) or rejected (400)' },
      ], ['api', 'get', 'query-params', 'negative']),
    ];

    return { id: generateId('ts'), name: `API Method-Specific: ${this.truncate(c.then, 50)}`, description: 'Idempotency, query params, and method-specific behavior', testCases: tc, category: 'api' };
  }

  // ================================================================
  // 5. SECURITY TESTS
  // ================================================================

  private securityTests(c: AcceptanceCriterion): TestScenario {
    const ep = this.extractEndpoint(c);
    const tc: TestCase[] = [
      this.makeCase(c, `[API-Security] SQL injection in body`, 'critical', [
        { stepNumber: 1, action: `Send POST ${ep} with SQL payload`, data: '{"name":"\' OR 1=1 --","search":"admin\'; DROP TABLE users;--"}', expectedResult: 'Status: 400/422 or stored as literal string' },
        { stepNumber: 2, action: 'Verify database integrity', data: '', expectedResult: 'No tables dropped, no data leaked' },
      ], ['api', 'security', 'injection']),

      this.makeCase(c, `[API-Security] SQL injection in query params`, 'critical', [
        { stepNumber: 1, action: `Send GET ${ep}?id=1 OR 1=1&name=admin'--`, data: '', expectedResult: 'Status: 400 or params safely escaped' },
        { stepNumber: 2, action: 'Verify no extra data returned', data: '', expectedResult: 'Only authorized data visible' },
      ], ['api', 'security', 'injection']),

      this.makeCase(c, `[API-Security] XSS payload in body`, 'high', [
        { stepNumber: 1, action: `Send POST ${ep} with XSS`, data: '{"name":"<script>alert(1)</script>","bio":"<img onerror=alert(1) src=x>"}', expectedResult: 'Input rejected (400) or stored HTML-encoded' },
        { stepNumber: 2, action: 'Retrieve via GET and verify encoding', data: '', expectedResult: 'No executable scripts in response' },
      ], ['api', 'security', 'xss']),

      this.makeCase(c, `[API-Security] Mass assignment / parameter pollution`, 'high', [
        { stepNumber: 1, action: `Send POST ${ep} with extra privileged fields`, data: '{"name":"user","role":"admin","isVerified":true}', expectedResult: 'Extra fields ignored' },
        { stepNumber: 2, action: 'Verify user not escalated', data: '', expectedResult: 'role and isVerified NOT applied' },
      ], ['api', 'security', 'mass-assignment']),

      this.makeCase(c, `[API-Security] Path traversal`, 'high', [
        { stepNumber: 1, action: `Send GET ${ep}/../../etc/passwd`, data: '', expectedResult: 'Status: 400 or 404 (no file access)' },
        { stepNumber: 2, action: `Send GET ${ep}/%2e%2e%2f%2e%2e%2fetc/passwd`, data: '', expectedResult: 'Status: 400 or 404' },
      ], ['api', 'security', 'path-traversal']),

      this.makeCase(c, `[API-Security] Oversized request body (DoS)`, 'medium', [
        { stepNumber: 1, action: `Send POST ${ep} with 50MB body`, data: '<50MB JSON payload>', expectedResult: 'Status: 413 Payload Too Large' },
        { stepNumber: 2, action: 'Verify server remains responsive after', data: '', expectedResult: 'Subsequent requests succeed normally' },
      ], ['api', 'security', 'dos']),

      this.makeCase(c, `[API-Security] HTTPS enforcement`, 'critical', [
        { stepNumber: 1, action: `Send request over HTTP (non-TLS)`, data: '', expectedResult: 'Status: 301/308 redirect to HTTPS or connection refused' },
        { stepNumber: 2, action: 'Verify HSTS header on HTTPS response', data: '', expectedResult: 'Strict-Transport-Security header present' },
      ], ['api', 'security', 'https']),
    ];

    return { id: generateId('ts'), name: `API Security: ${this.truncate(c.then, 50)}`, description: 'Injection, XSS, mass assignment, and transport security', testCases: tc, category: 'api' };
  }

  // ================================================================
  // UTILITIES
  // ================================================================

  private makeCase(
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
      preconditions: `API is running. ${c.given}`,
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
    const apiKeywords = ['api', 'endpoint', 'request', 'response', 'rest', 'graphql',
      'http', 'get', 'post', 'put', 'patch', 'delete', 'json', 'status code',
      'payload', 'header', 'token', 'bearer', 'url', 'uri', 'webhook'];
    return apiKeywords.some(kw => text.includes(kw));
  }

  private extractEndpoint(criterion: AcceptanceCriterion): string {
    const text = `${criterion.rawText} ${criterion.when} ${criterion.then}`;
    const urlMatch = text.match(/\/[a-z][a-z0-9\-_/{}]*/i);
    return urlMatch ? urlMatch[0] : '/api/v1/resource';
  }

  private truncate(text: string, max: number): string {
    return text.length <= max ? text : text.substring(0, max - 3) + '...';
  }
}
