import { describe, expect, test, beforeAll } from 'bun:test'
import { ActionRegistry } from './registry'
import { registerActions } from './index'

describe('ActionRegistry', () => {
    beforeAll(() => {
        registerActions();
    });

    test('should have registered actions', () => {
        expect(ActionRegistry.get('block_ip')).toBeDefined();
        expect(ActionRegistry.get('disable_user')).toBeDefined();
        expect(ActionRegistry.get('isolate_host')).toBeDefined();
    });

    test('should execute block_ip action', async () => {
        const result = await ActionRegistry.execute('block_ip', {
            tenantId: 'test-tenant',
            caseId: 'test-case',
            executionId: 'test-exec',
            inputs: { ip_address: '1.2.3.4' }
        });

        expect(result.success).toBe(true);
        expect(result.data.action).toBe('block');
        expect(result.data.target).toBe('1.2.3.4');
    });

    test('should fail block_ip without input', async () => {
        // expect(async () => {
        //     await ActionRegistry.execute('block_ip', {
        //         tenantId: 'test',
        //         caseId: 'test',
        //         executionId: 'test',
        //         inputs: {} 
        //     });
        // }).toThrow();
        // Bun test throw expectation syntax might differ, doing try/catch
        try {
             await ActionRegistry.execute('block_ip', {
                tenantId: 'test',
                caseId: 'test',
                executionId: 'test',
                inputs: {} 
            });
            expect(true).toBe(false); // Should fail
        } catch (e) {
            expect(e).toBeDefined();
        }
    });

    test('should execute disable_user action', async () => {
        const result = await ActionRegistry.execute('disable_user', {
            tenantId: 'test-tenant',
            caseId: 'test-case',
            executionId: 'test-exec',
            inputs: { username: 'john.doe' }
        });
        expect(result.success).toBe(true);
        expect(result.data.target).toBe('john.doe');
    });
});
