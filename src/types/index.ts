// ============================================================
// Core Types for the Xray Test Generator
// ============================================================

/**
 * Represents a parsed acceptance criterion
 */
export interface AcceptanceCriterion {
  id: string;
  given: string;
  when: string;
  then: string;
  rawText: string;
  tags: string[];
}

/**
 * Parsed acceptance criteria document
 */
export interface ParsedAcceptanceCriteria {
  title: string;
  description: string;
  criteria: AcceptanceCriterion[];
  metadata: {
    source: string;
    parsedAt: string;
    totalCriteria: number;
    template?: string;
    projectName?: string;
  };
}

/**
 * Test category types
 */
export type TestCategory =
  | 'positive'
  | 'negative'
  | 'edge_case'
  | 'functional'
  | 'boundary'
  | 'error_handling'
  | 'security'
  | 'performance'
  | 'api';

/**
 * HTTP method types for API tests
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

/**
 * Represents a parsed API endpoint from acceptance criteria
 */
export interface ApiEndpoint {
  method: HttpMethod;
  path: string;
  description: string;
  requestBody?: string;
  responseCode?: number;
  authentication?: string;
}

/**
 * API-specific test case with request/response details
 */
export interface ApiTestCase extends TestCase {
  apiDetails?: {
    method: HttpMethod;
    endpoint: string;
    headers: Record<string, string>;
    requestBody?: object | string;
    expectedStatusCode: number;
    expectedResponseSchema?: string;
  };
}

/**
 * Test priority levels
 */
export type TestPriority = 'critical' | 'high' | 'medium' | 'low';

/**
 * A single test step
 */
export interface TestStep {
  stepNumber: number;
  action: string;
  data: string;
  expectedResult: string;
}

/**
 * A generated test case
 */
export interface TestCase {
  id: string;
  summary: string;
  description: string;
  preconditions: string;
  category: TestCategory;
  priority: TestPriority;
  steps: TestStep[];
  expectedResult: string;
  labels: string[];
  linkedCriterionId: string;
}

/**
 * A test scenario grouping related test cases
 */
export interface TestScenario {
  id: string;
  name: string;
  description: string;
  testCases: TestCase[];
  category: TestCategory;
}

/**
 * A test plan containing multiple scenarios
 */
export interface TestPlan {
  name: string;
  description: string;
  scenarios: TestScenario[];
  summary: {
    totalScenarios: number;
    totalTestCases: number;
    byCategory: Record<TestCategory, number>;
    byPriority: Record<TestPriority, number>;
  };
}

// ============================================================
// Jira / Xray API Types
// ============================================================

/**
 * Xray test step for API submission
 */
export interface XrayTestStep {
  action: string;
  data: string;
  result: string;
}

/**
 * Xray test case for API submission
 */
export interface XrayTestCase {
  testtype: string;
  fields: {
    summary: string;
    description: string;
    project: { key: string };
    issuetype: { name: string };
    labels: string[];
    priority: { name: string };
  };
  xpiSteps?: XrayTestStep[];
}

/**
 * Xray test set for API submission
 */
export interface XrayTestSet {
  fields: {
    summary: string;
    description: string;
    project: { key: string };
    issuetype: { name: string };
  };
  testKeys: string[];
}

/**
 * Xray test plan for API submission
 */
export interface XrayTestPlan {
  fields: {
    summary: string;
    description: string;
    project: { key: string };
    issuetype: { name: string };
  };
  testKeys: string[];
}

/**
 * Configuration for Jira/Xray connection
 */
export interface JiraConfig {
  baseUrl: string;
  email: string;
  apiToken: string;
  projectKey: string;
}

/**
 * Configuration for Xray Cloud API
 */
export interface XrayCloudConfig {
  clientId: string;
  clientSecret: string;
}

/**
 * Combined application configuration
 */
export interface AppConfig {
  jira: JiraConfig;
  xray: XrayCloudConfig;
  openaiApiKey?: string;
  openaiModel?: string;
}

/**
 * Project-specific configuration
 */
export interface ProjectConfig {
  name: string;
  key: string;
  description?: string;
  jira: {
    projectKey: string;
    acceptanceCriteriaField?: string;
  };
  templates: Record<string, string>;
  fieldMappings?: {
    priority?: Record<string, string>;
    categoryKeywords?: Record<string, string[]>;
  };
  environments?: string[];
  defaultEnvironment?: string;
}

/**
 * Result of creating items in Xray
 */
export interface XrayCreationResult {
  testPlanKey?: string;
  testSetKeys: string[];
  testCaseKeys: string[];
  errors: string[];
  summary: string;
}

/**
 * Input format for the tool - can come from file, YAML, or direct text
 */
export interface TestGenerationInput {
  title: string;
  description?: string;
  acceptanceCriteria: string;
  additionalContext?: string;
  jiraIssueKey?: string;
}
