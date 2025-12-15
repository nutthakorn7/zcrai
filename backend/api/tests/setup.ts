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

// Start server for testing on fixed port
try {
    app.listen(4001)
    console.log('🚀 Test Server started on port 4001')
} catch (e) {
    console.error('❌ Failed to start test server:', e)
}

const PORT = 4001
const API_URL = `http://127.0.0.1:${PORT}`
console.log('🔗 Test API URL:', API_URL)

// Ensure clean DB state for auth
import { db } from '../infra/db'
import { users, sessions } from '../infra/db/schema'
import { eq } from 'drizzle-orm'

// Seed call moved to global CI workflow to avoid race conditions in parallel tests
// await seedSuperAdmin()

export const api = treaty<typeof app>(API_URL)

// DEBUG: Verify Seed
await (async () => {
    try {
        const [u] = await db.select().from(users).where(eq(users.email, 'superadmin@zcr.ai'))
        if (!u) {
            console.error('❌ FATAL: Superadmin not found in test setup! CI Seeding might have failed.')
        } else {
            console.log(`✅ Found superadmin: ${u.email} (Hash: ${u.passwordHash.substring(0, 20)}...)`)
        }
    } catch (e) {
        console.error('❌ Error checking superadmin:', e)
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
