/**
 * Forensics Service
 * Memory analysis, artifact extraction, and forensic investigation
 */

export interface ProcessArtifact {
  pid: number;
  name: string;
  path: string;
  cmdline: string;
  parentPid: number;
  suspicious: boolean;
  suspiciousReasons?: string[];
}

export interface NetworkConnection {
  pid: number;
  processName: string;
  localAddr: string;
  remoteAddr: string;
  state: string;
  suspicious: boolean;
  suspiciousReasons?: string[];
}

export interface FileHandle {
  pid: number;
  path: string;
  type: 'file' | 'registry' | 'pipe';
  suspicious: boolean;
}

export interface MemoryArtifacts {
  processes: ProcessArtifact[];
  networkConnections: NetworkConnection[];
  openFiles: FileHandle[];
  loadedModules: Array<{ pid: number; name: string; path: string }>;
  environmentVars: Array<{ name: string; value: string }>;
  commandHistory: Array<{ command: string; timestamp: Date }>;
}

export interface ForensicAnalysis {
  dumpId: string;
  caseId: string;
  analyzedAt: Date;
  artifacts: MemoryArtifacts;
  findings: Array<{
    title: string;
    severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
    description: string;
    evidence: string[];
  }>;
  iocs: Array<{
    type: 'ip' | 'domain' | 'hash' | 'process';
    value: string;
    confidence: number;
  }>;
  summary: {
    totalProcesses: number;
    suspiciousProcesses: number;
    networkConnections: number;
    suspiciousConnections: number;
    criticalFindings: number;
  };
  recommendations: string[];
}

