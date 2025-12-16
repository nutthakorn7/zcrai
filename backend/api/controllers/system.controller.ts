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

  // Get Backups
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

  // Trigger Backup
  .post('/backups', async () => {
    const scriptPath = process.env.BACKUP_SCRIPT_PATH || '/app/backup_postgres.sh'
    const cmd = `bash ${process.cwd()}/backup_postgres.sh` 
    
    const { stdout } = await execAsync(cmd)
    console.log('Backup output:', stdout)
    
    return { success: true, message: 'Backup started successfully' }
  })
  
  // Get License
  .get('/license', async () => {
      const result = await db.select().from(systemConfig).where(eq(systemConfig.key, 'license_key'))
      const key = result[0]?.value
      
      let status = 'missing'
      let details = { users: 5, retention: 7, expiresAt: 'never' } // Free tier defaults
      
      if (key) {
        try {
           const { jwtVerify } = await import('jose')
           const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'super_secret_dev_key')
           const { payload } = await jwtVerify(key, secret)
           
           if (payload) {
             status = 'active'
             details = {
                 users: payload.users as number,
                 retention: payload.retention as number,
                 expiresAt: new Date((payload.exp as number) * 1000).toISOString().split('T')[0]
             }
             
             // Check expiry
             if (Date.now() >= (payload.exp as number) * 1000) {
                 status = 'expired'
             }
           } else {
               status = 'invalid'
           }
        } catch (e) {
            status = 'error'
        }
      }
      
      return { 
          success: true, 
          data: { 
              key: key ? '••••••••' + key.slice(-4) : null,
              status,
              ...details
          } 
      }
  })

  .post('/license', async ({ body }: any) => {
      const { key } = body
      
      // Verify Signature
      const { jwtVerify } = await import('jose')
      const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'super_secret_dev_key')
      await jwtVerify(key, secret)
      
      await db.insert(systemConfig).values({
          key: 'license_key',
          value: key,
          description: 'Enterprise License Key'
      }).onConflictDoUpdate({
          target: systemConfig.key,
          set: { value: key, updatedAt: new Date() }
      })
      
      return { success: true, message: 'License updated and verified' }
  })
