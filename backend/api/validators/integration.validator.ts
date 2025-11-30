import { t } from 'elysia'

// ⭐ Fetch Settings Schema - กำหนดว่าดึงข้อมูลอะไรบ้าง + กี่วัน
const FetchSettingItem = t.Object({
  enabled: t.Boolean(),
  days: t.Number({ minimum: 1, maximum: 365 }),
})

// SentinelOne Fetch Settings
export const S1FetchSettings = t.Object({
  threats: t.Optional(FetchSettingItem),    // Default: enabled=true, days=365
  activities: t.Optional(FetchSettingItem), // Default: enabled=true, days=120
  alerts: t.Optional(FetchSettingItem),     // Default: enabled=true, days=365
})

// CrowdStrike Fetch Settings  
export const CSFetchSettings = t.Object({
  alerts: t.Optional(FetchSettingItem),     // Default: enabled=true, days=365
  detections: t.Optional(FetchSettingItem), // Default: enabled=true, days=365
  incidents: t.Optional(FetchSettingItem),  // Default: enabled=true, days=365
})

export const AddSentinelOneSchema = t.Object({
  url: t.String(),
  token: t.String(),
  label: t.Optional(t.String()),
  fetchSettings: t.Optional(S1FetchSettings), // ⭐ User สามารถ custom ได้
})

export const AddCrowdStrikeSchema = t.Object({
  clientId: t.String(),
  clientSecret: t.String(),
  baseUrl: t.Optional(t.String()), // default: api.us-2.crowdstrike.com
  label: t.Optional(t.String()),
  fetchSettings: t.Optional(CSFetchSettings), // ⭐ User สามารถ custom ได้
})

export const AddAISchema = t.Object({
  apiKey: t.String(),
  label: t.Optional(t.String()),
})

export const UpdateIntegrationSchema = t.Object({
  label: t.Optional(t.String()),
  isActive: t.Optional(t.Boolean()),
})