export class ForensicsService {
  /**
   * Capture memory dump (simulated)
   */
  static async captureMemoryDump(
    hostname: string,
    collectedBy: string,
    caseId?: string
  ): Promise<{ dumpId: string; hash: { md5: string; sha256: string } }> {
    // Simulate memory dump capture
    await new Promise(resolve => setTimeout(resolve, 2000));

    const dumpId = `memdump-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Simulate hash calculation
    const hash = {
      md5: this.generateFakeHash(32),
      sha256: this.generateFakeHash(64),
    };

    console.log(`[Forensics] Memory dump captured: ${dumpId}`);

    return { dumpId, hash };
  }

  /**
   * Analyze memory dump and extract artifacts
   */
  static async analyzeMemoryDump(dumpId: string, caseId: string): Promise<ForensicAnalysis> {
    // Simulate analysis delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Generate mock artifacts
    const artifacts = this.generateMockArtifacts();

    // Analyze artifacts for suspicious indicators
    const findings = this.detectSuspiciousActivity(artifacts);

    // Extract IOCs
    const iocs = this.extractIOCs(artifacts);

    // Generate summary
    const summary = {
      totalProcesses: artifacts.processes.length,
      suspiciousProcesses: artifacts.processes.filter(p => p.suspicious).length,
      networkConnections: artifacts.networkConnections.length,
      suspiciousConnections: artifacts.networkConnections.filter(c => c.suspicious).length,
      criticalFindings: findings.filter(f => f.severity === 'critical').length,
    };

    // Generate recommendations
    const recommendations = this.generateRecommendations(findings, summary);

    return {
      dumpId,
      caseId,
      analyzedAt: new Date(),
      artifacts,
      findings,
      iocs,
      summary,
      recommendations,
    };
  }

  /**
   * Generate mock memory artifacts (simulated for demonstration)
   */
  private static generateMockArtifacts(): MemoryArtifacts {
    const processes: ProcessArtifact[] = [
      {
        pid: 4812,
        name: 'powershell.exe',
        path: 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
        cmdline: 'powershell.exe -enc JABjAGwAaQBlAG4AdAAgAD0AIABOAGUAdwAtAE8AYgBqAGUAYwB0',
        parentPid: 2048,
        suspicious: true,
        suspiciousReasons: ['Encoded command detected', 'Network activity to suspicious IP'],
      },
      {
        pid: 1234,
        name: 'chrome.exe',
        path: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        cmdline: 'chrome.exe --type=renderer',
        parentPid: 1200,
        suspicious: false,
      },
      {
        pid: 5678,
        name: 'svchost.exe',
        path: 'C:\\Temp\\svchost.exe',
        cmdline: 'svchost.exe',
        parentPid: 4,
        suspicious: true,
        suspiciousReasons: ['Running from unusual location (should be System32)', 'Name mimics system process'],
      },
      {
        pid: 9012,
        name: 'explorer.exe',
        path: 'C:\\Windows\\explorer.exe',
        cmdline: 'explorer.exe',
        parentPid: 900,
        suspicious: false,
      },
    ];

    const networkConnections: NetworkConnection[] = [
      {
        pid: 4812,
        processName: 'powershell.exe',
        localAddr: '192.168.1.100:54321',
        remoteAddr: '45.33.32.156:443',
        state: 'ESTABLISHED',
        suspicious: true,
        suspiciousReasons: ['Connection to known C2 server', 'HTTPS to non-common port'],
      },
      {
        pid: 1234,
        processName: 'chrome.exe',
        localAddr: '192.168.1.100:54322',
        remoteAddr: '142.250.185.46:443',
        state: 'ESTABLISHED',
        suspicious: false,
      },
      {
        pid: 5678,
        processName: 'svchost.exe',
        localAddr: '192.168.1.100:49152',
        remoteAddr: '185.220.101.25:8080',
        state: 'ESTABLISHED',
        suspicious: true,
        suspiciousReasons: ['Connection to Tor exit node', 'Unusual for svchost.exe'],
      },
    ];

    const openFiles: FileHandle[] = [
      {
        pid: 4812,
        path: 'C:\\Users\\Admin\\AppData\\Local\\Temp\\payload.dll',
        type: 'file',
        suspicious: true,
      },
      {
        pid: 5678,
        path: 'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run',
        type: 'registry',
        suspicious: true,
      },
    ];

    const loadedModules = [
      { pid: 4812, name: 'ws2_32.dll', path: 'C:\\Windows\\System32\\ws2_32.dll' },
      { pid: 5678, name: 'ntdll.dll', path: 'C:\\Windows\\System32\\ntdll.dll' },
    ];

    const environmentVars = [
      { name: 'COMPUTERNAME', value: 'WORKSTATION-01' },
      { name: 'USERNAME', value: 'administrator' },
      { name: 'TEMP', value: 'C:\\Users\\Admin\\AppData\\Local\\Temp' },
    ];

    const commandHistory = [
      { command: 'whoami', timestamp: new Date(Date.now() - 3600000) },
      { command: 'net user admin Password123! /add', timestamp: new Date(Date.now() - 1800000) },
      { command: 'powershell -enc <base64>', timestamp: new Date(Date.now() - 900000) },
    ];

    return {
      processes,
      networkConnections,
      openFiles,
      loadedModules,
      environmentVars,
      commandHistory,
    };
  }

  /**
   * Detect suspicious activity in artifacts
   */
  private static detectSuspiciousActivity(artifacts: MemoryArtifacts): Array<{
    title: string;
    severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
    description: string;
    evidence: string[];
  }> {
    const findings = [];

    // Check for encoded PowerShell commands
    const encodedPSProcesses = artifacts.processes.filter(p => 
      p.name.toLowerCase().includes('powershell') && p.cmdline.includes('-enc')
    );
    if (encodedPSProcesses.length > 0) {
      findings.push({
        title: 'Encoded PowerShell Command Detected',
        severity: 'critical' as const,
        description: 'PowerShell process with base64-encoded command detected. This is commonly used by attackers to evade detection.',
        evidence: encodedPSProcesses.map(p => `PID ${p.pid}: ${p.cmdline}`),
      });
    }

    // Check for processes running from unusual locations
    const unusualLocationProcesses = artifacts.processes.filter(p =>
      p.suspicious && p.suspiciousReasons?.includes('Running from unusual location (should be System32)')
    );
    if (unusualLocationProcesses.length > 0) {
      findings.push({
        title: 'System Process Running from Unusual Location',
        severity: 'high' as const,
        description: 'System process detected running from non-standard location. Possible malware masquerading as legitimate process.',
        evidence: unusualLocationProcesses.map(p => `${p.name} at ${p.path}`),
      });
    }

    // Check for C2 connections
    const c2Connections = artifacts.networkConnections.filter(c =>
      c.suspiciousReasons?.some(r => r.includes('C2') || r.includes('Tor'))
    );
    if (c2Connections.length > 0) {
      findings.push({
        title: 'Command & Control Communication Detected',
        severity: 'critical' as const,
        description: 'Network connections to known malicious infrastructure detected.',
        evidence: c2Connections.map(c => `${c.processName} (PID ${c.pid}) → ${c.remoteAddr}`),
      });
    }

    // Check for persistence mechanisms
    const persistenceFiles = artifacts.openFiles.filter(f =>
      f.type === 'registry' && f.path.includes('Run')
    );
    if (persistenceFiles.length > 0) {
      findings.push({
        title: 'Persistence Mechanism Detected',
        severity: 'high' as const,
        description: 'Registry Run key access detected. Malware may be setting up persistence.',
        evidence: persistenceFiles.map(f => `PID ${f.pid} accessing ${f.path}`),
      });
    }

    return findings;
  }

  /**
   * Extract Indicators of Compromise (IOCs)
   */
  private static extractIOCs(artifacts: MemoryArtifacts): Array<{
    type: 'ip' | 'domain' | 'hash' | 'process';
    value: string;
    confidence: number;
  }> {
    const iocs = [];

    // Extract malicious IPs
    const suspiciousConnections = artifacts.networkConnections.filter(c => c.suspicious);
    for (const conn of suspiciousConnections) {
      const ip = conn.remoteAddr.split(':')[0];
      iocs.push({
        type: 'ip' as const,
        value: ip,
        confidence: 0.9,
      });
    }

    // Extract malicious processes
    const suspiciousProcesses = artifacts.processes.filter(p => p.suspicious);
    for (const proc of suspiciousProcesses) {
      iocs.push({
        type: 'process' as const,
        value: proc.name,
        confidence: 0.85,
      });
    }

    return iocs;
  }

  /**
   * Generate recommendations based on findings
   */
  private static generateRecommendations(
    findings: any[],
    summary: { criticalFindings: number; suspiciousProcesses: number }
  ): string[] {
    const recommendations = [];

    if (summary.criticalFindings > 0) {
      recommendations.push('URGENT: Isolate affected host from network immediately');
      recommendations.push('Initiate incident response procedures');
    }

    if (summary.suspiciousProcesses > 0) {
      recommendations.push('Terminate suspicious processes via EDR');
      recommendations.push('Collect additional forensic artifacts (disk image, network traffic)');
    }

    recommendations.push('Update threat intelligence feeds with extracted IOCs');
    recommendations.push('Review security logs for lateral movement indicators');
    recommendations.push('Conduct comprehensive malware analysis on suspicious files');

    return recommendations;
  }

  /**
   * Generate fake hash for simulation
   */
  private static generateFakeHash(length: number): string {
    const chars = '0123456789abcdef';
    let hash = '';
    for (let i = 0; i < length; i++) {
      hash += chars[Math.floor(Math.random() * chars.length)];
    }
    return hash;
  }
}
