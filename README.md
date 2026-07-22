# 🧪 Xray Test Generator

Generate comprehensive test cases, test scenarios, and test plans for **Jira Xray** directly from acceptance criteria. The tool automatically produces tests covering:

- ✅ **Positive tests** — Happy path validation
- ❌ **Negative tests** — Invalid inputs, missing preconditions, unauthorized access
- ⚡ **Edge case tests** — Null/empty values, concurrency, special characters
- 🔧 **Functional tests** — End-to-end flows, state transitions
- 📏 **Boundary tests** — Min/max values, timeouts, rate limits
- 🛡 **Error handling tests** — Network failures, dependency outages

## Quick Start

### 1. Install

```bash
cd xray-test-generator
npm install
npm run build
```

### 2. Generate Tests (Local Mode)

```bash
# From a file
npx xray-testgen generate --file examples/login-feature.txt --name "Login Feature Tests"

# From direct text
npx xray-testgen generate --text "Given a user... When they... Then the system..."

# Preview without saving
npx xray-testgen preview --file examples/shopping-cart.txt
```

### 3. Push to Jira Xray

```bash
# Copy and configure your environment
cp .env.example .env
# Edit .env with your Jira/Xray credentials

# Validate connection
npx xray-testgen validate

# Generate AND push to Xray
npx xray-testgen generate --file examples/login-feature.txt --name "Login Tests" --push

# Generate, push, and link to a Jira story
npx xray-testgen generate --file examples/login-feature.txt --push --link PROJ-123
```

## Input Formats

The tool supports multiple acceptance criteria formats:

### Gherkin (Given/When/Then)

```
Given a registered user with valid credentials
When they enter their email and password and click "Sign In"
Then they should be redirected to the dashboard
```

### Numbered List

```
1. Users can add products to their cart
2. Cart displays total item count
3. Users can update quantities (min 1, max 99)
```

### Bullet Points

```
- System validates email format on input
- Error messages appear inline below the field
- Submit button is disabled until form is valid
```

### Free-form Text

```
The system should allow users to reset their password via email.
Users must confirm their new password by entering it twice.
Password must be at least 8 characters with one uppercase and one number.
```

## Output

The tool generates a JSON test plan containing:

```json
{
  "name": "Test Plan: Login Feature",
  "scenarios": [
    {
      "name": "Positive Tests: user redirected to dashboard",
      "category": "positive",
      "testCases": [
        {
          "summary": "[Positive] Verify: user redirected to dashboard",
          "priority": "high",
          "steps": [...]
        }
      ]
    }
  ],
  "summary": {
    "totalScenarios": 30,
    "totalTestCases": 60,
    "byCategory": {
      "positive": 10,
      "negative": 15,
      "edge_case": 15,
      "functional": 10,
      "boundary": 10
    }
  }
}
```

## Configuration

| Variable | Description | Required |
|----------|-------------|----------|
| `JIRA_BASE_URL` | Your Jira instance URL | For push |
| `JIRA_EMAIL` | Jira account email | For push |
| `JIRA_API_TOKEN` | Jira API token | For push |
| `JIRA_PROJECT_KEY` | Target project key | For push |
| `XRAY_CLIENT_ID` | Xray Cloud client ID | For push |
| `XRAY_CLIENT_SECRET` | Xray Cloud client secret | For push |
| `OPENAI_API_KEY` | OpenAI key (enhanced mode) | Optional |

## Commands

| Command | Description |
|---------|-------------|
| `generate` | Parse criteria and generate test cases |
| `preview` | Preview generated tests without saving/pushing |
| `validate` | Test Jira/Xray connection and config |

### Generate Options

| Option | Description |
|--------|-------------|
| `-f, --file <path>` | Input file path |
| `-t, --text <text>` | Direct text input |
| `-n, --name <name>` | Test plan name |
| `-o, --output <path>` | Output JSON path |
| `--push` | Push to Jira Xray |
| `--link <key>` | Link tests to Jira issue |

## Architecture

```
src/
├── cli.ts                    # CLI entry point (commander)
├── config.ts                 # Environment config loader
├── index.ts                  # Programmatic API exports
├── types/
│   └── index.ts              # TypeScript interfaces
├── parser/
│   └── acceptanceCriteriaParser.ts  # AC text parser
├── generator/
│   └── testCaseGenerator.ts  # Test case generation engine
└── xray/
    └── xrayClient.ts         # Jira/Xray API integration
```

## Programmatic Usage

```typescript
import { AcceptanceCriteriaParser, TestCaseGenerator, XrayClient } from 'xray-test-generator';

const parser = new AcceptanceCriteriaParser();
const generator = new TestCaseGenerator();

// Parse acceptance criteria
const parsed = parser.parse(myAcceptanceCriteria, 'My Feature');

// Generate comprehensive test plan
const testPlan = generator.generateTestPlan(parsed);

// Push to Xray (optional)
const xray = new XrayClient(config);
await xray.authenticate();
const result = await xray.createFullTestPlan(testPlan);
```

## Test Categories Explained

| Category | What it Tests | Example |
|----------|--------------|---------|
| Positive | Expected behavior works | Valid login succeeds |
| Negative | System rejects bad input | Invalid email is blocked |
| Edge Case | Unusual/extreme conditions | Null input, concurrent access |
| Functional | End-to-end flow works | Full checkout process |
| Boundary | Value limits are enforced | Max 99 items in cart |
| Error Handling | System recovers from failures | Network timeout during payment |

## License

MIT
