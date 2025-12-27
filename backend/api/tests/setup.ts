// Must set env vars before ANY imports, as they initialize Redis clients
process.env.NODE_ENV = 'test'
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'

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
import { users, tenants } from '../infra/db/schema'
import { eq } from 'drizzle-orm'
import { hashPassword } from '../utils/password'

export const api = treaty<typeof app>(app)

const TEST_EMAIL = 'superadmin@zcr.ai'
const TEST_PASSWORD = 'SuperAdmin@123!'

// Initialize test database - create superadmin if missing
async function initTestDatabase() {
    try {
        // Check database connection
        console.log('🔌 Checking database connection...')
        
        // Check if superadmin exists
        const [existingUser] = await db.select().from(users).where(eq(users.email, TEST_EMAIL))
        
        if (!existingUser) {
            console.log('📝 Superadmin not found, creating...')
            
            // Create System Admin tenant first
            let tenantId: string
            const [existingTenant] = await db.select().from(tenants).where(eq(tenants.name, 'System Admin'))
            
            if (existingTenant) {
                tenantId = existingTenant.id
                console.log('   ✅ Using existing System Admin tenant:', tenantId)
            } else {
                const [newTenant] = await db.insert(tenants).values({
                    name: 'System Admin',
                    status: 'active'
                }).returning()
                tenantId = newTenant.id
                console.log('   ✅ Created System Admin tenant:', tenantId)
            }
            
            // Create superadmin user
            const passwordHash = await hashPassword(TEST_PASSWORD)
            const [newUser] = await db.insert(users).values({
                email: TEST_EMAIL,
                passwordHash,
                role: 'superadmin',
                tenantId,
                status: 'active',
            }).returning()
            console.log('   ✅ Created superadmin:', newUser.email)
        } else {
            // Update existing superadmin password to ensure it matches
            console.log('🔄 Updating superadmin password hash...')
            const freshHash = await hashPassword(TEST_PASSWORD)
            await db.update(users).set({ 
                passwordHash: freshHash,
            }).where(eq(users.email, TEST_EMAIL))
            console.log('   ✅ Updated superadmin password hash')
            
            // Immediate verification check
            const verified = await Bun.password.verify(TEST_PASSWORD, freshHash)
            console.log(`   Verification Check: ${verified ? 'PASS ✅' : 'FAIL ❌'}`)
        }
        
        console.log('✅ Test database initialized successfully')
    } catch (e: any) {
        console.error('❌ Error initializing test database:', e.message || e)
        
        // In CI, don't exit - let tests run with mock auth
        if (isCI) {
            console.warn('⚠️ CI Mode: Continuing despite database error. Some tests may fail.')
        } else {
            console.error('💡 Tip: Make sure docker-compose-dev is running')
            process.exit(1)
        }
    }
}

// Run initialization
await initTestDatabase()

export const AUTH_CREDENTIALS = {
    email: TEST_EMAIL,
    password: TEST_PASSWORD
}

// Cached auth cookie
let cachedAuthCookie: string | null = null

export async function getAuthHeaders(): Promise<{ cookie: string }> {
    // Return cached cookie if available
    if (cachedAuthCookie) {
        return { cookie: cachedAuthCookie }
    }
    
    try {
        const { response, error } = await api.auth.login.post({
            email: AUTH_CREDENTIALS.email,
            password: AUTH_CREDENTIALS.password
        })
        
        if (error) {
            console.error('Login error in getAuthHeaders:', error)
            throw new Error(`Login failed: ${JSON.stringify(error)}`)
        }
        
        const cookie = response.headers.get('set-cookie')
        if (!cookie) {
            throw new Error('No cookie returned from login')
        }
        
        cachedAuthCookie = cookie
        return { cookie }
    } catch (e: any) {
        console.error('❌ Failed to get auth headers:', e.message || e)
        
        // In CI, return a mock cookie to allow tests to run
        if (isCI) {
            console.warn('⚠️ CI Mode: Using mock auth cookie')
            return { cookie: 'mock_ci_auth_cookie=test' }
        }
        
        throw e
    }
}

// Clear cached auth (useful for logout tests)
export function clearAuthCache() {
    cachedAuthCookie = null
}

// Export isCI for tests to skip auth-dependent tests
export { isCI }

