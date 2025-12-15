// Must set env vars before ANY imports, as they initialize Redis clients
process.env.NODE_ENV = 'test'
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6380'

// CI detection
const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true'

import { treaty } from '@elysiajs/eden'
import { app } from '../index'


// Connect to the running server or in-memory
// Since we export 'app' which has .listen(), we can test against localhost if running
// OR we can use app.handle() for fetch-like testing
// Treaty is best for E2E-like 

// Use treaty with app directly (no HTTP server needed)
// This bypasses network entirely and tests Elysia routing directly
console.log('🔗 Using direct app testing (no HTTP)')

// Ensure clean DB state for auth
import { db } from '../infra/db'
import { users, sessions } from '../infra/db/schema'
import { eq } from 'drizzle-orm'
import { hashPassword } from '../utils/password'

// Seed call moved to global CI workflow to avoid race conditions in parallel tests
// await seedSuperAdmin()

export const api = treaty<typeof app>(app)

// FIX: Regenerate password hash to ensure it matches verification
const TEST_PASSWORD = 'SuperAdmin@123!'
await (async () => {
    try {
        const [u] = await db.select().from(users).where(eq(users.email, 'superadmin@zcr.ai'))
        if (!u) {
            console.error('❌ FATAL: Superadmin not found in test setup! CI Seeding might have failed.')
        } else {
            // Regenerate hash using centralized utility
            const freshHash = await hashPassword(TEST_PASSWORD)
            await db.update(users).set({ passwordHash: freshHash }).where(eq(users.email, 'superadmin@zcr.ai'))
            console.log(`✅ Updated superadmin password hash`)
            console.log(`   Email: ${u.email}`)
            console.log(`   New Hash: ${freshHash.substring(0, 25)}...`)
        }
    } catch (e) {
        console.error('❌ Error updating superadmin:', e)
    }
})()

export const AUTH_CREDENTIALS = {
    email: 'superadmin@zcr.ai',
    password: 'SuperAdmin@123!' // Default seeded password
}

export async function getAuthHeaders() {
    // In CI, we now want REAL auth because we are seeding the DB
    // if (isCI) { return { cookie: 'mock-ci-cookie' } }
    
    const { response } = await api.auth.login.post({
        email: AUTH_CREDENTIALS.email,
        password: AUTH_CREDENTIALS.password
    })
    
    const cookie = response.headers.get('set-cookie')
    if (!cookie) throw new Error('Failed to login in test helper')
    
    return {
        cookie
    }
}

// Export isCI for tests to skip auth-dependent tests
export { isCI }
