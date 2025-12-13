import { describe, expect, it, beforeAll } from 'bun:test'
import { api, getAuthHeaders, seedSuperAdmin, AUTH_CREDENTIALS } from './setup'
import { db } from '../infra/db'
import { enrichmentQueue, observables, tenants, users } from '../infra/db/schema'
import { eq } from 'drizzle-orm'
import { VirusTotalProvider } from '../core/enrichment-providers/virustotal'
import { AbuseIPDBProvider } from '../core/enrichment-providers/abuseipdb'
import { ObservableService } from '../core/services/observable.service'

describe('Enrichment Service', () => {
    let tenantId: string
    let headers: any

    beforeAll(async () => {
        // We know seedSuperAdmin is void, but we can fetch the tenant/user from DB
        const [superAdmin] = await db.select().from(users).where(eq(users.email, AUTH_CREDENTIALS.email))
        if (!superAdmin || !superAdmin.tenantId) throw new Error("Superadmin not found or corrupted")
        tenantId = superAdmin.tenantId
        
        headers = await getAuthHeaders()
    })

    it('should queue enrichment when creating an observable', async () => {
        const value = '1.1.1.1'
        
        // Ensure clean state - delete referenced rows first to respect FK
        const existing = await db.select().from(observables).where(eq(observables.value, value))
        if (existing.length > 0) {
            await db.delete(enrichmentQueue).where(eq(enrichmentQueue.observableId, existing[0].id))
            await db.delete(observables).where(eq(observables.value, value))
        }

        const { data } = await api.observables.post({
            type: 'ip',
            value: value,
            tags: []
        }, { headers })

        expect(data).toBeDefined()
        expect(data?.success).toBe(true)
        const obsId = data?.data.id

        // Check queue
        const queued = await db.select().from(enrichmentQueue).where(eq(enrichmentQueue.observableId, obsId as string))
        expect(queued.length).toBeGreaterThan(0)
        expect(queued[0].status).toBe('pending')
    })

    it('VirusTotalProvider should return mock data when no key', async () => {
        const provider = new VirusTotalProvider()
        const result = await provider.enrichIP('192.168.6.66')
        expect(result.malicious).toBe(true)
        expect(result.country).toBe('US')
    })

     it('AbuseIPDBProvider should return mock data when no key', async () => {
        const provider = new AbuseIPDBProvider()
        const result = await provider.checkIP('44.66.66.66') // triggers bad logic
        expect(result.abuseConfidenceScore).toBe(85)
        expect(result.isWhitelisted).toBe(false)
    })
})
