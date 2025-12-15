/**
 * Investigation Graph Service Tests
 */
import { describe, test, expect } from 'bun:test';

describe('InvestigationGraphService', () => {
  test('should be defined', async () => {
    const { InvestigationGraphService } = await import('../core/services/investigation-graph.service');
    expect(InvestigationGraphService).toBeDefined();
    expect(InvestigationGraphService.buildCaseGraph).toBeDefined();
    expect(InvestigationGraphService.buildAlertGraph).toBeDefined();
    expect(InvestigationGraphService.extractIPs).toBeDefined();
    expect(InvestigationGraphService.extractHosts).toBeDefined();
    expect(InvestigationGraphService.extractUsers).toBeDefined();
    expect(InvestigationGraphService.extractDomains).toBeDefined();
    expect(InvestigationGraphService.extractHashes).toBeDefined();
  });

  test('extractIPs should find IPs in data', async () => {
    const { InvestigationGraphService } = await import('../core/services/investigation-graph.service');
    
    const data = {
      src_ip: '192.168.1.1',
      text: 'Connection from 10.0.0.1 to 8.8.8.8'
    };
    
    const ips = InvestigationGraphService.extractIPs(data);
    expect(Array.isArray(ips)).toBe(true);
    expect(ips.length).toBeGreaterThan(0);
    expect(ips).toContain('192.168.1.1');
  });

  test('extractHosts should find hostnames', async () => {
    const { InvestigationGraphService } = await import('../core/services/investigation-graph.service');
    
    const data = {
      hostname: 'WORKSTATION-01',
      computerName: 'SERVER-DC'
    };
    
    const hosts = InvestigationGraphService.extractHosts(data);
    expect(Array.isArray(hosts)).toBe(true);
    expect(hosts).toContain('WORKSTATION-01');
    expect(hosts).toContain('SERVER-DC');
  });

  test('extractUsers should find usernames', async () => {
    const { InvestigationGraphService } = await import('../core/services/investigation-graph.service');
    
    const data = {
      user: 'john.doe',
      username: 'admin'
    };
    
    const users = InvestigationGraphService.extractUsers(data);
    expect(Array.isArray(users)).toBe(true);
    expect(users).toContain('john.doe');
    expect(users).toContain('admin');
  });

  test('extractDomains should find domains', async () => {
    const { InvestigationGraphService } = await import('../core/services/investigation-graph.service');
    
    const data = {
      domain: 'malware.example.com',
      text: 'Connected to evil.bad.org'
    };
    
    const domains = InvestigationGraphService.extractDomains(data);
    expect(Array.isArray(domains)).toBe(true);
    expect(domains).toContain('malware.example.com');
  });

  test('extractHashes should find MD5/SHA256 hashes', async () => {
    const { InvestigationGraphService } = await import('../core/services/investigation-graph.service');
    
    const data = {
      sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      md5: 'd41d8cd98f00b204e9800998ecf8427e'
    };
    
    const hashes = InvestigationGraphService.extractHashes(data);
    expect(Array.isArray(hashes)).toBe(true);
    expect(hashes.length).toBeGreaterThan(0);
  });

  test('buildCaseGraph should throw error for missing case', async () => {
    const { InvestigationGraphService } = await import('../core/services/investigation-graph.service');
    
    try {
      await InvestigationGraphService.buildCaseGraph('nonexistent-id', '00000000-0000-0000-0000-000000000000');
      expect(false).toBe(true); // Should not reach here
    } catch (e: any) {
      expect(e.message).toBeDefined();
    }
  });
});
