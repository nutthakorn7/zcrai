# Integrations

**Page**: `Settings > Integrations` (`/settings/integrations`)

Connect zcrAI with your existing security stack to enrich data and automate actions.

## EDR / XDR Integrations
Connect these tools to pull device data and perform response actions (isolate host, kill process):
*   **CrowdStrike Falcon**
*   **SentinelOne**

## Threat Intelligence Sources
Connect API keys to enrich alerts with reputation data:
*   **VirusTotal**: File and URL reputation.
*   **AbuseIPDB**: IP address reputation.

## AI Assistants
*   **OpenAI (ChatGPT)**: Enable AI-assisted alert analysis and summarization.
*   **Anthropic Claude**: Alternative AI assistant.
*   **Google Gemini**: Multi-modal AI assistant.
*   **DeepSeek**: Open-source LLM.

## Configuration Steps
1.  Obtain an **API Key** from the external service provider.
2.  In zcrAI, locate the service card.
3.  Click **Configure** (or click the card if not yet configured).
4.  Paste the API Key (and Base URL/Client ID/Secret if required).
5.  Save changes.

## UI Features

### Last Sync Display
Each configured integration shows:
- **Last sync timestamp** with clock icon
- **Sync status indicator** (success/warning)
- **Stale indicator** if sync is outdated

### Masked API Key Display
For security, API keys are displayed in masked format:
- **EDR integrations**: `Key: ••••xxxx` (last 4 characters)
- **Enrichment providers**: `Key: Configured ✓`

### Test Connection Button 📶
Click the **signal icon** button to verify integration connectivity:
- ⏳ **Loading**: Spinner appears during test
- ✅ **Success**: Green checkmark (auto-clears after 3s)
- ❌ **Failed**: Red X with error message

This tests the API credentials without waiting for the next scheduled sync.

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Test shows ❌ | Check API credentials are correct and not expired |
| "Waiting for first sync" | Configure the integration or trigger collector manually |
| Last sync shows "Stale" | Check if Collector service is running |
