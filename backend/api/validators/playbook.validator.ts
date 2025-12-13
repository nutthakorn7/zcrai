import { t } from 'elysia'

export const CreatePlaybookSchema = t.Object({
  title: t.String(),
  description: t.Optional(t.String()),
  triggerType: t.Optional(t.String()),
  targetTag: t.Optional(t.String()),
  steps: t.Optional(t.Array(t.Object({
    name: t.String(),
    type: t.String(), // 'manual', 'automation'
    description: t.Optional(t.String()),
    actionId: t.Optional(t.String()),
    config: t.Optional(t.Any())
  })))
})

export const UpdatePlaybookSchema = t.Object({
  title: t.Optional(t.String()),
  description: t.Optional(t.String()),
  isActive: t.Optional(t.Boolean()),
  steps: t.Optional(t.Array(t.Object({
    name: t.String(),
    type: t.String(),
    description: t.Optional(t.String()),
    actionId: t.Optional(t.String()),
    config: t.Optional(t.Any())
  })))
})

export const RunPlaybookSchema = t.Object({
  caseId: t.String(),
  playbookId: t.String()
})

export const UpdateExecutionStepSchema = t.Object({
  status: t.String(),
  result: t.Optional(t.Any())
})
