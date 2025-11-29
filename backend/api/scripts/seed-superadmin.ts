/**
 * Seed Super Admin User
 * Run: bun run scripts/seed-superadmin.ts
 */

import { db } from '../infra/db'
import { users } from '../infra/db/schema'
import { eq } from 'drizzle-orm'

const SUPERADMIN_EMAIL = process.env.SUPERADMIN_EMAIL || 'superadmin@zcr.ai'
const SUPERADMIN_PASSWORD = process.env.SUPERADMIN_PASSWORD || 'SuperAdmin@123!'

async function seedSuperAdmin() {
  console.log('🔐 Seeding Super Admin...')

  // Check if superadmin already exists
  const [existing] = await db.select()
    .from(users)
    .where(eq(users.email, SUPERADMIN_EMAIL))

  if (existing) {
    console.log('✅ Super Admin already exists:', SUPERADMIN_EMAIL)
    return
  }

  // Hash password
  const passwordHash = await Bun.password.hash(SUPERADMIN_PASSWORD, {
    algorithm: 'bcrypt',
    cost: 10,
  })

  // Create superadmin (no tenantId)
  const [superadmin] = await db.insert(users).values({
    email: SUPERADMIN_EMAIL,
    passwordHash,
    role: 'superadmin',
    tenantId: null as any, // Super admin has no tenant
    status: 'active',
  }).returning()

  console.log('✅ Super Admin created:', superadmin.email)
  console.log('📧 Email:', SUPERADMIN_EMAIL)
  console.log('🔑 Password:', SUPERADMIN_PASSWORD)
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
