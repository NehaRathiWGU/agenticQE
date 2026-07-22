#!/usr/bin/env node

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { AcceptanceCriteriaParser } from './parser';
import { TestCaseGenerator } from './generator';
import { XrayClient } from './xray';
import { loadConfig, validateConfig } from './config';
import { TestPlan } from './types';

const program = new Command();

program
  .name('xray-testgen')
  .description('Generate comprehensive test cases for Jira Xray from acceptance criteria')
  .version('1.0.0');

// ================================================================
// GENERATE COMMAND - Generate test cases from acceptance criteria
// ================================================================

program
  .command('generate')
  .description('Generate test cases from acceptance criteria')
  .option('-f, --file <path>', 'Path to a file containing acceptance criteria')
  .option('-t, --text <text>', 'Acceptance criteria as direct text input')
  .option('-n, --name <name>', 'Name/title for the test plan', 'Generated Test Plan')
  .option('-o, --output <path>', 'Output file path for generated tests (JSON)')
  .option('--push', 'Push generated tests to Jira Xray', false)
  .option('--link <issueKey>', 'Link generated tests to an existing Jira issue')
  .option('--categories <categories>', 'Comma-separated test categories to generate', 'positive,negative,edge_case,functional,boundary,error_handling')
  .action(async (options) => {
    try {
      console.log(chalk.bold.blue('\n🧪 Xray Test Generator\n'));

      // Get input text
      let inputText: string;

      if (options.file) {
        const filePath = path.resolve(options.file);
        if (!fs.existsSync(filePath)) {
          console.error(chalk.red(`File not found: ${filePath}`));
          process.exit(1);
        }
        inputText = fs.readFileSync(filePath, 'utf-8');
        console.log(chalk.gray(`  Reading from: ${filePath}`));
      } else if (options.text) {
        inputText = options.text;
      } else {
        console.error(chalk.red('Please provide input via --file or --text'));
        program.help();
        return;
      }

      // Step 1: Parse acceptance criteria
      const parseSpinner = ora('Parsing acceptance criteria...').start();
      const parser = new AcceptanceCriteriaParser();
      const parsed = parser.parse(inputText, options.name);
      parseSpinner.succeed(`Parsed ${parsed.criteria.length} acceptance criteria`);

      if (parsed.criteria.length === 0) {
        console.log(chalk.yellow('\n⚠ No acceptance criteria could be parsed from the input.'));
        console.log(chalk.gray('  Tip: Use Given/When/Then format or numbered lists for best results.'));
        process.exit(1);
      }

      // Step 2: Generate test cases
      const genSpinner = ora('Generating test cases...').start();
      const generator = new TestCaseGenerator();
      const testPlan = generator.generateTestPlan(parsed);
      genSpinner.succeed(`Generated ${testPlan.summary.totalTestCases} test cases in ${testPlan.summary.totalScenarios} scenarios`);

      // Print summary
      printTestPlanSummary(testPlan);

      // Step 3: Output results
      if (options.output) {
        const outputPath = path.resolve(options.output);
        fs.writeFileSync(outputPath, JSON.stringify(testPlan, null, 2), 'utf-8');
        console.log(chalk.green(`\n✓ Test plan saved to: ${outputPath}`));
      } else {
        // Default output to ./generated-tests.json
        const defaultOutput = path.resolve('./generated-tests.json');
        fs.writeFileSync(defaultOutput, JSON.stringify(testPlan, null, 2), 'utf-8');
        console.log(chalk.green(`\n✓ Test plan saved to: ${defaultOutput}`));
      }

      // Step 4: Push to Xray (if requested)
      if (options.push) {
        await pushToXray(testPlan, options.link);
      }

      console.log(chalk.bold.green('\n✅ Done!\n'));
    } catch (error: any) {
      console.error(chalk.red(`\nError: ${error.message}`));
      process.exit(1);
    }
  });

// ================================================================
// VALIDATE COMMAND - Validate Jira/Xray connection
// ================================================================

program
  .command('validate')
  .description('Validate Jira/Xray configuration and connection')
  .action(async () => {
    console.log(chalk.bold.blue('\n🔗 Validating Configuration\n'));

    const config = loadConfig();
    const errors = validateConfig(config);

    if (errors.length > 0) {
      console.log(chalk.red('Configuration errors:'));
      errors.forEach(e => console.log(chalk.red(`  ✗ ${e}`)));
      console.log(chalk.gray('\n  Copy .env.example to .env and fill in your values.'));
      process.exit(1);
    }

    console.log(chalk.green('  ✓ All required environment variables set'));

    const spinner = ora('Testing Jira connection...').start();
    const xray = new XrayClient(config);

    const connected = await xray.validateConnection();
    if (connected) {
      spinner.succeed('Jira connection successful');
    } else {
      spinner.fail('Cannot connect to Jira');
      process.exit(1);
    }

    const authSpinner = ora('Authenticating with Xray...').start();
    try {
      await xray.authenticate();
      authSpinner.succeed('Xray authentication successful');
    } catch (error: any) {
      authSpinner.fail(`Xray authentication failed: ${error.message}`);
      process.exit(1);
    }

    console.log(chalk.bold.green('\n✅ All validations passed!\n'));
  });

// ================================================================
// PREVIEW COMMAND - Preview generated tests without pushing
// ================================================================

