import { ActionRegistry } from './registry';
import { BlockIPAction } from './definitions/block-ip';
import { DisableUserAction } from './definitions/disable-user';
import { IsolateHostAction } from './definitions/isolate-host';

export function registerActions() {
    ActionRegistry.register(BlockIPAction);
    ActionRegistry.register(DisableUserAction);
    ActionRegistry.register(IsolateHostAction);
    console.log('[ActionRegistry] Actions registered: block_ip, disable_user, isolate_host');
}

// Re-export Registry
export { ActionRegistry };
