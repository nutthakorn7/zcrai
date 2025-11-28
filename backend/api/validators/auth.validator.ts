import { t } from 'elysia'

export const RegisterSchema = t.Object({
  email: t.String({ format: 'email' }),
  password: t.String({ minLength: 8 }),
  tenantName: t.String({ minLength: 3 }),
})

export const LoginSchema = t.Object({
  email: t.String({ format: 'email' }),
  password: t.String(),
  mfaCode: t.Optional(t.String({ minLength: 6, maxLength: 6 })),
})

export const ForgotPasswordSchema = t.Object({
  email: t.String({ format: 'email' }),
})

export const ResetPasswordSchema = t.Object({
  token: t.String(),
  newPassword: t.String({ minLength: 8 }),
})

export const MFAVerifySchema = t.Object({
  secret: t.String(),
  code: t.String({ minLength: 6, maxLength: 6 }),
  backupCodes: t.Array(t.String()),
})

export const MFACodeSchema = t.Object({
  code: t.String({ minLength: 6, maxLength: 6 }),
})

export const MFADisableSchema = t.Object({
  password: t.String(),
})
