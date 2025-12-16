import { Elysia, t } from 'elysia'
import { withAuth } from '../middleware/auth'
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
        return { success: false, message: 'Unauthorized' }
      }
    }
  })

  //Quantity: Get Backups
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
       // Directory might not exist yet
       return { success: true, data: [] }
    }
  })

  // Action: Trigger Backup
  .post('/backups', async () => {
    try {
      // Execute the backup script
      // Assuming the script is in the project root or accessible via PATH
      // For security, hardcoding the script path is better
      const scriptPath = process.env.BACKUP_SCRIPT_PATH || '/app/backup_postgres.sh'
      
      // In dev environment or specific setup, we might need to adjust how we call it
      // For now, let's assume we can run it directly. 
      // Note: In a real container, the backend might be in a different container than the one with docker access.
      // This implementation assumes the backend container has access to run the backup command or script.
      // If running locally on host:
      const cmd = `bash ${process.cwd()}/backup_postgres.sh` 
      
      const { stdout, stderr } = await execAsync(cmd)
      console.log('Backup output:', stdout)
      
      return { success: true, message: 'Backup started successfully' }
    } catch (error: any) {
      console.error('Backup failed:', error)
      return { success: false, message: 'Backup failed', error: error.message }
    }
  })
  
  // Get License
  .get('/license', async () => {
      const result = await db.select().from(systemConfig).where(eq(systemConfig.key, 'license_key'))
      const key = result[0]?.value
      
      // Mock validation logic
      let status = 'active'
      let details = { users: 10, retention: 30, expiresAt: '2025-12-31' }
      
      if (!key) {
          status = 'missing'
          details = { users: 5, retention: 7, expiresAt: 'never' } // Free tier defaults
      }
      
      return { 
          success: true, 
          data: { 
              key: key ? '••••••••' + key.slice(-4) : null, // Masked
              status,
              ...details
          } 
      }
  })

  .post('/license', async ({ body }: any) => {
      const { key } = body
      // TODO: Verify signature here
      
      await db.insert(systemConfig).values({
          key: 'license_key',
          value: key,
          description: 'Enterprise License Key'
      }).onConflictDoUpdate({
          target: systemConfig.key,
          set: { value: key, updatedAt: new Date() }
      })
      
      return { success: true, message: 'License updated' }
  }, {
      body: t.Object({ key: t.String() })
  })
