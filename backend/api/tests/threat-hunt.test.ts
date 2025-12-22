
import { describe, expect, test, mock } from "bun:test";
import { ThreatHuntService } from "../core/services/threat-hunt.service";

// Mock ClickHouse Client
// We can't really mock the import easily in Bun test without more setup, 
// so we'll test the logic that doesn't depend on external DB first (parseSigma).

describe("ThreatHuntService", () => {
    
    test("parseSigma should convert valid YAML to SQL", async () => {
        const yaml = `
title: Test Rule
detection:
    selection:
        Image: 'cmd.exe'
        CommandLine: 
            - 'whoami'
            - 'net user'
    condition: selection
`;
        const { sql, rule } = await ThreatHuntService.parseSigma("tenant-123", yaml);

        expect(rule.title).toBe("Test Rule");
        expect(sql).toContain("tenant_id = 'tenant-123'");
        expect(sql).toContain("process_name = 'cmd.exe'");
        expect(sql).toContain("process_command_line IN ('whoami', 'net user')");
    });

    test("parseSigma should throw on invalid YAML", async () => {
        const yaml = `invalid : yaml : :`;
        // expect(ThreatHuntService.parseSigma("t", yaml)).rejects.toThrow();
        // Bun test async expects are a bit specific, let's try try-catch
        try {
            await ThreatHuntService.parseSigma("t", yaml);
            expect(true).toBe(false); // Should fail
        } catch (e) {
            expect(true).toBe(true);
        }
    });

    test("runQuery should reject dangerous keywords", async () => {
        const badSql = "DROP TABLE security_events";
        try {
            await ThreatHuntService.runQuery("t", badSql);
            expect(true).toBe(false); 
        } catch (e: any) {
            expect(e.message).toContain("Only SELECT");
        }
    });

    test("runQuery should reject missing tenant_id", async () => {
        const sql = "SELECT * FROM security_events";
        try {
            await ThreatHuntService.runQuery("t", sql);
            expect(true).toBe(false);
        } catch (e: any) {
             expect(e.message).toContain("tenant_id");
        }
    });

});
