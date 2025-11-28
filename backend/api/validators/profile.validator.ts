import { t } from 'elysia'

export const UpdateProfileSchema = t.Object({
  email: t.Optional(t.String({ format: 'email' })),
})

export const ChangePasswordSchema = t.Object({
  currentPassword: t.String(),
  newPassword: t.String({ minLength: 8 }),
})
