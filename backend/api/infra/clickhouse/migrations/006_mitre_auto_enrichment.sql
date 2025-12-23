-- MITRE Auto-Enrichment Materialized View
-- Quick Win: Extract + Enrich from raw JSON without code changes
-- Expected: <1% → 30-50% MITRE coverage

-- Drop existing if recreating
DROP VIEW IF EXISTS mv_mitre_auto_enriched;

CREATE MATERIALIZED VIEW mv_mitre_auto_enriched
ENGINE = ReplacingMergeTree(timestamp)
PARTITION BY toYYYYMM(date)
ORDER BY (tenant_id, id)
POPULATE AS
SELECT
  id,
  tenant_id,
  toDate(timestamp) as date,
  timestamp,
  source,
  severity,
  event_type,
  
  -- Extract from raw JSON (SentinelOne format)
  JSONExtractString(raw, 'ThreatName') as threat_name,
  JSONExtractString(raw, 'Classification') as classification,
  JSONExtractString(raw, 'FilePath') as file_path,
  JSONExtractString(raw, 'FileHash') as file_hash,
  JSONExtractString(raw, 'OriginatorProcess') as process,
  
  -- Auto-enrich MITRE Tactic
  multiIf(
    -- Impact (Ransomware, Destructive)
    classification = 'Ransomware', 'Impact',
    toLower(threat_name) LIKE '%ransom%', 'Impact',
    toLower(threat_name) LIKE '%crypt%', 'Impact',
    toLower(threat_name) LIKE '%locker%', 'Impact',
    toLower(file_path) LIKE '%wiper%', 'Impact',
    
    -- Credential Access
    toLower(threat_name) LIKE '%mimikatz%', 'Credential Access',
    toLower(file_path) LIKE '%credump%', 'Credential Access',
    toLower(file_path) LIKE '%lsass%', 'Credential Access',
    toLower(threat_name) LIKE '%stealer%', 'Credential Access',
    
    -- Discovery (Scanners)
    toLower(threat_name) LIKE '%nmap%', 'Discovery',
    toLower(file_path) LIKE '%nmap%', 'Discovery',
    toLower(threat_name) LIKE '%masscan%', 'Discovery',
    toLower(threat_name) LIKE '%portscan%', 'Discovery',
    toLower(threat_name) LIKE '%netdiscover%', 'Discovery',
    
    -- Execution (Scripts, Shells)
    toLower(file_path) LIKE '%powershell%', 'Execution',
    toLower(file_path) LIKE '%.ps1', 'Execution',
    toLower(file_path) LIKE '%cmd.exe%', 'Execution',
    toLower(file_path) LIKE '%bash%', 'Execution',
    toLower(threat_name) LIKE '%script%', 'Execution',
    
    -- Persistence
    toLower(threat_name) LIKE '%backdoor%', 'Persistence',
    toLower(threat_name) LIKE '%rootkit%', 'Persistence',
    toLower(file_path) LIKE '%startup%', 'Persistence',
    toLower(file_path) LIKE '%autorun%', 'Persistence',
    
    -- Defense Evasion
    toLower(threat_name) LIKE '%packer%', 'Defense Evasion',
    toLower(threat_name) LIKE '%obfuscat%', 'Defense Evasion',
    classification = 'PUA', 'Defense Evasion',
    
    -- Command and Control
    toLower(threat_name) LIKE '%beacon%', 'Command and Control',
    toLower(threat_name) LIKE '%c2%', 'Command and Control',
    toLower(threat_name) LIKE '%cobalt%', 'Command and Control',
    
    -- Lateral Movement
    toLower(threat_name) LIKE '%psexec%', 'Lateral Movement',
    toLower(file_path) LIKE '%psexec%', 'Lateral Movement',
    toLower(threat_name) LIKE '%wmi%', 'Lateral Movement',
    
    -- Exfiltration
    toLower(threat_name) LIKE '%exfil%', 'Exfiltration',
    toLower(threat_name) LIKE '%upload%', 'Exfiltration',
    
    -- Default: Execution for generic malware
    classification = 'Malware', 'Execution',
    classification = 'Trojan', 'Execution',
    
    '' -- No match
  ) as mitre_tactic,
  
  -- Auto-enrich MITRE Technique
  multiIf(
    -- T1486: Data Encrypted for Impact (Ransomware)
    classification = 'Ransomware', 'T1486',
    toLower(threat_name) LIKE '%ransom%', 'T1486',
    toLower(threat_name) LIKE '%crypt%', 'T1486',
    
    -- T1003: OS Credential Dumping
    toLower(threat_name) LIKE '%mimikatz%', 'T1003',
    toLower(file_path) LIKE '%lsass%', 'T1003',
    toLower(file_path) LIKE '%credump%', 'T1003',
    
    -- T1555: Credentials from Password Stores
    toLower(threat_name) LIKE '%stealer%', 'T1555',
    toLower(threat_name) LIKE '%browser%', 'T1555',
    
    -- T1046: Network Service Discovery
    toLower(threat_name) LIKE '%nmap%', 'T1046',
    toLower(file_path) LIKE '%nmap%', 'T1046',
    toLower(threat_name) LIKE '%scan%', 'T1046',
    
    -- T1059: Command and Scripting Interpreter
    toLower(file_path) LIKE '%powershell%', 'T1059.001',
    toLower(file_path) LIKE '%.ps1', 'T1059.001',
    toLower(file_path) LIKE '%cmd.exe%', 'T1059.003',
    toLower(file_path) LIKE '%bash%', 'T1059.004',
    
    -- T1547: Boot or Logon Autostart Execution
    toLower(file_path) LIKE '%startup%', 'T1547',
    toLower(file_path) LIKE '%autorun%', 'T1547',
    
    -- T1055: Process Injection
    toLower(threat_name) LIKE '%inject%', 'T1055',
    
    -- T1564: Hide Artifacts
    toLower(threat_name) LIKE '%rootkit%', 'T1564',
    
    -- T1027: Obfuscated Files or Information
    toLower(threat_name) LIKE '%packer%', 'T1027',
    toLower(threat_name) LIKE '%obfuscat%', 'T1027',
    
    -- T1071: Application Layer Protocol (C2)
    toLower(threat_name) LIKE '%beacon%', 'T1071',
    toLower(threat_name) LIKE '%c2%', 'T1071',
    
    -- T1570: Lateral Tool Transfer
    toLower(file_path) LIKE '%psexec%', 'T1570',
    
    -- T1204: User Execution (Default for malware)
    classification = 'Malware', 'T1204',
    classification = 'Trojan', 'T1204',
    
    '' -- No match
  ) as mitre_technique

FROM security_events
WHERE event_type = 'threat' AND raw != '';

-- Verify enrichment results
SELECT 
  'Enrichment Coverage' as metric,
  count() as total_threats,
  countIf(mitre_tactic != '') as enriched,
  round(countIf(mitre_tactic != '') * 100.0 / count(), 2) as coverage_percent
FROM mv_mitre_auto_enriched;

-- Show top MITRE tactics detected
SELECT 
  mitre_tactic,
  mitre_technique,
  count() as detection_count,
  groupArray(5)(threat_name) as sample_threats
FROM mv_mitre_auto_enriched
WHERE mitre_tactic != ''
GROUP BY mitre_tactic, mitre_technique
ORDER BY detection_count DESC
LIMIT 15;
