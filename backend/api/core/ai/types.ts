export interface AIProvider {
    name: string;
    generateText(prompt: string): Promise<string>;
}

export interface AISummaizationRequest {
    caseId: string;
    caseTitle: string;
    description: string;
    alertCount: number;
    severity: string;
    alerts: Array<{
        title: string;
        severity: string;
        description: string;
    }>;
}

export interface AIPlaybookSuggestion {
    playbookId: string | null;
    confidence: number;
    reasoning: string;
}
