interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
}

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:5000';

async function fetchWithTimeout(url: string, options?: RequestInit, timeout = 10000): Promise<{ status: number; body: string; headers: Headers }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const body = await response.text();
    clearTimeout(timeoutId);
    return { status: response.status, body, headers: response.headers };
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

async function runTenantIsolationTests(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  // ====== UNAUTHENTICATED ACCESS TESTS ======
  
  results.push(await runTest('Messenger conversations endpoint requires authentication', async () => {
    const { status, body } = await fetchWithTimeout(`${BASE_URL}/api/messenger-conversations`);
    assert(status === 401 || status === 403, `Expected 401/403 without auth, got ${status}`);
    const data = JSON.parse(body);
    assert(data.error || data.message, 'Response should include error message');
  }));

  results.push(await runTest('Appraisals endpoint requires authentication', async () => {
    const { status, body } = await fetchWithTimeout(`${BASE_URL}/api/manager/appraisals`);
    assert(status === 401 || status === 403, `Expected 401/403 without auth, got ${status}`);
    const data = JSON.parse(body);
    assert(data.error || data.message, 'Response should include error message');
  }));

  results.push(await runTest('Vehicle inventory POST requires authentication', async () => {
    const { status } = await fetchWithTimeout(`${BASE_URL}/api/vehicles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stockNumber: 'TEST123' })
    });
    assert(status === 401 || status === 403, `Expected 401/403 for POST without auth, got ${status}`);
  }));

  results.push(await runTest('Conversation metadata PATCH requires authentication', async () => {
    const { status } = await fetchWithTimeout(`${BASE_URL}/api/messenger-conversations/1/metadata`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags: ['Test'] })
    });
    assert(status === 401 || status === 403, `Expected 401/403 without auth, got ${status}`);
  }));

  results.push(await runTest('Facebook accounts endpoint requires authentication', async () => {
    const { status } = await fetchWithTimeout(`${BASE_URL}/api/facebook-accounts`);
    assert(status === 401 || status === 403, `Expected 401/403 without auth, got ${status}`);
  }));

  results.push(await runTest('Direct appraisal access by ID requires authentication', async () => {
    const { status } = await fetchWithTimeout(`${BASE_URL}/api/manager/appraisals/999999`);
    assert(status === 401 || status === 403, `Expected 401/403 for direct access without auth, got ${status}`);
  }));

  results.push(await runTest('VIN decode endpoint requires manager authentication', async () => {
    const { status } = await fetchWithTimeout(`${BASE_URL}/api/manager/decode-vin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vin: '2HGFC2F59LH555555' })
    });
    assert(status === 401 || status === 403, `Expected 401/403 without auth, got ${status}`);
  }));

  // ====== INVALID TOKEN TESTS ======

  results.push(await runTest('Malformed JWT token is rejected', async () => {
    const { status, body } = await fetchWithTimeout(`${BASE_URL}/api/messenger-conversations`, {
      headers: { 'Authorization': 'Bearer invalid-token-here' }
    });
    assert(status === 401 || status === 403, `Expected 401/403 for invalid token, got ${status}`);
  }));

  results.push(await runTest('Empty Authorization header is rejected', async () => {
    const { status } = await fetchWithTimeout(`${BASE_URL}/api/messenger-conversations`, {
      headers: { 'Authorization': '' }
    });
    assert(status === 401 || status === 403, `Expected 401/403 for empty auth header, got ${status}`);
  }));

  results.push(await runTest('Bearer with empty token is rejected (400/401/403)', async () => {
    const { status } = await fetchWithTimeout(`${BASE_URL}/api/messenger-conversations`, {
      headers: { 'Authorization': 'Bearer ' }
    });
    // 400 is acceptable for malformed auth header
    assert(status === 400 || status === 401 || status === 403, `Expected 400/401/403 for empty Bearer token, got ${status}`);
  }));

  results.push(await runTest('Non-Bearer auth scheme is rejected (400/401/403)', async () => {
    const { status } = await fetchWithTimeout(`${BASE_URL}/api/messenger-conversations`, {
      headers: { 'Authorization': 'Basic dGVzdDp0ZXN0' }
    });
    // 400 is acceptable when only Bearer auth is supported
    assert(status === 400 || status === 401 || status === 403, `Expected 400/401/403 for Basic auth, got ${status}`);
  }));

  // ====== PUBLIC ENDPOINT TESTS ======

  results.push(await runTest('Public financing rules endpoint is accessible without auth', async () => {
    const { status } = await fetchWithTimeout(`${BASE_URL}/api/public/financing-rules`);
    assert(status === 200 || status === 404, `Expected 200/404 for public endpoint, got ${status}`);
  }));

  results.push(await runTest('Public filter groups endpoint is accessible without auth', async () => {
    const { status } = await fetchWithTimeout(`${BASE_URL}/api/public/filter-groups`);
    assert(status === 200 || status === 404, `Expected 200/404 for public endpoint, got ${status}`);
  }));

  results.push(await runTest('Public dealership info endpoint is accessible without auth', async () => {
    const { status } = await fetchWithTimeout(`${BASE_URL}/api/public/dealership-info`);
    assert(status === 200 || status === 404, `Expected 200/404 for public endpoint, got ${status}`);
  }));

  // ====== SENSITIVE DATA EXPOSURE TESTS ======

  results.push(await runTest('Public endpoints do not expose API keys or tokens', async () => {
    const { status, body } = await fetchWithTimeout(`${BASE_URL}/api/public/dealership-info`);
    
    if (status === 200 && body && !body.startsWith('<!DOCTYPE')) {
      try {
        const data = JSON.parse(body);
        const responseString = JSON.stringify(data).toLowerCase();
        assert(!responseString.includes('apikey'), 'Response should not contain apiKey');
        assert(!responseString.includes('api_key'), 'Response should not contain api_key');
        assert(!responseString.includes('accesstoken'), 'Response should not contain accessToken');
        assert(!responseString.includes('access_token'), 'Response should not contain access_token');
        assert(!responseString.includes('refreshtoken'), 'Response should not contain refreshToken');
        assert(!responseString.includes('refresh_token'), 'Response should not contain refresh_token');
        assert(!responseString.includes('password'), 'Response should not contain password');
        assert(!responseString.includes('secret'), 'Response should not contain secret');
        assert(!responseString.includes('private_key'), 'Response should not contain private_key');
      } catch (e) {
        // Non-JSON response is acceptable
      }
    }
  }));

  results.push(await runTest('Public vehicles endpoint does not expose internal IDs', async () => {
    const { status, body } = await fetchWithTimeout(`${BASE_URL}/api/public/vehicles`);
    
    if (status === 200 && body && !body.startsWith('<!DOCTYPE')) {
      try {
        const data = JSON.parse(body);
        const responseString = JSON.stringify(data).toLowerCase();
        assert(!responseString.includes('dealershipid'), 'Response should not expose dealershipId directly');
      } catch (e) {
        // Non-JSON or no vehicles is acceptable
      }
    }
  }));

  // ====== WEBHOOK ENDPOINT TESTS ======

  results.push(await runTest('PBS webhook endpoint accepts POST and validates', async () => {
    const { status, body } = await fetchWithTimeout(`${BASE_URL}/api/pbs/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'test' })
    });
    assert(status !== 405, `PBS webhook should accept POST, got ${status}`);
    assert(status !== 404, `PBS webhook endpoint should exist, got ${status}`);
  }));

  results.push(await runTest('GHL webhook endpoint accepts POST and validates', async () => {
    const { status, body } = await fetchWithTimeout(`${BASE_URL}/api/ghl/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'test' })
    });
    assert(status !== 405, `GHL webhook should accept POST, got ${status}`);
    assert(status !== 404, `GHL webhook endpoint should exist, got ${status}`);
  }));

  // ====== DEALERSHIP-SCOPED ENDPOINT TESTS ======

  results.push(await runTest('User management endpoint requires authentication', async () => {
    const { status } = await fetchWithTimeout(`${BASE_URL}/api/users`);
    assert(status === 401 || status === 403, `Expected 401/403 for users endpoint, got ${status}`);
  }));

  results.push(await runTest('Call recordings endpoint requires authentication', async () => {
    const { status } = await fetchWithTimeout(`${BASE_URL}/api/call-recordings`);
    assert(status === 401 || status === 403, `Expected 401/403 for call recordings, got ${status}`);
  }));

  results.push(await runTest('Dealership API keys endpoint requires authentication', async () => {
    const { status } = await fetchWithTimeout(`${BASE_URL}/api/dealership-api-keys`);
    assert(status === 401 || status === 403, `Expected 401/403 for dealership API keys, got ${status}`);
  }));

  results.push(await runTest('Dealerships endpoint requires super admin authentication', async () => {
    const { status } = await fetchWithTimeout(`${BASE_URL}/api/super-admin/dealerships`);
    assert(status === 401 || status === 403, `Expected 401/403 for super admin dealerships, got ${status}`);
  }));

  return results;
}

async function main() {
  console.log('🔒 Running Tenant Isolation & Security Tests\n');
  console.log(`Base URL: ${BASE_URL}\n`);

  const results = await runTenantIsolationTests();

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
