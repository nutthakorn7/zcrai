import { t } from 'elysia'

export const AddSentinelOneSchema = t.Object({
  url: t.String(),
  token: t.String(),
  label: t.Optional(t.String()),
})

export const AddCrowdStrikeSchema = t.Object({
  clientId: t.String(),
  clientSecret: t.String(),
  baseUrl: t.Optional(t.String()), // default: api.us-2.crowdstrike.com
  label: t.Optional(t.String()),
})
