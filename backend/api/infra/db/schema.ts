import { relations, sql } from 'drizzle-orm'
import { pgTable, uuid, text, varchar, timestamp, boolean, jsonb, integer, index } from 'drizzle-orm/pg-core'

// Tenants
export const tenants = pgTable('tenants', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  status: text('status').default('active').notNull(),
  apiUsage: integer('api_usage').default(0).notNull(),
  apiLimit: integer('api_limit').default(10000).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Users
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').references(() => tenants.id), // Optional for superadmin
  email: text('email').notNull().unique(),
  name: text('name'),
  jobTitle: text('job_title'),
  bio: text('bio'),
  phoneNumber: text('phone_number'),
  passwordHash: text('password_hash').notNull(),
  role: text('role').default('customer').notNull(), // 'superadmin' | 'admin' | 'analyst' | 'customer'
  mfaEnabled: boolean('mfa_enabled').default(false).notNull(),
  mfaSecret: text('mfa_secret'),
  marketingOptIn: boolean('marketing_opt_in').default(false).notNull(),
  emailAlertsEnabled: boolean('email_alerts_enabled').default(true).notNull(),
  status: text('status').default('active').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const usersRelations = relations(users, ({ one }) => ({
  tenant: one(tenants, {
    fields: [users.tenantId],
    references: [tenants.id],
  }),
}))

// Sessions
export const sessions = pgTable('sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  userAgent: text('user_agent'),
  ipAddress: text('ip_address'),
  isValid: boolean('is_valid').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// API Keys
export const apiKeys = pgTable('api_keys', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').references(() => tenants.id).notNull(),
  provider: text('provider').notNull(),
  encryptedKey: text('encrypted_key').notNull(),
  keyId: text('key_id'),
  label: text('label'),
  lastUsedAt: timestamp('last_used_at'),
  lastSyncStatus: text('last_sync_status'), // 'success' | 'error' | null
  lastSyncError: text('last_sync_error'),   // Error message ถ้า sync fail
  lastSyncAt: timestamp('last_sync_at'),    // เวลาที่ sync ล่าสุด
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// Audit Logs
export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').references(() => tenants.id),
  userId: uuid('user_id').references(() => users.id),
  action: text('action').notNull(),
  resource: text('resource'),
  details: jsonb('details'),
  ipAddress: text('ip_address'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// Collector States - เก็บ state ของ Collector (checkpoint, full sync status)
export const collectorStates = pgTable('collector_states', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').references(() => tenants.id).notNull(),
  provider: text('provider').notNull(), // 'sentinelone', 'crowdstrike'
  urlHash: text('url_hash').notNull(),  // MD5 hash ของ base URL
  checkpoint: timestamp('checkpoint'),   // timestamp ล่าสุดที่ sync
  fullSyncAt: timestamp('full_sync_at'), // เวลาที่ทำ full sync ครั้งล่าสุด
  fullSyncComplete: boolean('full_sync_complete').default(false).notNull(),
  eventCount: jsonb('event_count'),      // { threats: 1000, activities: 500 }
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// ==================== CASE MANAGEMENT ====================

// Cases
export const cases = pgTable('cases', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').references(() => tenants.id).notNull(),
  title: text('title').notNull(),
  description: text('description'),
  severity: text('severity').default('medium').notNull(), // 'critical', 'high', 'medium', 'low', 'info'
  status: text('status').default('open').notNull(), // 'open', 'investigating', 'resolved', 'closed'
  priority: text('priority').default('P3'), // 'P1', 'P2', 'P3', 'P4'
  assigneeId: uuid('assignee_id').references(() => users.id), // Nullable = Unassigned
  reporterId: uuid('reporter_id').references(() => users.id), // Who created the case
  tags: jsonb('tags'), // ['ransomware', 'phishing']
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  resolvedAt: timestamp('resolved_at'),
})

// Case Comments
export const caseComments = pgTable('case_comments', {
  id: uuid('id').defaultRandom().primaryKey(),
  caseId: uuid('case_id').references(() => cases.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(), // For edits
})

// Case Attachments (Evidence)
export const caseAttachments = pgTable('case_attachments', {
  id: uuid('id').defaultRandom().primaryKey(),
  caseId: uuid('case_id').references(() => cases.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  fileName: text('file_name').notNull(),
  fileType: text('file_type').notNull(), // 'image/png', 'application/pdf', 'log/json'
  fileUrl: text('file_url').notNull(), // Path to storage
  fileSize: text('file_size'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// Case History (Audit Trail)
export const caseHistory = pgTable('case_history', {
  id: uuid('id').defaultRandom().primaryKey(),
  caseId: uuid('case_id').references(() => cases.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id), // Nullable if system action
  action: text('action').notNull(), // 'create', 'status_change', 'assign', 'comment'
  details: jsonb('details'), // { old_status: 'open', new_status: 'investigating' }
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// Relations
export const casesRelations = relations(cases, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [cases.tenantId],
    references: [tenants.id],
  }),
  assignee: one(users, {
    fields: [cases.assigneeId],
    references: [users.id],
    relationName: 'assignee',
  }),
  reporter: one(users, {
    fields: [cases.reporterId],
    references: [users.id],
    relationName: 'reporter',
  }),
  comments: many(caseComments),
  attachments: many(caseAttachments),
  history: many(caseHistory),
}))

// ==================== NOTIFICATIONS ====================
export const notifications = pgTable('notifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').references(() => tenants.id).notNull(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  type: text('type').notNull(), // 'case_assigned', 'case_commented', 'case_status_changed', 'threat_critical', 'system_alert'
  title: text('title').notNull(),
  message: text('message').notNull(),
  metadata: jsonb('metadata'), // { caseId, severity, etc. }
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const notificationsRelations = relations(notifications, ({ one }) => ({
  tenant: one(tenants, {
    fields: [notifications.tenantId],
    references: [tenants.id],
  }),
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}))

export const notificationRules = pgTable('notification_rules', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  channel: text('channel').notNull(), // 'email', 'in-app', 'slack'
  eventType: text('event_type').notNull(), // 'case_assigned', 'case_commented', etc.
  minSeverity: text('min_severity'), // 'critical', 'high', 'medium', 'low' - only notify if >= this
  enabled: boolean('enabled').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const notificationRulesRelations = relations(notificationRules, ({ one }) => ({
  user: one(users, {
    fields: [notificationRules.userId],
    references: [users.id],
  }),
}))

// Notification Channels (Slack, Teams, Webhooks)
export const notificationChannels = pgTable('notification_channels', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').references(() => tenants.id).notNull(),
  name: text('name').notNull(), // "SOC Team Slack", "Incident Response Teams"
  type: text('type').notNull(), // 'slack', 'teams', 'webhook'
  webhookUrl: text('webhook_url').notNull(), // Webhook URL
  enabled: boolean('enabled').default(true).notNull(),
  
  // Filters
  minSeverity: text('min_severity'), // Only send if >= threshold
  eventTypes: jsonb('event_types'), // ['alert', 'case_assigned', 'case_status_changed']
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => {
  return {
    tenantIdx: index('notification_channels_tenant_idx').on(table.tenantId),
    enabledIdx: index('notification_channels_enabled_idx').on(table.enabled),
  }
})

export const notificationChannelsRelations = relations(notificationChannels, ({ one }) => ({
  tenant: one(tenants, {
    fields: [notificationChannels.tenantId],
    references: [tenants.id],
  }),
}))

// Alerts
export const alerts = pgTable('alerts', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').references(() => tenants.id).notNull(),
  source: text('source').notNull(), // 'sentinelone', 'crowdstrike', 'manual'
  severity: text('severity').default('medium').notNull(), // 'critical', 'high', 'medium', 'low', 'info'
  title: text('title').notNull(),
  description: text('description'),
  status: text('status').default('new').notNull(), // 'new', 'investigating', 'resolved', 'dismissed'
  caseId: uuid('case_id').references(() => cases.id), // Link to case if escalated
  rawData: jsonb('raw_data'), // Original event from source
  
  // Deduplication fields
  fingerprint: varchar('fingerprint', { length: 64 }).notNull(), // SHA256 hash for deduplication
  duplicateCount: integer('duplicate_count').default(1).notNull(), // Number of occurrences
  firstSeenAt: timestamp('first_seen_at').defaultNow().notNull(), // Original alert time
  lastSeenAt: timestamp('last_seen_at').defaultNow().notNull(), // Most recent occurrence
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => {
  return {
    tenantIdx: index('alerts_tenant_idx').on(table.tenantId),
    statusIdx: index('alerts_status_idx').on(table.status),
    severityIdx: index('alerts_severity_idx').on(table.severity),
    fingerprintIdx: index('alerts_fingerprint_idx').on(table.fingerprint),
    lastSeenIdx: index('alerts_last_seen_idx').on(table.lastSeenAt),
  }
})

export const alertsRelations = relations(alerts, ({ one }) => ({
  tenant: one(tenants, {
    fields: [alerts.tenantId],
    references: [tenants.id],
  }),
  case: one(cases, {
    fields: [alerts.caseId],
    references: [cases.id],
  }),
}))

// Alert Correlations
export const alertCorrelations = pgTable('alert_correlations', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').references(() => tenants.id).notNull(),
  primaryAlertId: uuid('primary_alert_id').references(() => alerts.id).notNull(),
  relatedAlertIds: jsonb('related_alert_ids').notNull(), // Array of alert IDs
  reason: text('reason').notNull(), // 'same_ioc', 'time_window', 'source_host'
  confidence: text('confidence').notNull(), // Store as text to avoid float import
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const alertCorrelationsRelations = relations(alertCorrelations, ({ one }) => ({
  tenant: one(tenants, {
    fields: [alertCorrelations.tenantId],
    references: [tenants.id],
  }),
  primaryAlert: one(alerts, {
    fields: [alertCorrelations.primaryAlertId],
    references: [alerts.id],
  }),
}))

// Observables (IOCs)
export const observables = pgTable('observables', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').references(() => tenants.id).notNull(),
  caseId: uuid('case_id').references(() => cases.id),
  alertId: uuid('alert_id').references(() => alerts.id),
  type: text('type').notNull(), // 'ip', 'domain', 'hash', 'email', 'url', 'file'
  value: text('value').notNull(),
  isMalicious: boolean('is_malicious'), // null = unknown
  tlpLevel: text('tlp_level').default('amber').notNull(), // 'white', 'green', 'amber', 'red'
  tags: jsonb('tags'), // Array of tags
  firstSeen: timestamp('first_seen').defaultNow().notNull(),
  lastSeen: timestamp('last_seen').defaultNow().notNull(),
  sightingCount: text('sighting_count').default('1').notNull(), // Store as text to avoid int type
  enrichmentData: jsonb('enrichment_data'),
  enrichedAt: timestamp('enriched_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const observablesRelations = relations(observables, ({ one }) => ({
  tenant: one(tenants, {
    fields: [observables.tenantId],
    references: [tenants.id],
  }),
  case: one(cases, {
    fields: [observables.caseId],
    references: [cases.id],
  }),
  alert: one(alerts, {
    fields: [observables.alertId],
    references: [alerts.id],
  }),
}))

// Enrichment Queue
export const enrichmentQueue = pgTable('enrichment_queue', {
  id: uuid('id').defaultRandom().primaryKey(),
  observableId: uuid('observable_id').references(() => observables.id).notNull(),
  provider: text('provider').notNull(), // 'virustotal', 'abuseipdb', 'alienvault'
  status: text('status').default('pending').notNull(), // 'pending', 'processing', 'completed', 'failed'
  retryCount: text('retry_count').default('0').notNull(),
  result: jsonb('result'),
  error: text('error'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  processedAt: timestamp('processed_at'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// ==================== PLAYBOOKS (SOPs) ====================
export const playbooks = pgTable('playbooks', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').references(() => tenants.id).notNull(),
  title: text('title').notNull(),
  description: text('description'),
  isActive: boolean('is_active').default(true).notNull(),
  triggerType: text('trigger_type').default('manual').notNull(), // 'manual', 'auto_case_created'
  targetTag: text('target_tag'), // e.g., 'phishing' (condition for auto-trigger)
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const playbookSteps = pgTable('playbook_steps', {
  id: uuid('id').defaultRandom().primaryKey(),
  playbookId: uuid('playbook_id').references(() => playbooks.id, { onDelete: 'cascade' }).notNull(),
  order: integer('order').notNull(),
  // Wait, I used integer in the plan. Let's stick to integer if possible, but schema.ts has `drizzle-orm/pg-core`.
  // Checking imports... `integer` is NOT imported in line 1. I need to add it or use text.
  // Existing schema uses text for 'retry_count' and 'sighting_count'. I will use text for order to be safe/consistent with this project's quirks, or add integer import.
  // Let's check line 1 imports: `pgTable, uuid, text, timestamp, boolean, jsonb`.
  // I will add `integer` to imports or just use text and parse it.
  // Actually, better to add `integer` import.
  type: text('type').notNull(), // 'manual', 'automation'
  name: text('name').notNull(),
  description: text('description'),
  actionId: text('action_id'), // 'block_ip', 'enrich_ip'
  config: jsonb('config'), // Action parameters
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const playbookExecutions = pgTable('playbook_executions', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').references(() => tenants.id).notNull(),
  playbookId: uuid('playbook_id').references(() => playbooks.id).notNull(),
  caseId: uuid('case_id').references(() => cases.id, { onDelete: 'cascade' }).notNull(),
  status: text('status').default('running').notNull(), // 'running', 'completed', 'failed', 'cancelled'
  startedBy: uuid('started_by').references(() => users.id),
  startedAt: timestamp('started_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
})

export const playbookExecutionSteps = pgTable('playbook_execution_steps', {
  id: uuid('id').defaultRandom().primaryKey(),
  executionId: uuid('execution_id').references(() => playbookExecutions.id, { onDelete: 'cascade' }).notNull(),
  stepId: uuid('step_id').references(() => playbookSteps.id).notNull(),
  status: text('status').default('pending').notNull(), // 'pending', 'in_progress', 'completed', 'failed', 'skipped'
  result: jsonb('result'), // Output of automation
  completedAt: timestamp('completed_at'),
})

export const playbooksRelations = relations(playbooks, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [playbooks.tenantId],
    references: [tenants.id],
  }),
  steps: many(playbookSteps),
  executions: many(playbookExecutions),
}))

export const playbookStepsRelations = relations(playbookSteps, ({ one }) => ({
  playbook: one(playbooks, {
    fields: [playbookSteps.playbookId],
    references: [playbooks.id],
  }),
}))

export const playbookExecutionsRelations = relations(playbookExecutions, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [playbookExecutions.tenantId],
    references: [tenants.id],
  }),
  playbook: one(playbooks, {
    fields: [playbookExecutions.playbookId],
    references: [playbooks.id],
  }),
  case: one(cases, {
    fields: [playbookExecutions.caseId],
    references: [cases.id],
  }),
  user: one(users, {
    fields: [playbookExecutions.startedBy],
    references: [users.id],
  }),
  steps: many(playbookExecutionSteps),
}))

export const playbookExecutionStepsRelations = relations(playbookExecutionSteps, ({ one }) => ({
  execution: one(playbookExecutions, {
    fields: [playbookExecutionSteps.executionId],
    references: [playbookExecutions.id],
  }),
  step: one(playbookSteps, {
    fields: [playbookExecutionSteps.stepId],
    references: [playbookSteps.id],
  }),
}))

export const enrichmentQueueRelations = relations(enrichmentQueue, ({ one }) => ({
  observable: one(observables, {
    fields: [enrichmentQueue.observableId],
    references: [observables.id],
  }),
}))

// ==================== SYSTEM CONFIGURATION ====================
export const systemConfig = pgTable('system_config', {
  key: text('key').primaryKey(), // e.g. 'retention_audit_logs_days'
  value: text('value').notNull(),
  description: text('description'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})
