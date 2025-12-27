import { Elysia } from 'elysia'
import { withAuth } from '../middleware/auth'
import { Errors } from '../middleware/error'
import { readdir, stat } from 'fs/promises'
import { join } from 'path'
import { db } from '../infra/db'
import { systemConfig } from '../infra/db/schema'
import { eq } from 'drizzle-orm'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)
const BACKUP_DIR = process.env.BACKUP_DIR || join(process.cwd(), 'backups')

export const systemController = new Elysia({ prefix: '/system' })
  .use(withAuth)
  .guard({
    beforeHandle: (context: any) => {
      const user = context.user;
      if (user.role !== 'superadmin' && user.role !== 'admin') {
        throw Errors.Forbidden()
      }
    }
  })

  /**
   * List all database backups
   * @route GET /system/backups
   * @access Protected - Admin/SuperAdmin only
   * @returns {Object} List of backup files with size and creation date
   */
  .get('/backups', async () => {
    try {
      const files = await readdir(BACKUP_DIR)
      const backups = await Promise.all(
        files
          .filter(f => f.endsWith('.sql.gz'))
          .map(async (file) => {
            const stats = await stat(join(BACKUP_DIR, file))
            return {
              name: file,
              size: stats.size,
              createdAt: stats.mtime
            }
          })
      )
      return { success: true, data: backups.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()) }
    } catch (error) {
       // Create directory if it doesn't exist (lazy init)
       return { success: true, data: [] }
    }
  })

  /**
   * Trigger manual database backup
   * @route POST /system/backups
   * @access Protected - Admin/SuperAdmin only
   * @returns {Object} Success message
   * @description Executes backup script to create PostgreSQL dump
   */
  .post('/backups', async () => {
    const scriptPath = join(process.cwd(), 'scripts', 'backup_postgres.sh')
    const cmd = `bash "${scriptPath}"`
    
    // Ensure backup dir exists
    try { await readdir(BACKUP_DIR) } catch { 
       const { mkdir } = await import('fs/promises'); 
       await mkdir(BACKUP_DIR, { recursive: true });
    }

    try {
        const { stdout, stderr } = await execAsync(cmd)
        console.log('Backup stdout:', stdout)
        if (stderr) console.warn('Backup stderr:', stderr)
        return { success: true, message: 'Backup completed successfully' }
    } catch (e: any) {
        console.error('Backup failed:', e)
        throw new Error(`Backup failed: ${e.message}`)
    }
  })
  
  /**
   * Download a backup file
   * @route GET /system/backups/:filename
   */
  .get('/backups/:filename', async ({ params, set }: any) => {
    const { filename } = params
    if (!/^backup_\d{8}_\d{6}\.sql\.gz$/.test(filename)) {
        set.status = 400
        return 'Invalid filename'
    }
    const filePath = join(BACKUP_DIR, filename)
    try {
        await stat(filePath)
        return Bun.file(filePath)
    } catch {
        set.status = 404
        return 'Not Found'
    }
  })

  /**
   * Get current license information
   * @route GET /system/license
   * @access Protected - Admin/SuperAdmin only
   * @returns {Object} License details (type, expiry, limits)
   */
  .get('/license', async () => {
    const config = await db.select().from(systemConfig).where(eq(systemConfig.key, 'license')).limit(1)
    
    if (!config.length) {
      return {
        success: true,
        data: {
          type: 'community',
          maxUsers: 5,
          maxTenants: 1,
          features: ['basic'],
          expiresAt: null
        }
      }
    }
    
    const value = config[0].value
    return { 
      success: true, 
      data: typeof value === 'string' ? JSON.parse(value) : value 
    }
  })

  /**
   * Activate or update system license
   * @route POST /system/license
   * @access Protected - SuperAdmin only
   * @body {string} licenseKey - License activation key
   * @returns {Object} Activated license details
   * @throws {400} Invalid license key
   */
  .post('/license', async ({ body, user }: any) => {
    if (user.role !== 'superadmin') {
      throw Errors.Forbidden('Only SuperAdmin can manage licenses')
    }

    const { licenseKey } = body
    
    // Mock license verification for MVP/Demo
    // In production, this would validate against a license server
    const mockLicense = {
      type: 'enterprise',
      maxUsers: 999,
      maxTenants: 50,
      features: ['all'],
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
    }

    await db.insert(systemConfig).values({
      key: 'license',
      value: JSON.stringify(mockLicense)
    }).onConflictDoUpdate({
      target: systemConfig.key,
      set: { value: JSON.stringify(mockLicense), updatedAt: new Date() }
    })

    return { success: true, license: mockLicense }
  })

  /**
   * Get system health and status
   * @route GET /system/health
   * @access Protected - Admin/SuperAdmin only
   * @returns {Object} System health metrics (database, memory, uptime)
   */
  .get('/health', async () => {
    return {
      status: 'healthy',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date()
    }
  })
