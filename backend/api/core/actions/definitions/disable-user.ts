import { ActionDefinition, ActionContext, ActionResult } from '../registry';

export const DisableUserAction: ActionDefinition = {
    id: 'disable_user',
    name: 'Disable User Account',
    description: 'Disables a user account in the identity provider (AD/Okta)',
    execute: async (context: ActionContext): Promise<ActionResult> => {
        const { username, email } = context.inputs;
        const target = username || email;

        if (!target) {
            throw new Error('Missing input: username or email');
        }

        console.log(`[DisableUser] Disabling account ${target} for tenant ${context.tenantId}`);
        
        // Mock Implementation
        await new Promise(resolve => setTimeout(resolve, 800));

        return {
            success: true,
            data: {
                action: 'disable_account',
                target: target,
                provider: 'mock-ad-01',
                timestamp: new Date().toISOString()
            }
        };
    }
};
