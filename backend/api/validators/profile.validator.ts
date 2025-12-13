import { t } from 'elysia'

export const UpdateProfileSchema = t.Object({
  email: t.Optional(t.String({ format: 'email' })),
  name: t.Optional(t.String()),
  jobTitle: t.Optional(t.String()),
  bio: t.Optional(t.String()),
  phoneNumber: t.Optional(t.String()),
  marketingOptIn: t.Optional(t.Boolean()),
  emailAlertsEnabled: t.Optional(t.Boolean()),
})

export const ChangePasswordSchema = t.Object({
  currentPassword: t.String(),
  newPassword: t.String({ minLength: 8 }),
})
