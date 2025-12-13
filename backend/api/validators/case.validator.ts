import { t } from 'elysia'

export const CreateCaseSchema = t.Object({
  title: t.String({ minLength: 3 }),
  description: t.Optional(t.String()),
  severity: t.Optional(t.String()), // critical, high, medium, low
  priority: t.Optional(t.String()), // P1, P2, P3
  assigneeId: t.Optional(t.String()),
  tags: t.Optional(t.Array(t.String()))
})

export const UpdateCaseSchema = t.Object({
  title: t.Optional(t.String()),
  description: t.Optional(t.String()),
  status: t.Optional(t.String()), // open, investigating, resolved, closed
  priority: t.Optional(t.String()),
  assigneeId: t.Optional(t.String()) // Can be empty string to unassign? Handled in service
})

export const AddCommentSchema = t.Object({
  content: t.String({ minLength: 1 })
})
