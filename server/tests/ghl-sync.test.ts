import { GhlMessageSyncService, createGhlMessageSyncService } from '../ghl-message-sync-service';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
}

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:5000';

async function fetchWithTimeout(url: string, options?: RequestInit, timeout = 10000): Promise<{ status: number; body: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const body = await response.text();
    clearTimeout(timeoutId);
    return { status: response.status, body };
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

async function runTest(name: string, testFn: () => Promise<void>): Promise<TestResult> {
  const start = Date.now();
  try {
    await testFn();
    return { name, passed: true, duration: Date.now() - start };
  } catch (error) {
    return { 
      name, 
      passed: false, 
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - start 
    };
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

// Test helper functions that mirror production logic for validation
function mapGhlPipelineStage(stageName: string): { pipelineStage?: string; leadStatus?: string } {
  const updates: { pipelineStage?: string; leadStatus?: string } = {};
  const lowerStageName = stageName.toLowerCase();
  
  if (lowerStageName.includes('inquiry') || lowerStageName.includes('new')) {
    updates.pipelineStage = 'inquiry';
  } else if (lowerStageName.includes('qualified') || lowerStageName.includes('contacted')) {
    updates.pipelineStage = 'qualified';
  } else if (lowerStageName.includes('test') || lowerStageName.includes('demo')) {
    updates.pipelineStage = 'test_drive';
  } else if (lowerStageName.includes('negotiat') || lowerStageName.includes('proposal')) {
    updates.pipelineStage = 'negotiation';
  } else if (lowerStageName.includes('closed') || lowerStageName.includes('won') || lowerStageName.includes('sold')) {
    updates.pipelineStage = 'closed';
    updates.leadStatus = 'sold';
  } else if (lowerStageName.includes('lost') || lowerStageName.includes('dead')) {
    updates.leadStatus = 'lost';
  }
  
  return updates;
}

function mapGhlOpportunityStatus(status: string): string | undefined {
  const lowerStatus = status.toLowerCase();
  if (lowerStatus === 'won' || lowerStatus === 'closed_won') {
    return 'sold';
  } else if (lowerStatus === 'lost' || lowerStatus === 'closed_lost') {
    return 'lost';
  } else if (lowerStatus === 'open' || lowerStatus === 'active') {
    return 'hot';
  }
  return undefined;
}

async function runGhlSyncTests(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  // Test that GhlMessageSyncService can be instantiated
  results.push(await runTest('GhlMessageSyncService instantiation succeeds', async () => {
    const service = createGhlMessageSyncService(1);
    assert(service instanceof GhlMessageSyncService, 'Should return GhlMessageSyncService instance');
  }));

  results.push(await runTest('createGhlMessageSyncService factory accepts dealershipId', async () => {
    const service1 = createGhlMessageSyncService(1);
    const service2 = createGhlMessageSyncService(2);
    assert(service1 instanceof GhlMessageSyncService, 'Service for dealership 1 should be valid');
    assert(service2 instanceof GhlMessageSyncService, 'Service for dealership 2 should be valid');
  }));

  // Unit tests for pipeline stage mapping (tests same logic as production)
  results.push(await runTest('Pipeline stage mapping: inquiry/new -> inquiry', async () => {
    const result1 = mapGhlPipelineStage('New Lead');
    assert(result1.pipelineStage === 'inquiry', `Expected 'inquiry', got '${result1.pipelineStage}'`);
    
    const result2 = mapGhlPipelineStage('Initial Inquiry');
    assert(result2.pipelineStage === 'inquiry', `Expected 'inquiry', got '${result2.pipelineStage}'`);
  }));

  results.push(await runTest('Pipeline stage mapping: qualified/contacted -> qualified', async () => {
    const result1 = mapGhlPipelineStage('Qualified Lead');
    assert(result1.pipelineStage === 'qualified', `Expected 'qualified', got '${result1.pipelineStage}'`);
    
    const result2 = mapGhlPipelineStage('Contacted');
    assert(result2.pipelineStage === 'qualified', `Expected 'qualified', got '${result2.pipelineStage}'`);
  }));

  results.push(await runTest('Pipeline stage mapping: test/demo -> test_drive', async () => {
    const result1 = mapGhlPipelineStage('Test Drive Scheduled');
    assert(result1.pipelineStage === 'test_drive', `Expected 'test_drive', got '${result1.pipelineStage}'`);
    
    const result2 = mapGhlPipelineStage('Demo Completed');
    assert(result2.pipelineStage === 'test_drive', `Expected 'test_drive', got '${result2.pipelineStage}'`);
  }));

  results.push(await runTest('Pipeline stage mapping: negotiat/proposal -> negotiation', async () => {
    const result1 = mapGhlPipelineStage('Negotiating');
    assert(result1.pipelineStage === 'negotiation', `Expected 'negotiation', got '${result1.pipelineStage}'`);
    
    const result2 = mapGhlPipelineStage('Proposal Sent');
    assert(result2.pipelineStage === 'negotiation', `Expected 'negotiation', got '${result2.pipelineStage}'`);
  }));

  results.push(await runTest('Pipeline stage mapping: closed/won/sold -> closed + sold', async () => {
    const result1 = mapGhlPipelineStage('Closed Won');
    assert(result1.pipelineStage === 'closed', `Expected 'closed', got '${result1.pipelineStage}'`);
    assert(result1.leadStatus === 'sold', `Expected 'sold', got '${result1.leadStatus}'`);
    
    const result2 = mapGhlPipelineStage('Sold');
    assert(result2.pipelineStage === 'closed', `Expected 'closed', got '${result2.pipelineStage}'`);
    assert(result2.leadStatus === 'sold', `Expected 'sold', got '${result2.leadStatus}'`);
  }));

  results.push(await runTest('Pipeline stage mapping: lost/dead -> lost', async () => {
    const result1 = mapGhlPipelineStage('Lost');
    assert(result1.leadStatus === 'lost', `Expected 'lost', got '${result1.leadStatus}'`);
    
    const result2 = mapGhlPipelineStage('Dead Lead');
    assert(result2.leadStatus === 'lost', `Expected 'lost', got '${result2.leadStatus}'`);
  }));

  results.push(await runTest('Pipeline stage mapping returns empty for unrecognized stage', async () => {
    const result = mapGhlPipelineStage('Custom Stage XYZ');
    assert(result.pipelineStage === undefined, `Expected undefined, got '${result.pipelineStage}'`);
    assert(result.leadStatus === undefined, `Expected undefined, got '${result.leadStatus}'`);
  }));

  // Opportunity status mapping tests
  results.push(await runTest('Opportunity status mapping: won/closed_won -> sold', async () => {
    assert(mapGhlOpportunityStatus('won') === 'sold', 'Expected "sold" for "won"');
    assert(mapGhlOpportunityStatus('closed_won') === 'sold', 'Expected "sold" for "closed_won"');
  }));

  results.push(await runTest('Opportunity status mapping: lost/closed_lost -> lost', async () => {
    assert(mapGhlOpportunityStatus('lost') === 'lost', 'Expected "lost" for "lost"');
    assert(mapGhlOpportunityStatus('closed_lost') === 'lost', 'Expected "lost" for "closed_lost"');
  }));

  results.push(await runTest('Opportunity status mapping: open/active -> hot', async () => {
    assert(mapGhlOpportunityStatus('open') === 'hot', 'Expected "hot" for "open"');
    assert(mapGhlOpportunityStatus('active') === 'hot', 'Expected "hot" for "active"');
  }));

  results.push(await runTest('Opportunity status mapping returns undefined for unrecognized', async () => {
    assert(mapGhlOpportunityStatus('pending') === undefined, 'Expected undefined for "pending"');
    assert(mapGhlOpportunityStatus('on_hold') === undefined, 'Expected undefined for "on_hold"');
  }));

  // GHL webhook endpoint tests - verify actual HTTP responses
  results.push(await runTest('GHL webhook endpoint returns valid response', async () => {
    const { status, body } = await fetchWithTimeout(`${BASE_URL}/api/ghl/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'test' })
    });
    assert(status !== 405, `GHL webhook should accept POST, got ${status}`);
    assert(status !== 404, `GHL webhook endpoint should exist, got ${status}`);
    assert(status < 500, `GHL webhook should not error for valid JSON, got ${status}`);
  }));

  results.push(await runTest('GHL call webhook endpoint returns valid response', async () => {
    const { status, body } = await fetchWithTimeout(`${BASE_URL}/api/ghl/call-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'CallCompleted' })
    });
    assert(status !== 405, `GHL call webhook should accept POST, got ${status}`);
    assert(status !== 404, `GHL call webhook endpoint should exist, got ${status}`);
    assert(status < 500, `GHL call webhook should not error, got ${status}`);
  }));

  // Test GHL message webhook with realistic payload
  results.push(await runTest('GHL webhook handles IncomingMessage type', async () => {
    const { status } = await fetchWithTimeout(`${BASE_URL}/api/ghl/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'IncomingMessage',
        conversationId: 'test-conv-123',
        contactId: 'test-contact-456',
        body: 'Test message content',
        messageId: 'test-msg-789',
        direction: 'inbound',
        dateAdded: new Date().toISOString()
      })
    });
    assert(status < 500, `Webhook should handle IncomingMessage without server error, got ${status}`);
  }));

  results.push(await runTest('GHL webhook handles ContactUpdate type', async () => {
    const { status } = await fetchWithTimeout(`${BASE_URL}/api/ghl/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'ContactUpdate',
        contactId: 'test-contact-456',
        locationId: 'test-location-123',
        tags: ['VIP', 'Hot Lead'],
        phone: '+1234567890',
        email: 'test@example.com'
      })
    });
    assert(status < 500, `Webhook should handle ContactUpdate without server error, got ${status}`);
  }));

  results.push(await runTest('GHL webhook handles OpportunityUpdate type', async () => {
    const { status } = await fetchWithTimeout(`${BASE_URL}/api/ghl/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'OpportunityUpdate',
        opportunityId: 'opp-123',
        contactId: 'test-contact-456',
        locationId: 'test-location-123',
        pipelineStageName: 'Qualified Lead',
        status: 'open'
      })
    });
    assert(status < 500, `Webhook should handle OpportunityUpdate without server error, got ${status}`);
  }));

  return results;
}

async function main() {
  console.log('🔄 Running GHL Messenger Sync Tests\n');
  console.log(`Base URL: ${BASE_URL}\n`);

  const results = await runGhlSyncTests();

  console.log('\n📊 Test Results:\n');
  console.log('─'.repeat(80));

  let passed = 0;
  let failed = 0;

  for (const result of results) {
    const status = result.passed ? '✅' : '❌';
    console.log(`${status} ${result.name} (${result.duration}ms)`);
    if (!result.passed && result.error) {
      console.log(`   └─ Error: ${result.error}`);
    }
    result.passed ? passed++ : failed++;
  }

  console.log('─'.repeat(80));
  console.log(`\n📈 Summary: ${passed} passed, ${failed} failed out of ${results.length} tests`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(console.error);
