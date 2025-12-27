// Set Env Var BEFORE imports so ManagerAgent initializes genAI
process.env.GEMINI_API_KEY = "test-key";

import { describe, expect, it, mock, beforeEach, spyOn } from 'bun:test'
import { ManagerAgent } from './manager-agent'

// Mock Dependencies
const mockGenAI = {
  getGenerativeModel: mock(() => ({
    generateContent: mock(async () => ({
      response: { text: () => "AI Analysis: True Positive based on historical context." }
    }))
  }))
}

mock.module('@google/generative-ai', () => ({
  GoogleGenerativeAI: mock(() => mockGenAI)
}))

// Mock DB
// Mock DB Helper
const createMockQuery = (result: any[]) => {
    const promise = Promise.resolve(result);
    (promise as any).limit = mock(async () => result); // Chainable limit
    return promise;
};

const mockDb = {
  select: mock(() => ({
    from: mock(() => ({
      where: mock(() => createMockQuery([{ id: 'alert-new-1', aiAnalysis: {} }, { caseId: 'case-old-1' }]))
    }))
  })),
  query: {
    cases: {
      findMany: mock(async () => [
        { 
            title: 'Past Ransomware Incident', 
            description: 'Similar IP 1.2.3.4 found scanning.', 
            status: 'resolved', 
            tags: ['ransomware'], 
            createdAt: new Date('2024-01-01') 
        }
      ])
    }
  },
  update: mock(() => ({
    set: mock(() => ({
      where: mock(async () => {})
    }))
  }))
}

const mockDrizzle = {
    // Export standard operators as mocks or pass-throughs
    eq: mock(),
    and: mock(),
    inArray: mock(),
    isNotNull: mock(),
    ne: mock(),
    // DB
    db: mockDb
}

mock.module('../../infra/db/schema', () => ({})) // Schema doesn't need logic, just existence
mock.module('../../infra/db', () => ({ db: mockDb }))
mock.module('drizzle-orm', () => mockDrizzle)

describe('ManagerAgent (RAG)', () => {
  let agent: ManagerAgent;

  beforeEach(() => {
    // Reset mocks if needed
    mockDb.query.cases.findMany.mockClear();
    mockDb.update.mockClear();
    
    // Set Environment for Agent
    process.env.GEMINI_API_KEY = "test-key";
    
    agent = new ManagerAgent();
  })

  it('should retrieve historical context and include it in the report', async () => {
    const alert = {
      id: 'alert-new-1',
      tenantId: 'tenant-1',
      title: 'New SSH Brute Force',
      description: 'Incoming connection from 1.2.3.4',
      observables: [
        { type: 'ip', value: '1.2.3.4' }
      ]
    };

    // Spy on private method (using any cast for test access)
    // Actually we can just check if DB was queried for cases
    
    const report = await agent.orchestrate(alert);

    // Verify RAG: Did we query for past cases?
    expect(mockDb.query.cases.findMany).toHaveBeenCalled();
    
    // Verify Report contains AI output (which implies prompt success)
    expect(report).toContain("True Positive based on historical context");

    // Verify Save Results
    expect(mockDb.update).toHaveBeenCalled();
  })
})
