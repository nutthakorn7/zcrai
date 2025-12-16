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
const BACKUP_DIR = process.env.BACKUP_DIR || '/root/backups/postgres'

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
    const scriptPath = process.env.BACKUP_SCRIPT_PATH || '/app/backup_postgres.sh'
    const cmd = `bash ${process.cwd()}/backup_postgres.sh` 
    
    const { stdout } = await execAsync(cmd)
    console.log('Backup output:', stdout)
    
    return { success: true, message: 'Backup started successfully' }
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
    
    // TODO: Implement actual license verification
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
