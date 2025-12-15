/**
 * Seed Super Admin User
 * Run: bun run scripts/seed-superadmin.ts
 */

import { db } from '../infra/db'
import { users, tenants } from '../infra/db/schema'
import { eq } from 'drizzle-orm'
import { hashPassword } from '../utils/password'

const SUPERADMIN_EMAIL = process.env.SUPERADMIN_EMAIL || 'superadmin@zcr.ai'
const SUPERADMIN_PASSWORD = process.env.SUPERADMIN_PASSWORD || 'SuperAdmin@123!'

async function seedSuperAdmin() {
  console.log('🔐 Seeding Super Admin...')

  const email = SUPERADMIN_EMAIL
  const password = SUPERADMIN_PASSWORD

  // 1. Check/Create System Tenant
  let tenantId: string | undefined
  const [existingTenant] = await db.select().from(tenants).where(eq(tenants.name, 'System Admin'))
  
  if (existingTenant) {
    tenantId = existingTenant.id
    console.log('✅ System Admin tenant found:', tenantId)
  } else {
    const [newTenant] = await db.insert(tenants).values({
      name: 'System Admin',
      status: 'active'
    }).returning()
    tenantId = newTenant.id
    console.log('✅ System Admin tenant created:', tenantId)
  }

  // 2. Check/Create Super Admin User
  const [existing] = await db.select()
    .from(users)
    .where(eq(users.email, email))

  const passwordHash = await hashPassword(password)

  if (existing) {
    if (existing.role === 'superadmin') {
       await db.update(users)
        .set({ 
          passwordHash,
          tenantId: tenantId 
        })
        .where(eq(users.email, email))
       console.log('✅ Super Admin updated:', email)
    } else {
        console.log('⚠️ User exists but is not superadmin:', email)
    }
  } else {
    const [superadmin] = await db.insert(users).values({
        email,
        passwordHash,
        role: 'superadmin',
        tenantId: tenantId,
        status: 'active',
      }).returning()
      console.log('✅ Super Admin created:', superadmin.email)
  }

  console.log('📧 Email:', email)
  console.log('🔑 Password:', password)
  console.log('')
  console.log('⚠️  Please change the password after first login!')
}

seedSuperAdmin()
  .then(() => {
    console.log('Done!')
    process.exit(0)
  })
  .catch((e) => {
    console.error('Error:', e)
    process.exit(1)
  })