program
  .command('preview')
  .description('Preview test cases that would be generated (no Jira push)')
  .option('-f, --file <path>', 'Path to a file containing acceptance criteria')
  .option('-t, --text <text>', 'Acceptance criteria as direct text input')
  .option('-n, --name <name>', 'Name/title for the test plan', 'Preview Test Plan')
  .action(async (options) => {
    try {
      console.log(chalk.bold.blue('\n👁 Preview Mode\n'));

      let inputText: string;

      if (options.file) {
        inputText = fs.readFileSync(path.resolve(options.file), 'utf-8');
      } else if (options.text) {
        inputText = options.text;
      } else {
        console.error(chalk.red('Please provide input via --file or --text'));
        return;
      }

      const parser = new AcceptanceCriteriaParser();
      const parsed = parser.parse(inputText, options.name);

      console.log(chalk.bold('Parsed Criteria:'));
      parsed.criteria.forEach((c, i) => {
        console.log(chalk.cyan(`\n  ${i + 1}. Criterion [${c.id}]`));
        console.log(chalk.gray(`     Given: ${c.given}`));
        console.log(chalk.gray(`     When:  ${c.when}`));
        console.log(chalk.gray(`     Then:  ${c.then}`));
        if (c.tags.length > 0) {
          console.log(chalk.yellow(`     Tags:  ${c.tags.join(', ')}`));
        }
      });

      const generator = new TestCaseGenerator();
      const testPlan = generator.generateTestPlan(parsed);

      console.log(chalk.bold('\n\nGenerated Test Plan:'));
      printTestPlanSummary(testPlan);

      // Show sample test cases
      console.log(chalk.bold('\nSample Test Cases:'));
      const samples = testPlan.scenarios.slice(0, 3);
      for (const scenario of samples) {
        console.log(chalk.cyan(`\n  📋 ${scenario.name}`));
        for (const tc of scenario.testCases.slice(0, 2)) {
          console.log(chalk.white(`     • ${tc.summary}`));
          console.log(chalk.gray(`       Priority: ${tc.priority} | Steps: ${tc.steps.length}`));
        }
        if (scenario.testCases.length > 2) {
          console.log(chalk.gray(`       ... and ${scenario.testCases.length - 2} more tests`));
        }
      }

      console.log(chalk.gray(`\n  ... and ${testPlan.scenarios.length - 3} more scenarios`));
      console.log(chalk.bold.blue('\n  Use "generate --push" to create these in Jira Xray.\n'));
    } catch (error: any) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

// ================================================================
// HELPER FUNCTIONS
// ================================================================

function printTestPlanSummary(testPlan: TestPlan): void {
  console.log(chalk.bold('\n  📊 Test Plan Summary:'));
  console.log(chalk.white(`     Name:       ${testPlan.name}`));
  console.log(chalk.white(`     Scenarios:  ${testPlan.summary.totalScenarios}`));
  console.log(chalk.white(`     Test Cases: ${testPlan.summary.totalTestCases}`));
  console.log(chalk.bold('\n  By Category:'));
  console.log(chalk.green(`     ✓ Positive:       ${testPlan.summary.byCategory.positive}`));
  console.log(chalk.red(`     ✗ Negative:       ${testPlan.summary.byCategory.negative}`));
  console.log(chalk.yellow(`     ⚡ Edge Cases:     ${testPlan.summary.byCategory.edge_case}`));
  console.log(chalk.blue(`     🔧 Functional:    ${testPlan.summary.byCategory.functional}`));
  console.log(chalk.magenta(`     📏 Boundary:      ${testPlan.summary.byCategory.boundary}`));
  console.log(chalk.cyan(`     🛡 Error Handling: ${testPlan.summary.byCategory.error_handling}`));
  console.log(chalk.bold('\n  By Priority:'));
  console.log(chalk.red(`     Critical: ${testPlan.summary.byPriority.critical}`));
  console.log(chalk.yellow(`     High:     ${testPlan.summary.byPriority.high}`));
  console.log(chalk.blue(`     Medium:   ${testPlan.summary.byPriority.medium}`));
  console.log(chalk.gray(`     Low:      ${testPlan.summary.byPriority.low}`));
}

async function pushToXray(testPlan: TestPlan, linkIssueKey?: string): Promise<void> {
  const config = loadConfig();
  const errors = validateConfig(config);

  if (errors.length > 0) {
    console.log(chalk.red('\n  Cannot push to Xray - configuration errors:'));
    errors.forEach(e => console.log(chalk.red(`    ✗ ${e}`)));
    return;
  }

  const xray = new XrayClient(config);

  const authSpinner = ora('Authenticating with Xray...').start();
  await xray.authenticate();
  authSpinner.succeed('Authenticated');

  const pushSpinner = ora('Creating test artifacts in Jira Xray...').start();
  const result = await xray.createFullTestPlan(testPlan);
  pushSpinner.succeed('Push complete');

  console.log(chalk.bold('\n  📤 Xray Push Results:'));
  console.log(chalk.white(`     ${result.summary}`));

  if (result.testPlanKey) {
    console.log(chalk.green(`     Test Plan: ${config.jira.baseUrl}/browse/${result.testPlanKey}`));
  }

  if (result.errors.length > 0) {
    console.log(chalk.yellow(`\n  ⚠ ${result.errors.length} errors occurred:`));
    result.errors.slice(0, 5).forEach(e => console.log(chalk.yellow(`     - ${e}`)));
    if (result.errors.length > 5) {
      console.log(chalk.gray(`     ... and ${result.errors.length - 5} more`));
    }
  }

  // Link to existing issue if specified
  if (linkIssueKey && result.testCaseKeys.length > 0) {
    const linkSpinner = ora(`Linking tests to ${linkIssueKey}...`).start();
    await xray.linkTestsToIssue(linkIssueKey, result.testCaseKeys);
    linkSpinner.succeed(`Linked ${result.testCaseKeys.length} tests to ${linkIssueKey}`);
  }
}

// Parse and execute
program.parse(process.argv);
