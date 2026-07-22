import * as dotenv from 'dotenv';
import { AppConfig } from './types';

dotenv.config();

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
