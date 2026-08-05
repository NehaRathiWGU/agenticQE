# 🧪 Xray Test Generator

Generate comprehensive test cases, test scenarios, and test plans for **Jira Xray** directly from acceptance criteria. The tool automatically produces tests covering:

- ✅ **Positive tests** — Happy path validation
- ❌ **Negative tests** — Invalid inputs, missing preconditions, unauthorized access
- ⚡ **Edge case tests** — Null/empty values, concurrency, special characters
- 🔧 **Functional tests** — End-to-end flows, state transitions
- 📏 **Boundary tests** — Min/max values, timeouts, rate limits
- 🛡 **Error handling tests** — Network failures, dependency outages
- 🌐 **API tests** — REST/GraphQL endpoints, authentication, security

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

# From Jira issue (fetches acceptance criteria directly)
npx xray-testgen generate --jira-key PROJ-123

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

## Multi-Project Support

The tool supports multiple projects with project-specific configurations.

### Creating a Project Configuration

Create `projects/<project-name>/config.json`:

```json
{
  "name": "Project Name",
  "key": "myproject",
  "jira": {
    "projectKey": "MYPROJ",
    "acceptanceCriteriaField": "customfield_12345"
  },
  "templates": {
    "default": "templates/default.md",
    "api-testing": "templates/api-testing.md",
    "ui-testing": "templates/ui-testing.md",
    "migration": "templates/migration.md",
    "security": "templates/security.md"
  },
  "fieldMappings": {
    "priority": {
      "critical": "Highest",
      "high": "High",
      "medium": "Medium",
      "low": "Low"
    },
    "categoryKeywords": {
      "api": ["api", "endpoint", "rest", "graphql"],
      "ui": ["ui", "frontend", "page", "button"],
      "security": ["security", "auth", "permission"]
    }
  },
  "environments": ["SIT", "STAGE", "PROD"],
  "defaultEnvironment": "SIT"
}
```

### Using Project Config

```bash
# Generate tests with project config
npx xray-testgen generate --jira-key PROJ-123 --project myproject

# Generate from Jira issue with project config
npx xray-testgen generate --jira-key PROJ-123 --project myproject --push

# Apply a specific template
npx xray-testgen generate --jira-key PROJ-123 --project myproject --template api-testing
```

### Available Templates

| Template | Purpose |
|----------|---------|
| `api-testing` | REST/GraphQL, authentication, error handling |
| `ui-testing` | Forms, navigation, accessibility, responsive |
| `migration` | ECS→EKS, legacy modernization, deployment |
| `security` | OWASP patterns, auth, authorization |
| `default` | Standard test generation |

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
| `-k, --jira-key <key>` | Fetch acceptance criteria from Jira issue |
| `-p, --project <name>` | Use project-specific configuration |
| `-n, --name <name>` | Test plan name |
| `-o, --output <path>` | Output JSON path |
| `--push` | Push to Jira Xray |
| `--link <key>` | Link tests to Jira issue |
| `--categories <cats>` | Comma-separated test categories |

## Getting Started for New Projects

### Step 1: Configure Environment
```bash
cd xray-test-generator
cp .env.example .env
# Edit .env with your Jira/Xray credentials
```

### Step 2: Create Project Configuration
Create `projects/myproject/config.json` with your project details (see Multi-Project Support section above).

### Step 3: Create Templates (Optional)
Add template files in `projects/myproject/templates/` for your project-specific patterns.

### Step 4: Generate Tests
```bash
# From Jira issue
npx xray-testgen generate --jira-key MYPROJ-123 --project myproject

# From file
npx xray-testgen generate --file acceptance.txt --project myproject
```

## Architecture

```
src/
├── cli.ts                    # CLI entry point (commander)
├── config.ts                 # Environment & project config loader
├── index.ts                  # Programmatic API exports
├── types/
│   └── index.ts              # TypeScript interfaces
├── parser/
│   └── acceptanceCriteriaParser.ts  # AC text parser
├── generator/
│   └── testCaseGenerator.ts  # Test case generation engine
├── template/
│   ├── index.ts              # Template module exports
│   └── system.ts             # Template loading & application
└── xray/
    └── xrayClient.ts         # Jira/Xray API integration

projects/
└── <project-name>/
    ├── config.json           # Project-specific configuration
    └── templates/
        ├── migration.md      # Migration test template
        ├── api-testing.md    # API testing template
        ├── ui-testing.md     # UI testing template
        └── security.md       # Security testing template
```

## Programmatic Usage

```typescript
import { 
  AcceptanceCriteriaParser, 
  TestCaseGenerator, 
  XrayClient,
  loadConfig,
  TemplateSystem
} from 'xray-test-generator';

// Basic usage
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

// Using templates
const templateSystem = new TemplateSystem();
const enhanced = templateSystem.applyTemplate('myproject', 'api-testing', parsed);

// Load project config
const projectConfig = loadConfig('myproject');
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
