import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { AppConfig, ProjectConfig } from './types';

dotenv.config();

const PROJECTS_DIR = path.join(__dirname, '..', 'projects');

/**
 * Load and validate application configuration from environment variables
 */
export function loadConfig(): AppConfig {
  const config: AppConfig = {
    jira: {
      baseUrl: process.env.JIRA_BASE_URL || '',
      email: process.env.JIRA_EMAIL || '',
      apiToken: process.env.JIRA_API_TOKEN || '',
      projectKey: process.env.JIRA_PROJECT_KEY || '',
    },
    xray: {
      clientId: process.env.XRAY_CLIENT_ID || '',
      clientSecret: process.env.XRAY_CLIENT_SECRET || '',
    },
    openaiApiKey: process.env.OPENAI_API_KEY,
    openaiModel: process.env.OPENAI_MODEL || 'gpt-4',
  };

  return config;
}

/**
 * Load project-specific configuration
 */
export function loadProjectConfig(projectName: string): ProjectConfig | null {
  const projectPath = path.join(PROJECTS_DIR, projectName);
  const configPath = path.join(projectPath, 'config.json');

  try {
    if (!fs.existsSync(configPath)) {
      console.warn(`Project configuration not found: ${configPath}`);
      return null;
    }

    const configData = fs.readFileSync(configPath, 'utf-8');
    const projectConfig: ProjectConfig = JSON.parse(configData);
    return projectConfig;
  } catch (error: any) {
    console.error(`Failed to load project config for "${projectName}": ${error.message}`);
    return null;
  }
}

/**
 * List available projects
 */
export function listProjects(): string[] {
  if (!fs.existsSync(PROJECTS_DIR)) {
    return [];
  }

  const items = fs.readdirSync(PROJECTS_DIR);
  return items.filter(item => {
    const itemPath = path.join(PROJECTS_DIR, item);
    return fs.statSync(itemPath).isDirectory();
  });
}

/**
 * Validate that required config values are present for Xray operations
 */
export function validateConfig(config: AppConfig): string[] {
  const errors: string[] = [];

  if (!config.jira.baseUrl) errors.push('JIRA_BASE_URL is required');
  if (!config.jira.email) errors.push('JIRA_EMAIL is required');
  if (!config.jira.apiToken) errors.push('JIRA_API_TOKEN is required');
  if (!config.jira.projectKey) errors.push('JIRA_PROJECT_KEY is required');
  if (!config.xray.clientId) errors.push('XRAY_CLIENT_ID is required');
  if (!config.xray.clientSecret) errors.push('XRAY_CLIENT_SECRET is required');

  return errors;
}

/**
 * Check if config is sufficient for local-only (no Jira push) mode
 */
export function isLocalModeValid(): boolean {
  // Local mode doesn't need any config
  return true;
}

/**
 * Get the acceptance criteria field from project config or fallback to default
 */
export function getAcceptanceCriteriaField(projectConfig?: ProjectConfig): string {
  return projectConfig?.jira?.acceptanceCriteriaField || 'customfield_10195';
}
