import { db } from '../../infra/db'
import { playbooks, playbookSteps, playbookExecutions, playbookExecutionSteps, cases } from '../../infra/db/schema'
import { eq, and, desc } from 'drizzle-orm'

export class PlaybookService {
  // ==================== CRUD PLAYBOOK ====================
  static async list(tenantId: string) {
    return await db.query.playbooks.findMany({
      where: eq(playbooks.tenantId, tenantId),
      with: {
        steps: {
          orderBy: (steps, { asc }) => [asc(steps.order)]
        }
      },
      orderBy: (playbooks, { desc }) => [desc(playbooks.createdAt)]
    })
  }

  static async getById(tenantId: string, id: string) {
    return await db.query.playbooks.findFirst({
      where: and(eq(playbooks.id, id), eq(playbooks.tenantId, tenantId)),
      with: {
        steps: {
          orderBy: (steps, { asc }) => [asc(steps.order)]
        }
      }
    })
  }

  static async create(tenantId: string, data: any) {
    // 1. Create Playbook
    const [playbook] = await db.insert(playbooks).values({
      tenantId,
      title: data.title,
      description: data.description,
      triggerType: data.triggerType || 'manual',
      targetTag: data.targetTag
    }).returning()

    // 2. Create Steps if provided
    if (data.steps && data.steps.length > 0) {
      const stepsToInsert = data.steps.map((step: any, index: number) => ({
        playbookId: playbook.id,
        name: step.name,
        type: step.type, // 'manual' | 'automation'
        order: index + 1,
        description: step.description,
        actionId: step.actionId,
        config: step.config
      }))
      await db.insert(playbookSteps).values(stepsToInsert)
    }

    return await this.getById(tenantId, playbook.id)
  }

  static async update(tenantId: string, id: string, data: any) {
    // Basic update for title/desc
    await db.update(playbooks)
      .set({
        title: data.title,
        description: data.description,
        isActive: data.isActive,
        updatedAt: new Date()
      })
      .where(and(eq(playbooks.id, id), eq(playbooks.tenantId, tenantId)))

    // Handling steps update is complex (diffing), for MVP we might replace or add endpoints for steps.
    // For now, let's assume full replacement of steps if provided (simplest for MVP)
    if (data.steps) {
      // Delete old steps
      await db.delete(playbookSteps).where(eq(playbookSteps.playbookId, id))
      
      // Insert new steps
      const stepsToInsert = data.steps.map((step: any, index: number) => ({
        playbookId: id,
        name: step.name,
        type: step.type,
        order: index + 1,
        description: step.description,
        actionId: step.actionId,
        config: step.config
      }))
      if (stepsToInsert.length > 0) {
        await db.insert(playbookSteps).values(stepsToInsert)
      }
    }

    return await this.getById(tenantId, id)
  }

  static async delete(tenantId: string, id: string) {
    return await db.delete(playbooks)
      .where(and(eq(playbooks.id, id), eq(playbooks.tenantId, tenantId)))
      .returning()
  }

  // ==================== EXECUTION ====================
  static async run(tenantId: string, caseId: string, playbookId: string, userId: string) {
    // 1. Get Playbook and its steps
    const playbook = await this.getById(tenantId, playbookId)
    if (!playbook) throw new Error('Playbook not found')

    // 2. Create Execution Record
    const [execution] = await db.insert(playbookExecutions).values({
      tenantId,
      playbookId,
      caseId,
      status: 'running',
      startedBy: userId,
      startedAt: new Date(),
    }).returning()

    // 3. Create Execution Steps (Copy from template)
    if (playbook.steps && playbook.steps.length > 0) {
      const execSteps = playbook.steps.map(step => ({
        executionId: execution.id,
        stepId: step.id,
        status: 'pending',
        completedAt: null
      }))
      await db.insert(playbookExecutionSteps).values(execSteps)
    }

    // 4. Update Case (Example: Add comment)
    // We could import CaseService here to add a comment "Playbook X started"

    return await this.getExecution(tenantId, execution.id)
  }

  static async getExecution(tenantId: string, executionId: string) {
    return await db.query.playbookExecutions.findFirst({
      where: and(eq(playbookExecutions.id, executionId), eq(playbookExecutions.tenantId, tenantId)),
      with: {
        playbook: true,
        steps: {
          with: {
            step: true // Get original step details (name, desc)
          }
        },
        user: true
      }
    })
  }

  static async listExecutions(tenantId: string, caseId: string) {
    return await db.query.playbookExecutions.findMany({
      where: and(eq(playbookExecutions.caseId, caseId), eq(playbookExecutions.tenantId, tenantId)),
      with: {
        playbook: true,
        steps: {
          with: { step: true }
        }
      },
      orderBy: (execs, { desc }) => [desc(execs.startedAt)]
    })
  }

  static async updateStepStatus(tenantId: string, executionId: string, stepId: string, status: string, result?: any) {
    await db.update(playbookExecutionSteps)
      .set({
        status, // 'completed', 'skipped', 'failed', 'in_progress'
        result,
        completedAt: ['completed', 'failed', 'skipped'].includes(status) ? new Date() : null
      })
      .where(eq(playbookExecutionSteps.id, stepId))

    return { success: true }
  }

  // ==================== AUTOMATED EXECUTION ====================
  static async executeStep(tenantId: string, executionId: string, stepId: string) {
    // 1. Get Step Details
    const step = await db.query.playbookExecutionSteps.findFirst({
      where: eq(playbookExecutionSteps.id, stepId),
      with: {
        step: true, // Config is in the template step
        execution: true // To get caseId
      }
    });

    if (!step || !step.step) throw new Error('Step not found');

    // 2. Check if automation
    if (step.step.type !== 'automation') {
       throw new Error('Cannot auto-execute manual step');
    }

    // 3. Update Status to Running
    await this.updateStepStatus(tenantId, executionId, stepId, 'in_progress');

    try {
        // 4. Resolve Action
        const actionId = step.step.actionId;
        const config = step.step.config as Record<string, any>; // Inputs

        if (!actionId) throw new Error('No Action ID configured');

        // Import Registry dynamically or ensure it's loaded
        const { ActionRegistry } = await import('../actions/registry');
        
        // 5. Execute
        const result = await ActionRegistry.execute(actionId, {
            tenantId,
            caseId: step.execution.caseId,
            executionId,
            userId: step.execution.startedBy || undefined,
            inputs: config || {}
        });

        // 6. Save Result & Update Status
        await this.updateStepStatus(
            tenantId, 
            executionId, 
            stepId, 
            result.success ? 'completed' : 'failed', 
            result
        );

        return result;

    } catch (e: any) {
        console.error('Automation Failed:', e);
        await this.updateStepStatus(tenantId, executionId, stepId, 'failed', { error: e.message });
        return { success: false, error: e.message };
    }
  }
}
