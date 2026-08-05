import * as fs from 'fs';
import * as path from 'path';
import { loadProjectConfig } from '../config';
import { ParsedAcceptanceCriteria, TestCase, TestPlan } from '../types';

const TEMPLATES_DIR = path.join(__dirname, '..', 'projects');

/**
 * Template system for generating test cases with project-specific patterns
 */
export class TemplateSystem {
  private templates: Map<string, string> = new Map();

  /**
   * Load a template by name from project config
   */
  loadTemplate(projectName: string, templateName: string): string | null {
    const projectConfig = loadProjectConfig(projectName);
    if (!projectConfig) {
      console.warn(`Project "${projectName}" not found`);
      return null;
    }

    const templatePath = projectConfig.templates[templateName];
    if (!templatePath) {
      console.warn(`Template "${templateName}" not found for project "${projectName}"`);
      return null;
    }

    const fullPath = path.join(TEMPLATES_DIR, projectName, templatePath);
    if (!fs.existsSync(fullPath)) {
      console.warn(`Template file not found: ${fullPath}`);
      return null;
    }

    const templateContent = fs.readFileSync(fullPath, 'utf-8');
    this.templates.set(`${projectName}:${templateName}`, templateContent);
    return templateContent;
  }

  /**
   * Apply template to acceptance criteria to generate enhanced test plan
   */
  applyTemplate(
    projectName: string,
    templateName: string,
    parsed: ParsedAcceptanceCriteria
  ): ParsedAcceptanceCriteria | null {
    const templateContent = this.loadTemplate(projectName, templateName);
    if (!templateContent) {
      return null;
    }

    // Template-specific enhancements based on template type
    const enhanced = { ...parsed };
    
    // Add template-specific labels and metadata
    enhanced.metadata = {
      ...enhanced.metadata,
      projectName,
    };

    // Apply template-specific transformations
    enhanced.criteria = this.applyTemplateTransformations(
      templateName,
      enhanced.criteria
    );

    return enhanced;
  }

  /**
   * Apply template-specific transformations to criteria
   */
  private applyTemplateTransformations(
    templateName: string,
    criteria: any[]
  ): any[] {
    // Add template-specific tags based on template type
    const templateTags: Record<string, string[]> = {
      'api-testing': ['api', 'endpoint', 'rest', 'protocol'],
      'ui-testing': ['ui', 'frontend', 'visual', 'interaction'],
      'migration': ['migration', 'deployment', 'infrastructure'],
      'security': ['security', 'auth', 'permission', 'owasp'],
      'default': [],
    };

    const tagsToAdd = templateTags[templateName] || templateTags['default'];

    return criteria.map(criterion => ({
      ...criterion,
      tags: [...criterion.tags, ...tagsToAdd],
    }));
  }

  /**
   * List available templates for a project
   */
  listTemplates(projectName: string): string[] {
    const projectConfig = loadProjectConfig(projectName);
    if (!projectConfig) {
      return [];
    }

    return Object.keys(projectConfig.templates);
  }

  /**
   * Get template details for a project
   */
  getTemplateDetails(projectName: string, templateName: string): object | null {
    const projectConfig = loadProjectConfig(projectName);
    if (!projectConfig) {
      return null;
    }

    const templatePath = projectConfig.templates[templateName];
    if (!templatePath) {
      return null;
    }

    const fullPath = path.join(TEMPLATES_DIR, projectName, templatePath);
    if (!fs.existsSync(fullPath)) {
      return null;
    }

    return {
      projectName,
      templateName,
      path: templatePath,
      content: fs.readFileSync(fullPath, 'utf-8'),
      description: this.getTemplateDescription(templateName),
    };
  }

  /**
   * Get description for a template
   */
  private getTemplateDescription(templateName: string): string {
    const descriptions: Record<string, string> = {
      'api-testing': 'Comprehensive API testing with REST/GraphQL patterns, error handling, and security tests',
      'ui-testing': 'UI test patterns covering forms, navigation, accessibility, and responsive design',
      'migration': 'Infrastructure migration testing for ECS→EKS, legacy modernization, and deployment validation',
      'security': 'OWASP-based security testing covering auth, authorization, and input validation',
      'default': 'Standard test generation without template-specific enhancements',
    };
    return descriptions[templateName] || descriptions['default'];
  }
}

export const templateSystem = new TemplateSystem();