import { db } from '../../infra/db'
import { parsers } from '../../infra/db/schema'
import { eq, and } from 'drizzle-orm'

export const ParserService = {
  // List all parsers for a tenant
  async list(tenantId: string) {
    return await db.select().from(parsers).where(eq(parsers.tenantId, tenantId))
  },

  // Get single parser
  async getById(tenantId: string, id: string) {
    const [parser] = await db.select()
      .from(parsers)
      .where(and(eq(parsers.id, id), eq(parsers.tenantId, tenantId)))
    return parser
  },

  // Create new parser
  async create(tenantId: string, userId: string, data: {
    name: string
    description?: string
    type: 'regex' | 'grok' | 'json_path'
    pattern: string
    fieldMappings?: any
    testInput?: string
  }) {
    const [parser] = await db.insert(parsers).values({
      tenantId,
      createdBy: userId,
      name: data.name,
      description: data.description,
      type: data.type,
      pattern: data.pattern,
      fieldMappings: data.fieldMappings,
      testInput: data.testInput,
      isActive: true,
    }).returning()
    
    return parser
  },

  // Update parser
  async update(tenantId: string, id: string, data: Partial<{
    name: string
    description: string
    pattern: string
    fieldMappings: any
    testInput: string
    isActive: boolean
  }>) {
    const [parser] = await db.update(parsers)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(parsers.id, id), eq(parsers.tenantId, tenantId)))
      .returning()
    
    return parser
  },

  // Delete parser
  async delete(tenantId: string, id: string) {
    await db.delete(parsers)
      .where(and(eq(parsers.id, id), eq(parsers.tenantId, tenantId)))
    return { message: 'Parser deleted' }
  },

  // Test parser against sample input
  async test(pattern: string, type: string, testInput: string) {
    try {
      if (type === 'regex') {
        const regex = new RegExp(pattern)
        const match = regex.exec(testInput)
        if (!match) {
          return { success: false, error: 'Pattern does not match input' }
        }
        return { 
          success: true, 
          groups: match.groups || {},
          matched: match[0],
          allMatches: Array.from(match)
        }
      } else if (type === 'json_path') {
        // Simple JSON path implementation
        try {
          const obj = JSON.parse(testInput)
          // For now, support simple paths like "data.user.name"
          const value = pattern.split('.').reduce((acc, key) => acc?.[key], obj)
          return { success: true, extracted: value }
        } catch (e) {
          return { success: false, error: 'Invalid JSON input' }
        }
      } else if (type === 'grok') {
        // Grok is complex - for MVP, return placeholder
        return { success: false, error: 'Grok parsing not yet implemented. Use regex for now.' }
      }
      return { success: false, error: 'Unknown parser type' }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  }
}
