import { describe, expect, it, mock, beforeEach } from 'bun:test'
import { PlaybookService } from './playbook.service'

// MOCK DB
// Helper to create chainable query mock
const createMockQuery = (result: any = []) => {
    const promise = Promise.resolve(result);
    (promise as any).limit = mock(async () => result);
    (promise as any).returning = mock(async () => result); 
    return promise;
};

const mockDb = {
    insert: mock(() => ({ values: mock(() => ({ returning: mock(async () => [{ id: 'exec-1' }]) })) })),
    update: mock(() => ({ set: mock(() => ({ where: mock(async () => {}) })) })),
    select: mock(() => ({ from: mock(() => ({ where: mock(() => createMockQuery([])) })) })),
    query: {
        playbooks: { findFirst: mock(), findMany: mock() },
        playbookExecutions: { findFirst: mock(), findMany: mock() },
        playbookExecutionSteps: { findFirst: mock() },
        playbookSteps: { findFirst: mock() },
        approvals: { findFirst: mock() },
        alerts: { findMany: mock() },
        playbookInputs: { findFirst: mock() }
    }
}

mock.module('../../infra/db', () => ({ db: mockDb }))
mock.module('../../infra/db/schema', () => ({}))

// MOCK ACTION REGISTRY
const mockExecute = mock(async () => ({ success: true, data: 'Real Execution' }));
const mockActionRegistry = {
    get: mock((id: string) => {
        if (id === 'critical-action') return { id, name: 'Nuke', riskLevel: 'critical' };
        return { id, name: 'Safe Action', riskLevel: 'low' };
    }),
    execute: mockExecute
}

mock.module('../actions', () => ({ ActionRegistry: mockActionRegistry }))


describe('PlaybookService Safety', () => {
    beforeEach(() => {
        mockExecute.mockClear();
        mockDb.insert.mockClear();
        mockDb.update.mockClear();
        mockDb.query.approvals.findFirst.mockResolvedValue(null); // No existing approval
        mockDb.query.alerts.findMany.mockResolvedValue([]); // Return empty array for var resolution
    })

    const mockStep = (actionId: string, mode: string = 'run') => ({
        id: 'step-1',
        step: { id: 's1', type: 'automation', actionId, name: 'Test Step', config: {} },
        execution: { id: 'exec-1', caseId: 'case-1', mode, startedBy: 'user-1' }
    });

    it('should enforce mandatory approval for critical actions in RUN mode', async () => {
        mockDb.query.playbookExecutionSteps.findFirst.mockResolvedValue(mockStep('critical-action', 'run'));

        const result = await PlaybookService.executeStep('tenant-1', 'exec-1', 'step-1');

        expect(result.status).toBe('waiting_for_approval');
        expect(mockDb.insert).toHaveBeenCalled(); // Should insert approval request
        expect(mockExecute).not.toHaveBeenCalled(); // Should NOT execute action
    })

    it('should BYPASS approval for critical actions in DRY_RUN mode', async () => {
        mockDb.query.playbookExecutionSteps.findFirst.mockResolvedValue(mockStep('critical-action', 'dry_run'));

        await PlaybookService.executeStep('tenant-1', 'exec-1', 'step-1');

        expect(mockExecute).toHaveBeenCalled(); // Should call registry execute
        // Registry execute inside will handle the simulation return, but service just calls it.
        // We verify that execute WAS called.
        // We check if the 'inputs' arg to execute contained mode: 'dry_run'
        const callArgs = mockExecute.mock.lastCall[1];
        expect(callArgs.mode).toBe('dry_run');
    })

    it('should run safe actions normally', async () => {
        mockDb.query.playbookExecutionSteps.findFirst.mockResolvedValue(mockStep('safe-action', 'run'));

        await PlaybookService.executeStep('tenant-1', 'exec-1', 'step-1');

        expect(mockExecute).toHaveBeenCalled();
        expect(mockDb.insert).not.toHaveBeenCalled(); // No approval insert
    })
})
