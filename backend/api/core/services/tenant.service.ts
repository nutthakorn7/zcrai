import { db } from '../../infra/db'
import { tenants, users } from '../../infra/db/schema'
import { eq, like, and, sql } from 'drizzle-orm'

export const TenantService = {
  // ==================== LIST TENANTS ====================
  async list(options?: { search?: string; status?: string; page?: number; limit?: number }) {
    const { search, status, page = 1, limit = 20 } = options || {}
    const offset = (page - 1) * limit

    let query = db.select().from(tenants)

    // Build where conditions
    const conditions = []
    if (search) {
      conditions.push(like(tenants.name, `%${search}%`))
    }
    if (status) {
      conditions.push(eq(tenants.status, status))
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any
    }

    const data = await query.limit(limit).offset(offset)

    // Get total count
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(tenants)
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

  // ==================== GET TENANT BY ID ====================
  async getById(id: string) {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, id))
    if (!tenant) throw new Error('Tenant not found')
    return tenant
  },

  // ==================== CREATE TENANT ====================
  async create(data: { name: string }) {
    // เช็คชื่อซ้ำ
    const existing = await db.select().from(tenants).where(eq(tenants.name, data.name))
    if (existing.length > 0) {
      throw new Error('Tenant name already exists')
    }

    const [tenant] = await db.insert(tenants).values({
      name: data.name,
      status: 'active',
    }).returning()

    return tenant
  },

  // ==================== UPDATE TENANT ====================
  async update(id: string, data: { name?: string; status?: string }) {
    const tenant = await this.getById(id)

    // เช็คชื่อซ้ำ (ถ้าเปลี่ยนชื่อ)
    if (data.name && data.name !== tenant.name) {
      const existing = await db.select().from(tenants).where(eq(tenants.name, data.name))
      if (existing.length > 0) {
        throw new Error('Tenant name already exists')
      }
    }

    const [updated] = await db.update(tenants)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, id))
      .returning()

    return updated
  },

  // ==================== DELETE TENANT (Soft Delete) ====================
  async delete(id: string) {
    await this.getById(id) // เช็คว่ามี tenant นี้หรือไม่

    // Soft delete โดยเปลี่ยน status เป็น suspended
    const [deleted] = await db.update(tenants)
      .set({
        status: 'suspended',
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, id))
      .returning()

    return deleted
  },

  // ==================== GET TENANT STATS ====================
  async getStats(id: string) {
    const tenant = await this.getById(id)

    // นับจำนวน users ใน tenant
    const [{ userCount }] = await db
      .select({ userCount: sql<number>`count(*)` })
      .from(users)
      .where(eq(users.tenantId, id))

    return {
      ...tenant,
      userCount: Number(userCount),
    }
  },
}
