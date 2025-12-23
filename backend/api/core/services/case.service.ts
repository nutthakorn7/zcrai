import { db } from '../../infra/db'
import { cases, caseComments, caseAttachments, caseHistory, users } from '../../infra/db/schema'
import { eq, and, desc, sql } from 'drizzle-orm'
import { NotificationService } from './notification.service'
import { ObservableService } from './observable.service'

export const CaseService = {
  // Create Case
  async create(tenantId: string, userId: string, data: {
    title: string;
    description?: string;
    severity?: 'critical'|'high'|'medium'|'low'|'info';
    priority?: string;
    assigneeId?: string;
    tags?: string[];
  }) {
    const [newCase] = await db.insert(cases).values({
      tenantId,
      reporterId: userId,
      title: data.title,
      description: data.description,
      severity: data.severity || 'medium',
      priority: data.priority || 'P3',
      assigneeId: data.assigneeId || null,
      tags: data.tags || [],
      status: 'open'
    }).returning()

    // Log History
    await this.logHistory(newCase.id, userId, 'create', { title: newCase.title })

    // Auto-extract IOCs from description
    if (data.description) {
      await ObservableService.extract(data.description, tenantId, newCase.id);
    }

    return newCase
  },

  // List Cases
  async list(tenantId: string, filters?: { status?: string, assigneeId?: string }) {
    const conditions = [eq(cases.tenantId, tenantId)]
    
    if (filters?.status) {
      conditions.push(eq(cases.status, filters.status))
    }
    if (filters?.assigneeId) {
      conditions.push(eq(cases.assigneeId, filters.assigneeId))
    }

    return await db.select({
      id: cases.id,
      title: cases.title,
      severity: cases.severity,
      status: cases.status,
      priority: cases.priority,
      createdAt: cases.createdAt,
      updatedAt: cases.updatedAt,
      assigneeId: cases.assigneeId, 
      reporterId: cases.reporterId,
      tags: cases.tags,
      assigneeName: users.email
    })
    .from(cases)
    .leftJoin(users, eq(cases.assigneeId, users.id))
    .where(and(...conditions))
    .orderBy(desc(cases.updatedAt))
  },

  // Get Case Detail
  async getById(tenantId: string, id: string) {
    const [foundCase] = await db.select()
      .from(cases)
      .where(and(eq(cases.id, id), eq(cases.tenantId, tenantId)))
    
    if (!foundCase) throw new Error('Case not found')

    // Fetch Relations
    const comments = await db.select({
      id: caseComments.id,
      content: caseComments.content,
      createdAt: caseComments.createdAt,
      userId: caseComments.userId,
      userEmail: users.email
    })
    .from(caseComments)
    .leftJoin(users, eq(caseComments.userId, users.id))
    .where(eq(caseComments.caseId, id))
    .orderBy(desc(caseComments.createdAt))

    const history = await db.select().from(caseHistory).where(eq(caseHistory.caseId, id)).orderBy(desc(caseHistory.createdAt))
    const attachments = await db.select().from(caseAttachments).where(eq(caseAttachments.caseId, id))

    return {
      ...foundCase,
      comments,
      history,
      attachments
    }
  },

  // Update Case
  async update(tenantId: string, caseId: string, userId: string, data: {
    status?: string;
    priority?: string;
    assigneeId?: string;
    description?: string;
    title?: string;
  }) {
    const currentCase = await this.getById(tenantId, caseId)

    const [updated] = await db.update(cases)
      .set({
        ...data,
        updatedAt: new Date(),
        acknowledgedAt: (data.assigneeId || (data.status && data.status !== 'open')) && !currentCase.acknowledgedAt 
            ? new Date() 
            : currentCase.acknowledgedAt,
        resolvedAt: data.status === 'resolved' || data.status === 'closed' ? new Date() : currentCase.resolvedAt
      })
      .where(and(eq(cases.id, caseId), eq(cases.tenantId, tenantId)))
      .returning()

    // Log Changes
    if (data.status && data.status !== currentCase.status) {
      await this.logHistory(caseId, userId, 'status_change', { from: currentCase.status, to: data.status })
      
      // Notify reporter about status change
      if (currentCase.reporterId) {
        await NotificationService.create({
          tenantId,
          userId: currentCase.reporterId,
          type: 'case_status_changed',
          title: `Case status changed: ${currentCase.title}`,
          message: `Status changed from ${currentCase.status} to ${data.status}`,
          metadata: { caseId, oldStatus: currentCase.status, newStatus: data.status }
        })
      }
    }
    if (data.assigneeId && data.assigneeId !== currentCase.assigneeId) {
      await this.logHistory(caseId, userId, 'assign', { assigneeId: data.assigneeId })
      
      // Notify new assignee
      await NotificationService.create({
        tenantId,
        userId: data.assigneeId,
        type: 'case_assigned',
        title: `New case assigned: ${currentCase.title}`,
        message: `You have been assigned to investigate this ${currentCase.severity} severity case.`,
        metadata: { caseId, severity: currentCase.severity }
      })
    }

    return updated
  },

  // Add Comment
  async addComment(tenantId: string, caseId: string, userId: string, content: string) {
    // Verify access
    await this.getById(tenantId, caseId)

    const [comment] = await db.insert(caseComments).values({
      caseId,
      userId,
      content
    }).returning()

    // Update case timestamp
    await db.update(cases).set({ updatedAt: new Date() }).where(eq(cases.id, caseId))

    // Notify case participants (assignee, reporter) about new comment
    const caseData = await this.getById(tenantId, caseId)
    const notifyUsers = [caseData.assigneeId, caseData.reporterId].filter(id => id && id !== userId)
    
    for (const notifyUserId of notifyUsers) {
      await NotificationService.create({
        tenantId,
        userId: notifyUserId!,
        type: 'case_commented',
        title: `New comment on: ${caseData.title}`,
        message: content.substring(0, 100) + (content.length > 100 ? '...' : ''),
        metadata: { caseId }
      })
    }

    return comment
  },

  // Add Attachment
  async addAttachment(tenantId: string, caseId: string, userId: string, file: File) {
    // Verify access
    await this.getById(tenantId, caseId)

    // Save file to disk
    const uploadDir = `/var/uploads/cases/${caseId}`
    await Bun.write(`${uploadDir}/${file.name}`, file)

    // Save metadata to DB
    const [attachment] = await db.insert(caseAttachments).values({
      caseId,
      userId,
      fileName: file.name,
      fileType: file.type,
      fileUrl: `/uploads/cases/${caseId}/${file.name}`,
      fileSize: file.size.toString()
    }).returning()

    // Update case timestamp
    await db.update(cases).set({ updatedAt: new Date() }).where(eq(cases.id, caseId))

    return attachment
  },

  // Internal: Log History
  async logHistory(caseId: string, userId: string, action: string, details: any) {
    await db.insert(caseHistory).values({
      caseId,
      userId,
      action,
      details
    })
  },

  // Sync to Ticketing System (Jira/ServiceNow)
  async syncToTicketing(tenantId: string, caseId: string, userId: string, system: 'jira' | 'servicenow', config: any) {
      const caseData = await this.getById(tenantId, caseId);
      const { TicketingService } = await import('./ticketing.service');
      
      let result;
      if (system === 'jira') {
          result = await TicketingService.createJiraTicket(tenantId, caseData, config);
      } else {
          result = await TicketingService.createServiceNowTicket(tenantId, caseData, config);
      }

      // Log success
      await this.logHistory(caseId, userId, 'ticket_created', { 
          system, 
          ticketId: result.ticketId, 
          ticketUrl: result.ticketUrl 
      });

      return result;
  }
}
