# AI Provider Configuration Guide

## Overview

zcrAI supports multiple AI providers for intelligent security analysis features including:

- **Case Summarization**: AI-generated incident analysis
- **Playbook Suggestions**: Context-aware response recommendations
- **Natural Language Queries**: Convert user queries to SQL filters
- **Alert Triage**: Automated threat classification

## Supported Providers

| Provider     | Model                    | Strengths                         | API Key            |
| ------------ | ------------------------ | --------------------------------- | ------------------ |
| **Claude**   | claude-sonnet-4-20250514 | Best reasoning, security analysis | `CLAUDE_API_KEY`   |
| **Gemini**   | gemini-2.0-flash-exp     | Fast, cost-effective              | `GEMINI_API_KEY`   |
| **OpenAI**   | gpt-4o-mini              | Balanced performance              | `OPENAI_API_KEY`   |
| **Deepseek** | deepseek-chat            | Alternative option                | `DEEPSEEK_API_KEY` |

## Configuration

### Method 1: Auto-Detection (Recommended)

The system will automatically detect and use the first available API key in this priority order:

1. Claude (Anthropic)
2. Gemini (Google)
3. OpenAI
4. Deepseek

Simply set one or more environment variables:

```bash
# Option A: Use Claude (recommended for security analysis)
export CLAUDE_API_KEY="sk-ant-..."

# Option B: Use Gemini (fast and cost-effective)
export GEMINI_API_KEY="AIza..."

# Option C: Use OpenAI
export OPENAI_API_KEY="sk-..."

# Option D: Use Deepseek
export DEEPSEEK_API_KEY="sk-..."
```

### Method 2: Explicit Provider Selection

Force a specific provider using the `AI_PROVIDER` environment variable:

```bash
# Set your preferred provider
export AI_PROVIDER="claude"  # Options: claude, gemini, openai, deepseek

# Set the corresponding API key
export CLAUDE_API_KEY="sk-ant-..."
```

This is useful when:

- You have multiple API keys configured
- You want to ensure a specific provider is used
- You're testing different providers

## Getting API Keys

### Claude (Anthropic)

