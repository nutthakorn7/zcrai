import { t } from 'elysia'

export const CreateAlertSchema = t.Object({
  title: t.String(),
  description: t.String(),
  severity: t.String(), // 'critical' | 'high' | 'medium' | 'low' | 'info'
  source: t.String(),
  rawData: t.Optional(t.Any()),
})

export const UpdateAlertSchema = t.Object({
    status: t.Optional(t.String()),
    dismissReason: t.Optional(t.String())
})

export const AlertQuerySchema = t.Object({
    status: t.Optional(t.String()),
    severity: t.Optional(t.String()),
    source: t.Optional(t.String()),
    page: t.Optional(t.String()),
    limit: t.Optional(t.String())
})
