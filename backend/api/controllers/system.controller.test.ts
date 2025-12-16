import { describe, it, expect, mock, beforeAll, afterAll } from 'bun:test'
import { db } from '../infra/db'
import { systemConfig } from '../infra/db/schema'
import { eq } from 'drizzle-orm'

// Mock native modules (less risky for leakage if specific)
// Mock both import styles to be safe
const fsMock = () => {
    let original: any = {};
    try { original = require('node:fs/promises'); } catch (e) {}
    
    return {
        ...original,
        default: original,
        readFile: mock(async (path: string, options: any) => {
            if (path && (path.toString().includes('backup') || path.toString().includes('restore'))) {
                return 'backup data'
            }
            return original.readFile(path, options)
        }),
        readdir: mock(async (path: string, options: any) => {
            if (path && path.toString().includes('backup')) {
               return ['backup1.sql.gz', 'backup2.sql.gz']
            }
            return original.readdir(path, options)
        }),
        stat: mock(async (path: string, options: any) => {
             if (path && path.toString().includes('backup')) {
                 return { size: 1024, mtime: new Date() }
             }
             return original.stat(path, options)
        }),
        rm: mock(async (path: string) => {
             if (path && path.toString().includes('backup')) return;
             return original.rm(path)
        })
    }
}

mock.module('node:fs/promises', fsMock)
mock.module('fs/promises', fsMock)

import { getAuthHeaders } from '../tests/setup'

mock.module('node:child_process', () => {
    const original = require('node:child_process') 
    return {
        ...original,
        default: original,
        exec: mock((cmd: string, cb: any) => {
            if (cmd.includes('backup_postgres')) {
                 return cb(null, 'backup success', '')
            }
            if (original.exec) return original.exec(cmd, cb)
            // Fallback if original exec is missing in mock context (rare)
            return cb(new Error('Exec not mocked and original missing'))
        })
    }
})

describe('SystemController', () => {
    let headers: any;

    beforeAll(async () => {
        // Seed license
        try {
            await db.insert(systemConfig).values({
                key: 'license',
                value: JSON.stringify({ type: 'enterprise', maxUsers: 100 })
            }).onConflictDoUpdate({
                target: systemConfig.key,
                set: { value: JSON.stringify({ type: 'enterprise', maxUsers: 100 }) }
            })
            
            // Get real auth
            headers = await getAuthHeaders();
        } catch (e) {
            console.error('Failed to setup system test:', e)
        }
    })

    it('GET /backups should list backups', async () => {
        const { systemController } = await import('./system.controller')
        const req = new Request('http://localhost/system/backups', { headers })
        const res = await systemController.handle(req)
        const json: any = await res.json()
        
        expect(res.status).toBe(200)
        expect(json.success).toBe(true)
        // File list comes from mocked fs.readdir
        expect(json.data[0].name).toContain('backup') 
    })
    
    it('POST /backups should trigger backup', async () => {
         const { systemController } = await import('./system.controller')
         const req = new Request('http://localhost/system/backups', { method: 'POST', headers })
         const res = await systemController.handle(req)
         const json: any = await res.json()
         
         expect(res.status).toBe(200)
         expect(json.success).toBe(true)
    })

    it('GET /license should return license info', async () => {
         const { systemController } = await import('./system.controller')
         const req = new Request('http://localhost/system/license', { headers })
         const res = await systemController.handle(req)
         const text = await res.text()
         const json = JSON.parse(text)
         
         expect(res.status).toBe(200)
         expect(json.success).toBe(true)
         expect(json.data.type).toBe('enterprise')
    })
})
