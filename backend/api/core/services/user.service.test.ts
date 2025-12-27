import { describe, expect, it, mock, beforeEach } from 'bun:test'
import { UserService } from './user.service'
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

// Mock DB
const mockDb = {
  select: mock(() => ({
    from: mock(() => ({
      where: mock(() => [
        { id: 'user-123', tenantId: 'tenant-123', name: 'Test User' }
      ]),
    })),
  })),
  update: mock(() => ({
    set: mock(() => ({
      where: mock(() => ({
        returning: mock(() => [{ id: 'user-123' }]),
      })),
    })),
  })),
}

mock.module('../../infra/db', () => ({
  db: mockDb,
}))

describe('UserService', () => {
  beforeEach(() => {
    (redis.get as any).mockClear();
    (redis.setex as any).mockClear();
    (redis.del as any).mockClear();
  })

  describe('getById', () => {
    it('should return cached user if available', async () => {
      const cachedUser = { id: 'user-123', name: 'Cached User' };
      (redis.get as any).mockResolvedValue(JSON.stringify(cachedUser))

      const result = await UserService.getById('user-123')

      expect(result).toEqual(cachedUser)
      expect(redis.get).toHaveBeenCalledWith('user:user-123')
      expect(redis.setex).not.toHaveBeenCalled()
    })

    it('should fetch from DB and cache if not in redis', async () => {
      (redis.get as any).mockResolvedValue(null)
      // Mock DB return handled by global mock above for simplicity in this generated file,
      // but ideally we'd mock implementation per test if we needed different returns.

      const result = await UserService.getById('user-123')

      expect(result.id).toBe('user-123')
      expect(redis.get).toHaveBeenCalledWith('user:user-123')
      expect(redis.setex).toHaveBeenCalledWith('user:user-123', 300, expect.any(String))
    })
  })

  describe('update', () => {
    it('should invalidate cache on update', async () => {
      // Setup getById to return something so update logic proceeds
      (redis.get as any).mockResolvedValue(JSON.stringify({ id: 'user-123', tenantId: 'tenant-123' }))

      await UserService.update('user-123', 'tenant-123', { role: 'admin' })

      expect(redis.del).toHaveBeenCalledWith('user:user-123')
    })
  })

  describe('delete', () => {
    it('should invalidate cache on delete', async () => {
      // Setup getById
       (redis.get as any).mockResolvedValue(JSON.stringify({ id: 'user-123', tenantId: 'tenant-123' }))

      await UserService.delete('user-123', 'tenant-123')

      expect(redis.del).toHaveBeenCalledWith('user:user-123')
    })
  })
})
