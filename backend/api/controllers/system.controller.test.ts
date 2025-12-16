import { describe, it, expect, mock, beforeEach } from 'bun:test'

// Mock dependencies BEFORE importing controller
mock.module('fs/promises', () => ({
    readdir: mock(async () => ['backup1.sql.gz', 'backup2.sql.gz', 'other.txt']),
    stat: mock(async (path: string) => {
        if (path.includes('backup1')) return { size: 1000, mtime: new Date('2023-01-01') }
        if (path.includes('backup2')) return { size: 2000, mtime: new Date('2023-01-02') }
        return { size: 0, mtime: new Date() }
    })
}))

mock.module('child_process', () => ({
    exec: mock((cmd, cb) => {
        cb(null, { stdout: 'backup success', stderr: '' })
    })
}))

mock.module('util', () => ({
    promisify: (fn: any) => async (...args: any[]) => {
        return { stdout: 'backup success', stderr: '' }
    }
}))

mock.module('../infra/db', () => ({
    db: {
        select: mock(() => ({
            from: mock(() => ({
                where: mock(() => [{ value: 'mock_license_key' }])
            }))
        })),
        insert: mock(() => ({
            values: mock(() => ({
                 onConflictDoUpdate: mock(() => Promise.resolve())
            }))
        }))
    }
}))

// Mock Auth Middleware to bypass checks
mock.module('../middleware/auth', () => ({
    withAuth: (app: any) => {
        return app.derive(() => ({
            user: { role: 'superadmin', id: 'admin1', tenantId: 't1' }
        }))
    }
}))

describe('SystemController', () => {
    it('GET /backups should list backups', async () => {
        const { systemController } = await import('./system.controller')
        const req = new Request('http://localhost/system/backups')
        const res = await systemController.handle(req)
        const json: any = await res.json()
        
        expect(res.status).toBe(200)
        expect(json.success).toBe(true)
        expect(json.data).toHaveLength(2)
        expect(json.data[0].name).toBe('backup2.sql.gz') 
    })
    
    it('POST /backups should trigger backup', async () => {
         const { systemController } = await import('./system.controller')
         const req = new Request('http://localhost/system/backups', { method: 'POST' })
         const res = await systemController.handle(req)
         const json: any = await res.json()
         
         expect(res.status).toBe(200)
         expect(json.success).toBe(true)
    })

    it('GET /license should return license info', async () => {
         const { systemController } = await import('./system.controller')
         const req = new Request('http://localhost/system/license')
         const res = await systemController.handle(req)
         const json: any = await res.json()
         
         expect(res.status).toBe(200)
         expect(json.success).toBe(true)
    })
})


