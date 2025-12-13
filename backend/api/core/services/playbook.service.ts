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
    // update execution step status
    // Note: stepId here refers to the `playbookExecutionSteps.stepId` (which is link to original step) 
    // OR `playbookExecutionSteps.id`?
    // Let's assume the API passes the `playbookExecutionSteps.id` for precision.
    
    await db.update(playbookExecutionSteps)
      .set({
        status, // 'completed', 'skipped', 'failed'
        result,
        completedAt: status === 'completed' ? new Date() : null
      })
      .where(eq(playbookExecutionSteps.id, stepId)) // Assuming stepId is the execution_step id

    // Check if all steps completed to mark execution as done
    // (Skipping for MVP shortness)
    
    return { success: true }
  }
}
