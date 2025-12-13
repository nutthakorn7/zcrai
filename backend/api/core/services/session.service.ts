import { db } from '../../infra/db'
import { sessions } from '../../infra/db/schema'
import { eq, and, gt } from 'drizzle-orm'

export const SessionService = {
  // ==================== LIST ACTIVE SESSIONS ====================
  async listActive(userId: string) {
    const now = new Date()
    return await db.select({
      id: sessions.id,
      userAgent: sessions.userAgent,
      ipAddress: sessions.ipAddress,
      createdAt: sessions.createdAt,
      lastActive: sessions.createdAt, // Ideally we would track last_active separately, but created_at is fine for now
      isCurrent: sessions.token // We can't determine "current" here easily without the current token, controller will handle it
    })
    .from(sessions)
    .where(
      and(
        eq(sessions.userId, userId),
        eq(sessions.isValid, true),
        gt(sessions.expiresAt, now)
      )
    )
    .orderBy(sessions.createdAt) // Newest last (actually usually descending is better, but sorting by created is fine)
  },

  // ==================== REVOKE SESSION ====================
  async revoke(sessionId: string, userId: string) {
    const [session] = await db.select().from(sessions)
      .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)))
    
    if (!session) throw new Error('Session not found')

    await db.update(sessions)
      .set({ isValid: false })
      .where(eq(sessions.id, sessionId))
    
    return { message: 'Session revoked' }
  }
}
