import { AIProvider } from "./types";

export class MockAIProvider implements AIProvider {
    name = "mock";

    async generateText(prompt: string): Promise<string> {
        // Simulate latency
        await new Promise(resolve => setTimeout(resolve, 1500));

        if (prompt.includes('Which playbook')) {
             // Mock JSON response
             // Try to find a playbook ID in the prompt to "recommend"
             const match = prompt.match(/ID: ([a-f0-9-]+)/);
             const recommendedId = match ? match[1] : null;

             return JSON.stringify({
                 playbookId: recommendedId,
                 confidence: 85,
                 reasoning: "Analysis suggests this playbook matches the 'high severity' criteria detected in the logs."
             });
        }

        return `## 🤖 AI Analysis (Mock)

**Summary**:
Based on the alert data provided, this case appears to be a **Simulation**. The prompt length was ${prompt.length} characters.

**Key Findings**:
1.  Detected potential anomaly in user behavior.
2.  Correlated ${prompt.match(/Alert/g)?.length || 0} alerts within the case.
3.  No active threats confirmed at this time.

**Recommendation**:
- Review the alert logs manually.
- Run the "Block IP" playbook if suspicious traffic continues.
`;
    }
}
