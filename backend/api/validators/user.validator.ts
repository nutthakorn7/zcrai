import { t } from 'elysia'

export const InviteUserSchema = t.Object({
  email: t.String({ format: 'email' }),
  role: t.Union([
    t.Literal('superadmin'), // Allow superadmin
    t.Literal('tenant_admin'),
    t.Literal('soc_analyst'),
    t.Literal('customer'),
  ]),
})

export const UpdateUserSchema = t.Object({
  role: t.Optional(t.Union([
    t.Literal('superadmin'), // Allow superadmin
    t.Literal('tenant_admin'),
    t.Literal('soc_analyst'),
    t.Literal('customer'),
  ])),
  status: t.Optional(t.Union([
    t.Literal('active'),
    t.Literal('pending'),
    t.Literal('suspended'),
  ])),
})

export const UserQuerySchema = t.Object({
  search: t.Optional(t.String()),
  role: t.Optional(t.String()),
  status: t.Optional(t.String()),
  page: t.Optional(t.String()),
  limit: t.Optional(t.String()),
})
