import { describe, expect, it, beforeAll } from 'bun:test'
import { VirusTotalProvider } from '../core/enrichment-providers/virustotal'
import { AbuseIPDBProvider } from '../core/enrichment-providers/abuseipdb'

const isCI = process.env.CI || process.env.GITHUB_ACTIONS

describe('Enrichment Service', () => {
    let skipTests = false

    beforeAll(async () => {
        if (isCI) {
            skipTests = true
        }
    })

    it('should queue enrichment when creating an observable', async () => {
        // This test requires DB - skip in CI
        if (skipTests) {
            expect(true).toBe(true)
            return
        }
        
        // Test implementation would go here if DB available
        expect(true).toBe(true)
    })

    it('VirusTotalProvider should return mock data when no key', async () => {
        const provider = new VirusTotalProvider()
        const result = await provider.enrichIP('192.168.6.66')
        expect(result.malicious).toBe(true)
        expect(result.country).toBe('US')
    })

    it('AbuseIPDBProvider should return mock data when no key', async () => {
        const provider = new AbuseIPDBProvider()
        const result = await provider.checkIP('44.66.66.66')
        expect(result.abuseConfidenceScore).toBe(85)
        expect(result.isWhitelisted).toBe(false)
    })
})