1. Visit [console.anthropic.com](https://console.anthropic.com)
2. Sign up or log in
3. Navigate to **API Keys**
4. Create a new API key
5. Copy the key (starts with `sk-ant-`)

**Pricing**: Pay-as-you-go, ~$3 per million input tokens

### Google Gemini

1. Visit [ai.google.dev](https://ai.google.dev)
2. Click **Get API Key**
3. Create or select a Google Cloud project
4. Generate API key
5. Copy the key (starts with `AIza`)

**Pricing**: Free tier available (15 requests/minute)

### OpenAI

1. Visit [platform.openai.com](https://platform.openai.com)
2. Sign up or log in
3. Navigate to **API Keys**
4. Create a new secret key
5. Copy the key (starts with `sk-`)

**Pricing**: Pay-as-you-go, ~$0.15 per million input tokens (GPT-4o-mini)

### Deepseek

1. Visit [platform.deepseek.com](https://platform.deepseek.com)
2. Sign up or log in
3. Navigate to **API Keys**
4. Create a new API key
5. Copy the key

**Pricing**: Cost-effective alternative

## Environment Setup

### Development (.env file)

Create a `.env` file in `backend/api/`:

```bash
# Database
DATABASE_URL=postgres://postgres:password@localhost:5433/zcrai
CLICKHOUSE_URL=http://localhost:8123
REDIS_URL=redis://localhost:6379

# Security
JWT_SECRET=your-super-secret-jwt-key-change-this

# AI Provider (choose one)
CLAUDE_API_KEY=sk-ant-your-key-here
# GEMINI_API_KEY=AIza-your-key-here
# OPENAI_API_KEY=sk-your-key-here
# DEEPSEEK_API_KEY=your-key-here

# Optional: Force specific provider
# AI_PROVIDER=claude
```

### Production (Environment Variables)

For production deployments, set environment variables directly:

```bash
# Linux/macOS
export CLAUDE_API_KEY="sk-ant-..."

# Windows PowerShell
$env:CLAUDE_API_KEY="sk-ant-..."

# Docker Compose
# Add to docker-compose.yml environment section
environment:
  - CLAUDE_API_KEY=sk-ant-...
```

### Docker Deployment

Update your `docker-compose.yml`:

```yaml
services:
  backend:
    environment:
      - DATABASE_URL=postgres://...
      - CLAUDE_API_KEY=${CLAUDE_API_KEY}
      - AI_PROVIDER=claude
```

Then run:

```bash
export CLAUDE_API_KEY="sk-ant-..."
docker-compose up -d
```

## Verification

### Check Logs

After starting the backend, check the logs to confirm the provider:

```bash
# You should see one of these messages:
[AIService] Using CLAUDE (from AI_PROVIDER env)
[AIService] Using Claude (auto-detected from CLAUDE_API_KEY)
[AIService] Using Google Gemini (auto-detected from GEMINI_API_KEY)
[AIService] Using OpenAI (auto-detected from OPENAI_API_KEY)
[AIService] Using Deepseek (auto-detected from DEEPSEEK_API_KEY)
```

### Error Messages

If no API key is configured:

```
[AIService] No AI provider configured. Please set one of:
CLAUDE_API_KEY, GEMINI_API_KEY, OPENAI_API_KEY, or DEEPSEEK_API_KEY

Error: AI Service Error: No AI provider API key configured.
AI features will not be available.
```

## Testing AI Features

Once configured, test the AI integration:

1. **Case Summarization**

   - Create a new security case
   - Click "Generate AI Summary"
   - Verify the AI analysis appears

2. **Playbook Suggestions**

   - Open an existing case
   - Click "Suggest Playbook"
   - Check if relevant playbooks are recommended

3. **Natural Language Queries**
   - Go to Logs page
   - Enter a query like "show critical alerts from last 24 hours"
   - Verify the AI converts it to filters

## Switching Providers

To switch between providers:

1. **Update environment variable:**

   ```bash
   export AI_PROVIDER="gemini"
   export GEMINI_API_KEY="AIza..."
   ```

2. **Restart the backend:**

   ```bash
   cd backend/api
   bun run index.ts
   ```

3. **Verify in logs:**
   ```
   [AIService] Using GEMINI (from AI_PROVIDER env)
   ```

## Troubleshooting

### Provider Not Loading

**Problem**: Logs show "No AI provider configured"

**Solution**:

- Verify environment variable is set: `echo $CLAUDE_API_KEY`
- Check for typos in variable name
- Restart the backend process
- Ensure API key is valid and not expired

### API Rate Limits

**Problem**: "Rate limit exceeded" errors

**Solution**:

- **Gemini Free Tier**: 15 requests/minute limit
- Upgrade to paid tier or switch to Claude/OpenAI
- Implement request queuing (future enhancement)

### Invalid API Key

**Problem**: "Authentication failed" errors

**Solution**:

- Verify API key is correct
- Check API key hasn't been revoked
- Ensure billing is active (for paid tiers)
- Generate a new API key

### Provider-Specific Issues

**Claude**:

- Error: "Credit balance insufficient" → Add credits at console.anthropic.com
- Model: `claude-sonnet-4-20250514` (configurable in `claude.provider.ts`)

**Gemini**:

- Error: "API key not valid" → Regenerate at ai.google.dev
- Free tier limits: 15 RPM, 1M TPM

**OpenAI**:

- Error: "Insufficient quota" → Add payment method
- Model: `gpt-4o-mini` (configurable in `openai.provider.ts`)

## Advanced Configuration

### Custom Models

Edit provider files to use different models:

**Claude**: `backend/api/core/ai/claude.provider.ts`

```typescript
model: "claude-3-opus-20240229", // Change from default
```

**OpenAI**: `backend/api/core/ai/openai.provider.ts`

```typescript
model: "gpt-4-turbo", // Change from gpt-4o-mini
```

**Gemini**: `backend/api/core/ai/gemini.provider.ts`

```typescript
const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
```

### Adding New Providers

To add a new AI provider:

1. Create a new provider file: `backend/api/core/ai/newprovider.provider.ts`
2. Implement the `AIProvider` interface
3. Add to `AIService.createProvider()` switch statement
4. Update environment variable checks in `AIService.initialize()`

Example provider implementation:

```typescript
import { AIProvider } from "./types";

export class NewProvider implements AIProvider {
  name = "newprovider";
  private client: any;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error("API key is required");
    }
    // Initialize client
  }

  async generateText(prompt: string): Promise<string> {
    // Implement text generation
    return "response";
  }
}
```

## Security Best Practices

1. **Never commit API keys** to version control
2. **Use environment variables** for all sensitive data
3. **Rotate keys** regularly (every 90 days recommended)
4. **Use separate keys** for development/staging/production
5. **Monitor usage** to detect anomalies
6. **Set spending limits** on provider dashboards
7. **Encrypt keys** in production (use secret managers like AWS Secrets Manager, HashiCorp Vault)

## Cost Optimization

### Tips to Reduce AI Costs

1. **Use Gemini for development** (free tier)
2. **Choose appropriate models**:
   - Claude Sonnet: Best quality, higher cost
   - GPT-4o-mini: Balanced
   - Gemini Flash: Fastest, lowest cost
3. **Cache responses** where possible (future enhancement)
4. **Batch requests** to reduce overhead
5. **Monitor token usage** in provider dashboards

### Estimated Costs

Based on typical usage (100 cases/day):

| Provider             | Daily Cost | Monthly Cost |
| -------------------- | ---------- | ------------ |
| Gemini Free          | $0         | $0\*         |
| Gemini Paid          | $0.50      | $15          |
| Claude               | $1.00      | $30          |
| OpenAI (GPT-4o-mini) | $0.30      | $9           |
| Deepseek             | $0.40      | $12          |

\*Subject to free tier limits

## Support

For issues or questions:

- **Documentation**: [docs/](../docs/)
- **GitHub Issues**: [github.com/nutthakorn7/zcrai/issues](https://github.com/nutthakorn7/zcrai/issues)
- **Email**: support@zcr.ai

---

**Last Updated**: 2025-12-23
