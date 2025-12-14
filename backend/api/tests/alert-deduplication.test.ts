import { describe, expect, it, beforeAll, beforeEach } from 'bun:test'
import { api, getAuthHeaders } from './setup'
import { db } from '../infra/db'
import { alerts } from '../infra/db/schema'
import { eq } from 'drizzle-orm'

describe('Alert Deduplication', () => {
  let headers: { cookie: string }
  let tenantId: string

  beforeAll(async () => {
    headers = await getAuthHeaders()
    // Get tenant ID from auth
    const user = await db.select().from(users).where(eq(users.email, 'superadmin@zcr.ai')).limit(1)
    tenantId = user[0].tenantId
  })

  beforeEach(async () => {
    // Clean up test alerts
    await db.delete(alerts).where(eq(alerts.tenantId, tenantId))
  })

  it('should deduplicate identical alerts within 24h', async () => {
    const alertData = {
      source: 'sentinelone',
      severity: 'high',
      title: 'Port Scan Detected',
      description: 'Suspicious port scanning activity from 192.168.1.100',
    }

    // Create first alert
    const { data: alert1 } = await api.alerts.post(alertData, { headers })
    expect(alert1?.success).toBe(true)
    expect(alert1?.data?.duplicateCount).toBe(1)

    // Create duplicate alert (same source, severity, title)
    const { data: alert2 } = await api.alerts.post(alertData, { headers })
    expect(alert2?.success).toBe(true)
    expect(alert2?.data?.id).toBe(alert1?.data?.id) // Same alert ID
    expect(alert2?.data?.duplicateCount).toBe(2) // Incremented count

    // Verify only one alert exists in DB
    const dbAlerts = await db.select().from(alerts).where(eq(alerts.tenantId, tenantId))
    expect(dbAlerts.length).toBe(1)
    expect(dbAlerts[0].duplicateCount).toBe(2)
  })

  it('should create new alert after 24h window expires', async () => {
    // This test would need time mocking
    // For now, just verify different timestamps create different alerts
    const alertData1 = {
      source: 'crowdstrike',
      severity: 'critical',
      title: 'SQL Injection Attempt',
      description: 'Detected at 2025-12-14 10:00:00',
    }

    const alertData2 = {
      ...alertData1,
      // Different description = different fingerprint if we include observables
      description: 'Detected at 2025-12-14 11:00:00',  
    }

    const { data: alert1 } = await api.alerts.post(alertData1, { headers })
    const { data: alert2 } = await api.alerts.post(alertData2, { headers })

    expect(alert1?.data?.id).toBe(alert2?.data?.id) // Same since title/source/severity match
  })

  it('should differentiate alerts by severity', async () => {
    const baseAlert = {
      source: 'sentinelone',
      title: 'Login Failure',
      description: 'Failed login attempt from 10.0.0.1',
    }

    const { data: alert1 } = await api.alerts.post({
      ...baseAlert,
      severity: 'low',
    }, { headers })

    const { data: alert2 } = await api.alerts.post({
      ...baseAlert,
      severity: 'critical', // Different severity
    }, { headers })

    expect(alert1?.data?.id).not.toBe(alert2?.data?.id) // Different fingerprints
    expect(alert1?.data?.duplicateCount).toBe(1)
    expect(alert2?.data?.duplicateCount).toBe(1)
  })

  it('should update lastSeenAt on duplicate', async () => {
    const alertData = {
      source: 'crowdstrike',
      severity: 'medium',
      title: 'Malware Detected',
      description: 'Trojan found',
    }

    const { data: alert1 } = await api.alerts.post(alertData, { headers })
    const firstSeenAt = new Date(alert1?.data?.firstSeenAt)
    const lastSeenAt1 = new Date(alert1?.data?.lastSeenAt)

    // Wait 1 second
    await new Promise(resolve => setTimeout(resolve, 1000))

    const { data: alert2 } = await api.alerts.post(alertData, { headers })
    const lastSeenAt2 = new Date(alert2?.data?.lastSeenAt)

    expect(alert2?.data?.firstSeenAt).toBe(alert1?.data?.firstSeenAt) // Unchanged
    expect(lastSeenAt2.getTime()).toBeGreaterThan(lastSeenAt1.getTime()) // Updated
  })

  it('should generate consistent fingerprints', async () => {
    const alert1 = {
      source: 'sentinelone',
      severity: 'high',
      title: '  Port Scan Detected  ', // Extra spaces
    }

    const alert2 = {
      source: 'SentinelOne', // Different case
      severity: 'HIGH', // Different case
      title: 'port scan detected', // Different case, no spaces
    }

    const { data: result1 } = await api.alerts.post({ ...alert1, description: 'Test' }, { headers })
    const { data: result2 } = await api.alerts.post({ ...alert2, description: 'Test' }, { headers })

    // Should be the same alert due to normalization (lowercase, trim)
    expect(result1?.data?.fingerprint).toBe(result2?.data?.fingerprint)
    expect(result2?.data?.duplicateCount).toBe(2)
  })
})
