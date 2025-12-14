import { AIProvider } from "./types";

export class MockAIProvider implements AIProvider {
    name = "mock";

    async generateText(prompt: string): Promise<string> {
        // Simulate latency
        await new Promise(resolve => setTimeout(resolve, 1500));

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
