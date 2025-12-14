/**
 * SentinelOne Actions Provider
 * Mock + Production implementations for EDR response actions
 */

interface ActionResult {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

export class SentinelOneActions {
  private static baseURL = process.env.SENTINELONE_API_URL || 'https://usea1-partners.sentinelone.net';
  private static apiToken = process.env.SENTINELONE_API_TOKEN || '';

  /**
   * Execute action (router)
   */
  static async execute(action: string, parameters: Record<string, any>, mockMode: boolean): Promise<ActionResult> {
    if (mockMode) {
      return this.executeMock(action, parameters);
    }
    return this.executeReal(action, parameters);
  }

  /**
   * Mock implementations (safe for testing)
   */
  private static async executeMock(action: string, parameters: Record<string, any>): Promise<ActionResult> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 400));

    switch (action) {
      case 'quarantine_host':
        return {
          success: true,
          message: `[MOCK] Host ${parameters.agentId} quarantined (disconnected from network)`,
          data: {
            agentId: parameters.agentId,
            action: 'disconnect',
            status: 'success',
            affectedCount: 1,
            timestamp: new Date().toISOString(),
          },
        };

      case 'unquarantine_host':
        return {
          success: true,
          message: `[MOCK] Host ${parameters.agentId} removed from quarantine`,
          data: {
            agentId: parameters.agentId,
            action: 'connect',
            status: 'success',
            affectedCount: 1,
            timestamp: new Date().toISOString(),
          },
        };

      case 'blocklist_hash':
        return {
          success: true,
          message: `[MOCK] File hash ${parameters.hash} added to blocklist`,
          data: {
            hash: parameters.hash,
            action: 'blocklist',
            status: 'success',
            scope: parameters.scope || 'site',
            timestamp: new Date().toISOString(),
          },
        };

      case 'get_agent_details':
        return {
          success: true,
          message: `[MOCK] Retrieved agent details`,
          data: {
            agentId: parameters.agentId,
            computerName: 'mock-workstation',
            domain: 'mock.local',
            isActive: true,
            infected: false,
            networkStatus: 'connected',
            osType: 'windows',
            lastActiveDate: new Date().toISOString(),
          },
        };

      default:
        return {
          success: false,
          message: `Unknown action: ${action}`,
          error: 'Action not supported',
        };
    }
  }

  /**
   * Real API implementations
   * Requires valid SentinelOne API token
   */
  private static async executeReal(action: string, parameters: Record<string, any>): Promise<ActionResult> {
    if (!this.apiToken) {
      return {
        success: false,
        message: 'Authentication failed',
        error: 'SentinelOne API token not configured',
      };
    }

    try {
      switch (action) {
        case 'quarantine_host':
          return await this.quarantineHostReal(parameters.agentId);
        
        case 'unquarantine_host':
          return await this.unquarantineHostReal(parameters.agentId);
        
        case 'blocklist_hash':
          return await this.blocklistHashReal(parameters.hash, parameters.scope);
        
        case 'get_agent_details':
          return await this.getAgentDetailsReal(parameters.agentId);
        
        default:
          return {
            success: false,
            message: `Unknown action: ${action}`,
            error: 'Action not supported',
          };
      }
    } catch (error: any) {
      return {
        success: false,
        message: 'API call failed',
        error: error.message,
      };
    }
  }

  /**
   * Quarantine host (Real API)
   */
  private static async quarantineHostReal(agentId: string): Promise<ActionResult> {
    const response = await fetch(`${this.baseURL}/web/api/v2.1/agents/actions/disconnect`, {
      method: 'POST',
      headers: {
        'Authorization': `ApiToken ${this.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filter: {
          ids: [agentId],
        },
      }),
    });

    const data: any = await response.json();

    if (response.ok && data.data?.affected > 0) {
      return {
        success: true,
        message: `Agent ${agentId} quarantined successfully`,
        data: data.data,
      };
    } else {
      return {
        success: false,
        message: 'Failed to quarantine agent',
        error: data.errors?.[0]?.detail || 'Unknown error',
      };
    }
  }

  /**
   * Remove quarantine (Real API)
   */
  private static async unquarantineHostReal(agentId: string): Promise<ActionResult> {
    const response = await fetch(`${this.baseURL}/web/api/v2.1/agents/actions/connect`, {
      method: 'POST',
      headers: {
        'Authorization': `ApiToken ${this.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filter: {
          ids: [agentId],
        },
      }),
    });

    const data: any = await response.json();

    if (response.ok && data.data?.affected > 0) {
      return {
        success: true,
        message: `Agent ${agentId} removed from quarantine`,
        data: data.data,
      };
    } else {
      return {
        success: false,
        message: 'Failed to remove quarantine',
        error: data.errors?.[0]?.detail || 'Unknown error',
      };
    }
  }

  /**
   * Blocklist file hash (Real API)
   */
  private static async blocklistHashReal(hash: string, scope: string = 'site'): Promise<ActionResult> {
    const response = await fetch(`${this.baseURL}/web/api/v2.1/restrictions`, {
      method: 'POST',
      headers: {
        'Authorization': `ApiToken ${this.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: {
          type: 'black_hash',
          value: hash,
          osType: 'windows', // Could be parameterized
          description: `Blocklisted via SOAR automation - ${new Date().toISOString()}`,
        },
        filter: {
          // Scope determines whether it's account-wide, site-wide, etc.
          // This is a simplified version
        },
      }),
    });

    const data: any = await response.json();

    if (response.ok && data.data?.id) {
      return {
        success: true,
        message: `Hash ${hash} added to blocklist`,
        data: data.data,
      };
    } else {
      return {
        success: false,
        message: 'Failed to blocklist hash',
        error: data.errors?.[0]?.detail || 'Unknown error',
      };
    }
  }

  /**
   * Get agent details (Real API)
   */
  private static async getAgentDetailsReal(agentId: string): Promise<ActionResult> {
    const response = await fetch(`${this.baseURL}/web/api/v2.1/agents?ids=${agentId}`, {
      method: 'GET',
      headers: {
        'Authorization': `ApiToken ${this.apiToken}`,
        'Content-Type': 'application/json',
      },
    });

    const data: any = await response.json();

    if (response.ok && data.data?.length > 0) {
      return {
        success: true,
        message: 'Agent details retrieved',
        data: data.data[0],
      };
    } else {
      return {
        success: false,
        message: 'Failed to get agent details',
        error: data.errors?.[0]?.detail || 'Agent not found',
      };
    }
  }
}
