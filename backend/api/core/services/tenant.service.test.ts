import { describe, expect, it, mock, beforeEach } from 'bun:test'
import { TenantService } from './tenant.service'
import { redis } from '../../infra/cache/redis'
import { db } from '../../infra/db'

// Mock Redis
mock.module('../../infra/cache/redis', () => ({
  redis: {
    get: mock(),
    setex: mock(),
    del: mock(),
  },
}))

// Mock DB (Simplified for Tenant)
const mockDb = {
  select: mock(() => ({
    from: mock(() => ({
      where: mock(() => [
        { id: 'tenant-123', name: 'Test Tenant' }
      ]),
    })),
  })),
  update: mock(() => ({
    set: mock(() => ({
      where: mock(() => ({
        returning: mock(() => [{ id: 'tenant-123' }]),
      })),
    })),
  })),
}

mock.module('../../infra/db', () => ({
  db: mockDb,
}))

describe('TenantService', () => {
  beforeEach(() => {
    (redis.get as any).mockClear();
    (redis.setex as any).mockClear();
    (redis.del as any).mockClear();
  })

  describe('getById', () => {
    it('should return cached tenant if available', async () => {
      const cachedTenant = { id: 'tenant-123', name: 'Cached Tenant' };
      (redis.get as any).mockResolvedValue(JSON.stringify(cachedTenant))

      const result = await TenantService.getById('tenant-123')

      expect(result).toEqual(cachedTenant)
      expect(redis.get).toHaveBeenCalledWith('tenant:tenant-123')
      expect(redis.setex).not.toHaveBeenCalled()
    })

    it('should fetch from DB and cache if not in redis', async () => {
      (redis.get as any).mockResolvedValue(null)

      const result = await TenantService.getById('tenant-123')

      expect(result.id).toBe('tenant-123')
      expect(redis.get).toHaveBeenCalledWith('tenant:tenant-123')
      expect(redis.setex).toHaveBeenCalledWith('tenant:tenant-123', 600, expect.any(String))
    })
  })

  describe('update', () => {
    it('should invalidate cache on update', async () => {
       (redis.get as any).mockResolvedValue(JSON.stringify({ id: 'tenant-123', name: 'Test Tenant' }))
      
      await TenantService.update('tenant-123', { status: 'suspended' })

      expect(redis.del).toHaveBeenCalledWith('tenant:tenant-123')
    })
  })

  describe('delete', () => {
    it('should invalidate cache on delete', async () => {
      (redis.get as any).mockResolvedValue(JSON.stringify({ id: 'tenant-123' }))

      await TenantService.delete('tenant-123')

      expect(redis.del).toHaveBeenCalledWith('tenant:tenant-123')
    })
  })
})
