import axios from 'axios';
import { db } from '../../infra/db';
import { notificationChannels, cases } from '../../infra/db/schema';
import { eq, and } from 'drizzle-orm';

// Note: In MVP we might reuse notification_channels table with type='jira' or create a new integrations table.
// Given the schema, we have `cloud_integrations` for AWS/Azure.
// We don't have a generic `app_integrations` table yet besides `notification_channels`.
// For creating tickets, it's slightly different than "sending a message".
// Let's assume we store Jira config in `system_config` or reuse `notification_channels` with a trick,
// OR ideally we add a new table `ticketing_integrations`.
// FOR NOW: I will mock the configuration or assume it's passed in / hardcoded for demo.
// Actually, let's stick to the `IntegrationPage` pattern which uses `api_keys` or similar.
// But wait, `notification_channels` has webhookUrl. Jira uses API Token + Domain.
// Let's implement a simple direct service first.

export class TicketingService {
    
    /**
     * Create a Jira Issue
     */
    static async createJiraTicket(tenantId: string, caseData: any, config: { domain: string, email: string, apiToken: string, projectKey: string }) {
        try {
            const auth = Buffer.from(`${config.email}:${config.apiToken}`).toString('base64');
            
            const payload = {
                fields: {
                    project: {
                        key: config.projectKey
                    },
                    summary: `[Security Incident] ${caseData.title}`,
                    description: {
                        type: "doc",
                        version: 1,
                        content: [
                            {
                                type: "paragraph",
                                content: [
                                    {
                                        type: "text",
                                        text: `Incident reported by zcrAI.\n\nDescription: ${caseData.description}\nSeverity: ${caseData.severity}\n\nLink: https://app.zcr.ai/cases/${caseData.id}`
                                    }
                                ]
                            }
                        ]
                    },
                    issuetype: {
                        name: "Task" // or "Incident"
                    },
                    priority: {
                        name: caseData.severity === 'critical' ? 'High' : 'Medium'
                    }
                }
            };

            const response = await axios.post(`https://${config.domain}/rest/api/3/issue`, payload, {
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });

            return {
                success: true,
                ticketId: response.data.key,
                ticketUrl: response.data.self
            };

        } catch (error: any) {
            console.error('Jira Create Failed:', error.response?.data || error.message);
            throw new Error('Failed to create Jira ticket');
        }
    }

    /**
     * Create ServiceNow Incident (Mock/Stub)
     */
    static async createServiceNowTicket(tenantId: string, caseData: any, config: { instance: string, username: string, password: string }) {
         // Placeholder for ServiceNow
         return {
             success: true,
             ticketId: `INC-${Math.floor(Math.random() * 10000)}`,
             ticketUrl: `https://dev12345.service-now.com/nav_to.do?uri=incident.do`,
             system: 'servicenow'
         };
    }
}
