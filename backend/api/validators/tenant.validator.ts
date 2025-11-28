import { t } from 'elysia'

export const CreateTenantSchema = t.Object({
  name: t.String({ minLength: 3, maxLength: 100 }),
})

export const UpdateTenantSchema = t.Object({
  name: t.Optional(t.String({ minLength: 3, maxLength: 100 })),
  status: t.Optional(t.Union([t.Literal('active'), t.Literal('suspended')])),
})

export const TenantQuerySchema = t.Object({
  search: t.Optional(t.String()),
  status: t.Optional(t.String()),
  page: t.Optional(t.String()),
  limit: t.Optional(t.String()),
})
