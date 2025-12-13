import { db } from '../../infra/db'
import { users, tenants } from '../../infra/db/schema'
import { eq } from 'drizzle-orm'

export const ProfileService = {
  // ==================== GET PROFILE ====================
  async get(userId: string) {
    const [result] = await db.select({
      user: {
        id: users.id,
        email: users.email,
        role: users.role,
        status: users.status,
        tenantId: users.tenantId,
        mfaEnabled: users.mfaEnabled,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      },
      tenant: tenants
    })
    .from(users)
    .leftJoin(tenants, eq(users.tenantId, tenants.id))
    .where(eq(users.id, userId))

    if (!result) throw new Error('User not found')
    
    return {
      ...result.user,
      tenant: result.tenant
    }
  },

  // ==================== UPDATE PROFILE ====================
  async update(userId: string, data: { email?: string }) {
    // เช็ค email ซ้ำ (ถ้าเปลี่ยน email)
    if (data.email) {
      const existing = await db.select().from(users)
        .where(eq(users.email, data.email))
      
      if (existing.length > 0 && existing[0].id !== userId) {
        throw new Error('Email already exists')
      }
    }

    const [updated] = await db.update(users)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning({
        id: users.id,
        email: users.email,
        role: users.role,
        status: users.status,
        mfaEnabled: users.mfaEnabled,
      })

    return updated
  },

  // ==================== CHANGE PASSWORD ====================
  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const [user] = await db.select().from(users).where(eq(users.id, userId))
    if (!user) throw new Error('User not found')

    // Verify current password
    const isValid = await Bun.password.verify(currentPassword, user.passwordHash)
    if (!isValid) throw new Error('Current password is incorrect')

    // Hash new password
    const hashedPassword = await Bun.password.hash(newPassword)

    await db.update(users)
      .set({
        passwordHash: hashedPassword,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))

    return { message: 'Password changed successfully' }
  },
}
