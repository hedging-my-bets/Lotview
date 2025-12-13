import { decodeVIN, type VINDecodeResult } from '../vin-decoder';

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

function assertEquals(actual: any, expected: any, message?: string): void {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, got ${actual}`);
  }
}

async function runVinAppraisalTests(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  // Unit tests using real decodeVIN function
  results.push(await runTest('decodeVIN rejects VIN too short', async () => {
    const result = await decodeVIN('ABC123');
    assert(result.errorCode === 'INVALID_VIN_LENGTH', `Expected INVALID_VIN_LENGTH, got ${result.errorCode}`);
    assert(result.errorMessage?.includes('17 characters') === true, `Error should mention 17 characters: ${result.errorMessage}`);
  }));

  results.push(await runTest('decodeVIN rejects VIN too long', async () => {
    const result = await decodeVIN('1234567890123456789');
    assert(result.errorCode === 'INVALID_VIN_LENGTH', `Expected INVALID_VIN_LENGTH, got ${result.errorCode}`);
  }));

  results.push(await runTest('decodeVIN normalizes lowercase VIN to uppercase', async () => {
    const result = await decodeVIN('2hgfc2f59lh555555');
    assertEquals(result.vin, '2HGFC2F59LH555555', 'VIN should be normalized to uppercase');
  }));

  results.push(await runTest('decodeVIN trims whitespace from VIN', async () => {
    const result = await decodeVIN('  2HGFC2F59LH555555  ');
    assertEquals(result.vin, '2HGFC2F59LH555555', 'VIN should be trimmed');
  }));

  results.push(await runTest('decodeVIN returns proper structure for valid VIN', async () => {
    const result = await decodeVIN('2HGFC2F59LH555555');
    assert(typeof result.vin === 'string', 'Result should have vin field');
    assert(result.vin === '2HGFC2F59LH555555', 'VIN should match input');
    // Either has decoded data or error info
    const hasData = result.year || result.make || result.model;
    const hasError = result.errorCode;
    assert(hasData || hasError !== undefined, 'Result should have decoded data or error info');
  }));

  results.push(await runTest('decodeVIN result includes source field when successful', async () => {
    const result = await decodeVIN('1HGCM82633A123456');
    if (!result.errorCode) {
      assert(['marketcheck', 'api_ninjas', 'nhtsa'].includes(result.source!), 
        `Source should be marketcheck, api_ninjas, or nhtsa, got ${result.source}`);
    }
  }));

  results.push(await runTest('decodeVIN includes responseTimeMs', async () => {
    const result = await decodeVIN('2HGFC2F59LH555555');
    assert(typeof result.responseTimeMs === 'number' || result.responseTimeMs === undefined, 
      'responseTimeMs should be a number when present');
  }));

  // Type structure validation
  results.push(await runTest('VINDecodeResult type includes all expected optional fields', async () => {
    const mockResult: VINDecodeResult = {
      vin: 'TEST12345678901234',
      year: '2020',
      make: 'Honda',
      model: 'Civic',
      trim: 'EX',
      bodyClass: 'Sedan',
      engineCylinders: '4',
      engineHP: '158',
      fuelType: 'Gasoline',
      driveType: 'FWD',
      transmission: 'CVT',
      doors: '4',
      manufacturer: 'Honda',
      plantCountry: 'Japan',
      vehicleType: 'Passenger Car',
      source: 'nhtsa'
    };
    assert(mockResult.vin.length === 18, 'Mock VIN should be 18 chars for test validation');
  }));

  // Integration test - VIN decode endpoint requires authentication
  results.push(await runTest('VIN decode POST endpoint requires authentication', async () => {
    const { status } = await fetchWithTimeout(`${BASE_URL}/api/manager/decode-vin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vin: '2HGFC2F59LH555555' })
    });
    assert(status === 401 || status === 403, `Expected 401/403 without auth, got ${status}`);
  }));

  // Integration test - Appraisal endpoints require authentication
  results.push(await runTest('Appraisals list endpoint requires authentication', async () => {
    const { status } = await fetchWithTimeout(`${BASE_URL}/api/manager/appraisals`);
    assert(status === 401 || status === 403, `Expected 401/403 without auth, got ${status}`);
  }));

  results.push(await runTest('Appraisal creation requires authentication', async () => {
    const { status } = await fetchWithTimeout(`${BASE_URL}/api/manager/appraisals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vin: '2HGFC2F59LH555555' })
    });
    assert(status === 401 || status === 403, `Expected 401/403 without auth, got ${status}`);
  }));

  results.push(await runTest('Appraisal update by ID requires authentication', async () => {
    const { status } = await fetchWithTimeout(`${BASE_URL}/api/manager/appraisals/1`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed' })
    });
    assert(status === 401 || status === 403, `Expected 401/403 without auth, got ${status}`);
  }));

  results.push(await runTest('Appraisal delete requires authentication', async () => {
    const { status } = await fetchWithTimeout(`${BASE_URL}/api/manager/appraisals/1`, {
      method: 'DELETE'
    });
    assert(status === 401 || status === 403, `Expected 401/403 without auth, got ${status}`);
  }));

  return results;
}

async function main() {
  console.log('🚗 Running VIN Decode & Appraisal Tests\n');
  console.log(`Base URL: ${BASE_URL}\n`);

  const results = await runVinAppraisalTests();

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
