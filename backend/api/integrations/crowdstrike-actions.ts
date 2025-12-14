/**
 * CrowdStrike Falcon Actions Provider
 * Mock + Production implementations for EDR response actions
 */

interface ActionResult {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

export class CrowdStrikeActions {
  private static baseURL = process.env.CROWDSTRIKE_API_URL || 'https://api.crowdstrike.com';
  private static clientId = process.env.CROWDSTRIKE_CLIENT_ID || '';
  private static clientSecret = process.env.CROWDSTRIKE_CLIENT_SECRET || '';

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
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 500));

    switch (action) {
      case 'isolate_host':
        return {
          success: true,
          message: `[MOCK] Host ${parameters.agentId || parameters.deviceId} isolated from network`,
          data: {
            deviceId: parameters.agentId || parameters.deviceId,
            action: 'contain',
            status: 'success',
            timestamp: new Date().toISOString(),
          },
        };

      case 'lift_containment':
        return {
          success: true,
          message: `[MOCK] Network isolation lifted for ${parameters.agentId || parameters.deviceId}`,
          data: {
            deviceId: parameters.agentId || parameters.deviceId,
            action: 'lift_containment',
            status: 'success',
            timestamp: new Date().toISOString(),
          },
        };

      case 'kill_process':
        return {
          success: true,
          message: `[MOCK] Process ${parameters.processId || parameters.pid} terminated`,
          data: {
            processId: parameters.processId || parameters.pid,
            action: 'kill',
            status: 'success',
            timestamp: new Date().toISOString(),
          },
        };

      case 'get_device_details':
        return {
          success: true,
          message: `[MOCK] Retrieved device details`,
          data: {
            deviceId: parameters.agentId || parameters.deviceId,
            hostname: 'mock-hostname',
            platform: 'Windows',
            status: 'online',
            lastSeen: new Date().toISOString(),
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
   * Requires valid CrowdStrike API credentials
   */
  private static async executeReal(action: string, parameters: Record<string, any>): Promise<ActionResult> {
    try {
      // Get OAuth token first
      const token = await this.getAuthToken();
      if (!token) {
        return {
          success: false,
          message: 'Authentication failed',
          error: 'Could not obtain CrowdStrike API token',
        };
      }

      switch (action) {
        case 'isolate_host':
          return await this.isolateHostReal(parameters.agentId || parameters.deviceId, token);
        
        case 'lift_containment':
          return await this.liftContainmentReal(parameters.agentId || parameters.deviceId, token);
        
        case 'kill_process':
          return await this.killProcessReal(parameters.processId || parameters.pid, parameters.agentId, token);
        
        case 'get_device_details':
          return await this.getDeviceDetailsReal(parameters.agentId || parameters.deviceId, token);
        
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
   * Get OAuth 2.0 token from CrowdStrike
   */
  private static async getAuthToken(): Promise<string | null> {
    if (!this.clientId || !this.clientSecret) {
      console.error('CrowdStrike credentials not configured');
      return null;
    }

    try {
      const response = await fetch(`${this.baseURL}/oauth2/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `client_id=${this.clientId}&client_secret=${this.clientSecret}`,
      });

      const data = await response.json();
      return data.access_token;
    } catch (error) {
      console.error('Failed to get CrowdStrike token:', error);
      return null;
    }
  }

  /**
   * Isolate host (Real API)
   */
  private static async isolateHostReal(deviceId: string, token: string): Promise<ActionResult> {
    const response = await fetch(`${this.baseURL}/devices/entities/devices-actions/v2`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action_parameters: [
          {
            action_name: 'contain',
            id: deviceId,
          },
        ],
      }),
    });

    const data = await response.json();

    if (response.ok) {
      return {
        success: true,
        message: `Host ${deviceId} isolated successfully`,
        data,
      };
    } else {
      return {
        success: false,
        message: 'Failed to isolate host',
        error: data.errors?.[0]?.message || 'Unknown error',
      };
    }
  }

  /**
   * Lift containment (Real API)
   */
  private static async liftContainmentReal(deviceId: string, token: string): Promise<ActionResult> {
    const response = await fetch(`${this.baseURL}/devices/entities/devices-actions/v2`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action_parameters: [
          {
            action_name: 'lift_containment',
            id: deviceId,
          },
        ],
      }),
    });

    const data = await response.json();

    if (response.ok) {
      return {
        success: true,
        message: `Containment lifted for ${deviceId}`,
        data,
      };
    } else {
      return {
        success: false,
        message: 'Failed to lift containment',
        error: data.errors?.[0]?.message || 'Unknown error',
      };
    }
  }

  /**
   * Kill process (Real API - RTR command)
   */
  private static async killProcessReal(processId: string, deviceId: string, token: string): Promise<ActionResult> {
    // This requires RTR (Real Time Response) session
    // Simplified implementation
    return {
      success: false,
      message: 'RTR actions require additional configuration',
      error: 'RTR session management not yet implemented. Please use Mock mode or implement full RTR flow.',
    };
  }

  /**
   * Get device details (Real API)
   */
  private static async getDeviceDetailsReal(deviceId: string, token: string): Promise<ActionResult> {
    const response = await fetch(`${this.baseURL}/devices/entities/devices/v2?ids=${deviceId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (response.ok && data.resources?.length > 0) {
      return {
        success: true,
        message: 'Device details retrieved',
        data: data.resources[0],
      };
    } else {
      return {
        success: false,
        message: 'Failed to get device details',
        error: data.errors?.[0]?.message || 'Device not found',
      };
    }
  }
}
