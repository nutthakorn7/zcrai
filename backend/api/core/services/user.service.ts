import { db } from '../../infra/db'
import { users, tenants } from '../../infra/db/schema'
import { redis } from '../../infra/cache/redis'
import { eq, like, and, sql, ne } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { hashPassword } from '../../utils/password'
import { EmailService } from './email.service'

export const UserService = {
  // ==================== LIST USERS (ภายใน Tenant) ====================
  async list(tenantId: string, options?: { search?: string; role?: string; status?: string; page?: number; limit?: number }) {
    const { search, role, status, page = 1, limit = 20 } = options || {}
    const offset = (page - 1) * limit

    const conditions = [eq(users.tenantId, tenantId)]
    
    if (search) {
      conditions.push(like(users.email, `%${search}%`))
    }
    if (role) {
      conditions.push(eq(users.role, role))
    }
    if (status) {
      conditions.push(eq(users.status, status))
    }

    const data = await db.select({
      id: users.id,
      email: users.email,
      role: users.role,
      status: users.status,
      mfaEnabled: users.mfaEnabled,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .where(and(...conditions))
    .limit(limit)
    .offset(offset)

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(and(...conditions))

    return {
      data,
      pagination: {
        page,
        limit,
        total: Number(count),
        totalPages: Math.ceil(Number(count) / limit),
      },
    }
  },

  // ==================== GET USER BY ID ====================
  async getById(id: string, tenantId?: string) {
    // Check Cache
    const cached = await redis.get(`user:${id}`)
    if (cached) {
      try {
        const user = JSON.parse(cached)
        // Verify tenant match if requested
        if (tenantId && user.tenantId !== tenantId) {
             // Fallthrough to DB check if cached data looks stale/wrong context
        } else {
             return user
        }
      } catch (e) {
        // invalid cache, ignore
      }
    }

    const conditions = [eq(users.id, id)]
    if (tenantId) {
      conditions.push(eq(users.tenantId, tenantId))
    }

    const [user] = await db.select({
      id: users.id,
      email: users.email,
      role: users.role,
      status: users.status,
      tenantId: users.tenantId,
      mfaEnabled: users.mfaEnabled,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .where(and(...conditions))

    if (!user) throw new Error('User not found')

    // Cache result
    await redis.setex(`user:${id}`, 300, JSON.stringify(user))

    return user
  },

  // ==================== INVITE USER (สร้าง User ใหม่) ====================
  async invite(tenantId: string, data: { email: string; role: string }) {
    // เช็ค email ซ้ำ
    const existing = await db.select().from(users).where(eq(users.email, data.email))
    if (existing.length > 0) {
      throw new Error('Email already exists')
    }

    // สร้าง temporary password (user ต้อง reset เอง)
    const tempPassword = nanoid(12)
    const hashedPassword = await hashPassword(tempPassword)

    const [user] = await db.insert(users).values({
      email: data.email,
      passwordHash: hashedPassword,
      tenantId,
      role: data.role,
      status: 'pending', // รอ user verify email
    }).returning({
      id: users.id,
      email: users.email,
      role: users.role,
      status: users.status,
    })

    // Send Invitation Email
    const emailSent = await EmailService.sendInvite(data.email, tempPassword)
    
    if (emailSent) {
      console.log(`✅ Invited ${data.email} (Email sent)`)
    } else {
      console.warn(`⚠️ Failed to send invite email to ${data.email}. Temp Password: ${tempPassword}`)
    }

    return { user, tempPassword } // tempPassword ให้ dev test เท่านั้น
  },

  // ==================== UPDATE USER ====================
  async update(id: string, tenantId: string, data: { role?: string; status?: string }) {
    // เช็คว่า user อยู่ใน tenant นี้
    await this.getById(id, tenantId)
    
    // Invalidate Cache
    await redis.del(`user:${id}`)

    const [updated] = await db.update(users)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(and(eq(users.id, id), eq(users.tenantId, tenantId)))
      .returning({
        id: users.id,
        email: users.email,
        role: users.role,
        status: users.status,
      })

    return updated
  },

  // ==================== DELETE USER (Soft Delete) ====================
  async delete(id: string, tenantId: string) {
    await this.getById(id, tenantId)

    // Invalidate Cache
    await redis.del(`user:${id}`)

    const [deleted] = await db.update(users)
      .set({
        status: 'suspended',
        updatedAt: new Date(),
      })
      .where(and(eq(users.id, id), eq(users.tenantId, tenantId)))
      .returning({
        id: users.id,
        email: users.email,
        status: users.status,
      })

    return deleted
  },

  // ==================== LIST ALL USERS (Super Admin) ====================
  async listAll(options?: { search?: string; tenantId?: string; page?: number; limit?: number }) {
    const { search, tenantId, page = 1, limit = 20 } = options || {}
    const offset = (page - 1) * limit

    const conditions = []
    if (search) {
      conditions.push(like(users.email, `%${search}%`))
    }
    if (tenantId) {
      conditions.push(eq(users.tenantId, tenantId))
    }

    const data = await db.select({
      id: users.id,
      email: users.email,
      role: users.role,
      status: users.status,
      tenantId: users.tenantId,
      mfaEnabled: users.mfaEnabled,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .limit(limit)
    .offset(offset)

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(conditions.length > 0 ? and(...conditions) : undefined)

    return {
      data,
      pagination: {
        page,
        limit,
        total: Number(count),
        totalPages: Math.ceil(Number(count) / limit),
      },
    }
  },
}
