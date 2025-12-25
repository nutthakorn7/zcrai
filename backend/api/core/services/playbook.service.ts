import { db } from '../../infra/db'
import { playbooks, playbookSteps, playbookExecutions, playbookExecutionSteps, cases, approvals, playbookInputs, alerts } from '../../infra/db/schema'
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
        type: step.type, // 'manual' | 'automation' | 'approval'
        order: index + 1,
        description: step.description,
        actionId: step.actionId,
        config: step.config,
        positionX: step.positionX,
        positionY: step.positionY
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
        config: step.config,
        positionX: step.positionX,
        positionY: step.positionY
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






    // ... (previous code)

  // Helper: Resolve Variables in Config
  private static resolveVariables(config: any, context: any): any {
    if (typeof config === 'string') {
        // Replace {{ key }}
        return config.replace(/\{\{\s*([\w\.]+)\s*\}\}/g, (match, key) => {
            const keys = key.split('.');
            let value = context;
            for (const k of keys) {
                value = value?.[k];
            }
            return value !== undefined ? value : match; // Return original if not found
        });
    } else if (Array.isArray(config)) {
        return config.map(item => this.resolveVariables(item, context));
    } else if (typeof config === 'object' && config !== null) {
        const resolved: any = {};
        for (const key in config) {
            resolved[key] = this.resolveVariables(config[key], context);
        }
        return resolved;
    }
    return config;
  }

    // Helper: Evaluate Condition
    private static evaluateCondition(condition: string, context: any): boolean {
        // Simple parser: "variable operator value"
        // e.g. "{{case.severity}} == critical"
        try {
            // Resolve variable side
            const resolvedCondition = this.resolveVariables(condition, context);
            
            // Split by operators
            const operators = ['==', '!=', '>', '<', 'contains'];
            let operator = '';
            for (const op of operators) {
                if (resolvedCondition.includes(` ${op} `)) {
                    operator = op;
                    break;
                }
            }

            if (!operator) return false;

            const [left, right] = resolvedCondition.split(` ${operator} `).map((s: string) => s.trim().replace(/^['"]|['"]$/g, '')); // Strip quotes

            switch (operator) {
                case '==': return left == right;
                case '!=': return left != right;
                case '>': return Number(left) > Number(right);
                case '<': return Number(left) < Number(right);
                case 'contains': return left.includes(right);
                default: return false;
            }
        } catch (e) {
            console.error('Condition Evaluation Failed:', e);
            return false;
        }
    }

    // Orchestrator: Trigger Next Step
    static async triggerNextStep(tenantId: string, executionId: string, completedStepId: string) {
        console.log(`[Playbook] Triggering next step after ${completedStepId}`);

        // 1. Get Completed Step & Execution Context
        const completedStep = await db.query.playbookExecutionSteps.findFirst({
            where: eq(playbookExecutionSteps.id, completedStepId),
            with: {
                step: true,
                execution: {
                    with: { case: true }
                }
            }
        });

        if (!completedStep || !completedStep.step) return;

        // 2. Determine Next Step Order
        let nextOrder = completedStep.step.order + 1;

        // Check for Branching Logic in Config
        if (completedStep.step.type === 'condition' || ((completedStep.step.config as any)?.transitions)) {
            const config = completedStep.step.config as any;
            
            if (config?.condition) {
                 // Fetch Alerts for Context (Reuse logic)
                const associatedAlerts = await db.query.alerts.findMany({
                    where: eq(alerts.caseId, completedStep.execution.caseId)
                });
                const context = {
                    case: completedStep.execution.case,
                    alerts: associatedAlerts,
                    alert: associatedAlerts[0]
                };

                const isTrue = this.evaluateCondition(config.condition, context);
                console.log(`[Playbook] Condition '${config.condition}' evaluated to: ${isTrue}`);

                if (isTrue && config.true_step) {
                    nextOrder = parseInt(config.true_step); // Jump to specific order
                } else if (!isTrue && config.false_step) {
                    nextOrder = parseInt(config.false_step);
                }
                // If no jump defined for result, default to nextOrder (sequential)
            }
        }

        // 3. Find Next Step Record
        const nextStep = await db.query.playbookExecutionSteps.findFirst({
            where: and(
                eq(playbookExecutionSteps.executionId, executionId),
                eq(playbookExecutionSteps.status, 'pending')
            ), 
            with: {
                step: true
            }
            // We need to filter by order, but we can't easily join in 'where' with drizzle's query builder here efficiently 
            // without fully fetching or using raw sql. 
            // Better strategy: Fetch all pending steps and find the one matching order.
        });

        // 4. Optimization: Fetch specific next step by finding the template step first
        // Find the template step with this order for this playbook
        const nextTemplateStep = await db.query.playbookSteps.findFirst({
            where: and(
                eq(playbookSteps.playbookId, completedStep.step.playbookId),
                eq(playbookSteps.order, nextOrder)
            )
        });

        if (!nextTemplateStep) {
            console.log('[Playbook] End of playbook reached (no next step).');
            // Update Execution Status to Completed
            await db.update(playbookExecutions)
                .set({ status: 'completed', completedAt: new Date() })
                .where(eq(playbookExecutions.id, executionId));
            return;
        }

        // Find the corresponding execution step
        const nextExecStep = await db.query.playbookExecutionSteps.findFirst({
            where: and(
                eq(playbookExecutionSteps.executionId, executionId),
                eq(playbookExecutionSteps.stepId, nextTemplateStep.id)
            )
        });

        if (nextExecStep) {
            console.log(`[Playbook] Executing next step: ${nextTemplateStep.name} (ID: ${nextExecStep.id})`);
            // Execute it!
            await this.executeStep(tenantId, executionId, nextExecStep.id);
        }
    }

  // ==================== AUTOMATED EXECUTION ====================
  static async executeStep(tenantId: string, executionId: string, stepId: string) {
    // 1. Get Step Details
    const step = await db.query.playbookExecutionSteps.findFirst({
      where: eq(playbookExecutionSteps.id, stepId),
      with: {
        step: true, // Config is in the template step
        execution: {
            with: {
                case: true
            }
        } 
      }
    });

    if (!step || !step.step) throw new Error('Step not found');

    // Handle Conditional Step (Virtual Step)
    if (step.step.type === 'condition') {
        await this.updateStepStatus(tenantId, executionId, stepId, 'completed', { result: 'evaluated' });
        // updateStepStatus will triggerNextStep
        return { success: true, message: 'Condition Evaluated' };
    }

    // 2. Check type
    if (step.step.type === 'approval') {
        const existingApproval = await db.query.approvals.findFirst({
            where: and(eq(approvals.stepId, stepId), eq(approvals.executionId, executionId))
        })

        if (existingApproval) {
             return { success: true, status: 'waiting_for_approval', message: 'Approval already requested' }
        }

        // Create Approval Request
        await db.insert(approvals).values({
            tenantId,
            executionId,
            stepId,
            status: 'pending',
        })

        // Update Step Status
        await this.updateStepStatus(tenantId, executionId, stepId, 'waiting_for_approval')
        
        return { success: true, status: 'waiting_for_approval', message: 'Approval requested' }
    }

    if (step.step.type === 'wait_for_input') {
        const existingInput = await db.query.playbookInputs.findFirst({
            where: and(eq(playbookInputs.stepId, stepId), eq(playbookInputs.executionId, executionId))
        })

        if (existingInput) {
             return { success: true, status: 'waiting_for_input', message: 'Input already requested' }
        }

        // Create Input Request
        await db.insert(playbookInputs).values({
            tenantId,
            executionId,
            stepId,
            status: 'pending',
            inputSchema: (step.step.config as any)?.schema || {}, // Schema from step config
        })

        // Update Step Status
        await this.updateStepStatus(tenantId, executionId, stepId, 'waiting_for_input')
        
        return { success: true, status: 'waiting_for_input', message: 'Input requested' }
    }

    if (step.step.type !== 'automation') {
       throw new Error('Cannot auto-execute manual step');
    }

    // 3. Update Status to Running
    await this.updateStepStatus(tenantId, executionId, stepId, 'in_progress');

    try {
        // 4. Resolve Action
        const actionId = step.step.actionId;
        let config = step.step.config as Record<string, any>; // Inputs

        if (!actionId) throw new Error('No Action ID configured');

        // RESOLVE VARIABLES
        if (config && step.execution.caseId) {
            // Fetch associated alerts manually for context
            const associatedAlerts = await db.query.alerts.findMany({
                where: eq(alerts.caseId, step.execution.caseId)
            });

            const context = {
                case: step.execution.case,
                alerts: associatedAlerts,
                alert: associatedAlerts[0] // Alias for convenience
            };
            config = this.resolveVariables(config, context);
            console.log(`[Playbook] Resolved config for step ${step.step.name}:`, JSON.stringify(config));
        }

        // Import Registry dynamically or ensure it's loaded
        const { ActionRegistry } = await import('../actions'); // Import from index to ensure actions are registered
        
        // 5. Execute
        const result = await ActionRegistry.execute(actionId, {
            tenantId,
            caseId: step.execution.caseId,
            executionId,
            executionStepId: stepId,
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

  // ==================== EXECUTION HELPERS ====================

  static async updateStepStatus(tenantId: string, executionId: string, stepId: string, status: string, result?: any) {
    await db.update(playbookExecutionSteps)
      .set({
        status, // 'completed', 'skipped', 'failed', 'in_progress', 'waiting_for_approval'
        result,
        completedAt: ['completed', 'failed', 'skipped'].includes(status) ? new Date() : null
      })
      .where(eq(playbookExecutionSteps.id, stepId))
    
    // Auto-trigger next step if completed
    if (status === 'completed') {
        // Run asynchronously to not block response
        this.triggerNextStep(tenantId, executionId, stepId).catch(err => console.error('Next step trigger failed:', err));
    } else if (status === 'failed') {
        // Mark execution as failed
        await db.update(playbookExecutions)
            .set({ status: 'failed', completedAt: new Date() })
            .where(eq(playbookExecutions.id, executionId));
    }

    return { success: true }
  }


  // ==================== APPROVALS ====================
  static async listPendingApprovals(tenantId: string) {
    return await db.query.approvals.findMany({
      where: and(eq(approvals.tenantId, tenantId), eq(approvals.status, 'pending')),
      with: {
        execution: {
            with: { 
                playbook: true,
                case: true
            }
        },
        step: {
            with: { step: true }
        }
      },
      orderBy: (approvals, { desc }) => [desc(approvals.requestedAt)]
    })
  }

  static async approveStep(tenantId: string, approvalId: string, userId: string, decision: 'approved' | 'rejected', comments?: string) {
    const approval = await db.query.approvals.findFirst({
        where: and(eq(approvals.id, approvalId), eq(approvals.tenantId, tenantId))
    })

    if (!approval) throw new Error('Approval request not found')
    if (approval.status !== 'pending') throw new Error('Approval already processed')

    // Update approval record
    await db.update(approvals)
        .set({
            status: decision,
            actedBy: userId,
            actedAt: new Date(),
            comments
        })
        .where(eq(approvals.id, approvalId))

    // Update Step Status
    const stepStatus = decision === 'approved' ? 'completed' : 'failed'
    await this.updateStepStatus(tenantId, approval.executionId, approval.stepId, stepStatus, {
        decision,
        comments,
        decidedBy: userId,
        decidedAt: new Date()
    })

    return { success: true }
  }

  // ==================== PLAYBOOK INPUTS ====================
  static async listPendingInputs(tenantId: string) {
    return await db.query.playbookInputs.findMany({
      where: and(eq(playbookInputs.tenantId, tenantId), eq(playbookInputs.status, 'pending')),
      with: {
        execution: {
            with: { 
                playbook: true,
                case: true
            }
        },
        step: {
            with: { step: true }
        }
      },
      orderBy: (inputs, { desc }) => [desc(inputs.requestedAt)]
    })
  }

  static async submitInput(tenantId: string, inputId: string, userId: string, data: any) {
    const inputReq = await db.query.playbookInputs.findFirst({
        where: and(eq(playbookInputs.id, inputId), eq(playbookInputs.tenantId, tenantId))
    })

    if (!inputReq) throw new Error('Input request not found')
    if (inputReq.status !== 'pending') throw new Error('Input already submitted')

    // Validate Input against schema? (Skip for MVP, assume frontend validated)

    // Update input record
    await db.update(playbookInputs)
        .set({
            status: 'submitted',
            inputData: data,
            respondedBy: userId,
            respondedAt: new Date(),
        })
        .where(eq(playbookInputs.id, inputId))

    // Update Step Status
    await this.updateStepStatus(tenantId, inputReq.executionId, inputReq.stepId, 'completed', {
        inputData: data,
        submittedBy: userId,
        submittedAt: new Date()
    })

    return { success: true }
  }
}
