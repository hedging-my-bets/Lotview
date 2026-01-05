type SmokeResult = {
  step: string;
  ok: boolean;
  detail?: string;
};

const BASE_URL = process.env.SMOKE_BASE_URL || "http://localhost:5000";
const EMAIL = process.env.SMOKE_EMAIL || "admin@olympichyundai.ca";
const PASSWORD = process.env.SMOKE_PASSWORD || "master123";
const MARK_POSTED = process.env.SMOKE_MARK_POSTED === "true";

function logResult(result: SmokeResult) {
  const status = result.ok ? "OK" : "FAIL";
  const detail = result.detail ? ` - ${result.detail}` : "";
  console.log(`[${status}] ${result.step}${detail}`);
}

async function main() {
  const results: SmokeResult[] = [];

  let token = "";
  try {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD })
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Login failed (${res.status}): ${text}`);
    }
    const data = await res.json();
    token = data?.token;
    if (!token) {
      throw new Error("Missing auth token");
    }
    results.push({ step: "Login", ok: true });
  } catch (error) {
    results.push({ step: "Login", ok: false, detail: error instanceof Error ? error.message : String(error) });
    results.forEach(logResult);
    process.exit(1);
  }

  let vehicleId: number | null = null;
  try {
    const res = await fetch(`${BASE_URL}/api/marketplace-blast/queue?limit=10`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) {
      throw new Error(`Queue fetch failed (${res.status})`);
    }
    const data = await res.json();
    const vehicles = Array.isArray(data?.vehicles) ? data.vehicles : [];
    vehicleId = vehicles[0]?.id ?? null;
    if (!vehicleId) {
      throw new Error("No vehicles available in queue");
    }
    results.push({ step: "Queue fetch", ok: true, detail: `Vehicle ${vehicleId}` });
  } catch (error) {
    results.push({ step: "Queue fetch", ok: false, detail: error instanceof Error ? error.message : String(error) });
    results.forEach(logResult);
    process.exit(1);
  }

  let bundleId: number | null = null;
  try {
    const bundleRes = await fetch(`${BASE_URL}/api/listing-bundles/vehicle/${vehicleId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (bundleRes.ok) {
      const bundleData = await bundleRes.json();
      bundleId = bundleData?.bundle?.id ?? null;
    }

    if (!bundleId) {
      const createRes = await fetch(`${BASE_URL}/api/listing-bundles/vehicle/${vehicleId}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          useAi: true,
          includePageDmCta: true,
          includeComplianceFooter: true
        })
      });
      if (!createRes.ok) {
        const text = await createRes.text();
        throw new Error(`Bundle create failed (${createRes.status}): ${text}`);
      }
      const created = await createRes.json();
      bundleId = created?.bundle?.id ?? null;
    }

    results.push({ step: "Bundle build", ok: true, detail: bundleId ? `Bundle ${bundleId}` : "No bundle id" });
  } catch (error) {
    results.push({ step: "Bundle build", ok: false, detail: error instanceof Error ? error.message : String(error) });
    results.forEach(logResult);
    process.exit(1);
  }

  try {
    const lockRes = await fetch(`${BASE_URL}/api/marketplace-blast/start-posting/${vehicleId}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ bundleId })
    });
    if (!lockRes.ok) {
      const text = await lockRes.text();
      throw new Error(`Start posting failed (${lockRes.status}): ${text}`);
    }
    results.push({ step: "Start posting lock", ok: true });
  } catch (error) {
    results.push({ step: "Start posting lock", ok: false, detail: error instanceof Error ? error.message : String(error) });
    results.forEach(logResult);
    process.exit(1);
  }

  if (MARK_POSTED) {
    try {
      const markRes = await fetch(`${BASE_URL}/api/marketplace-blast/mark-posted/${vehicleId}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          listingUrl: "https://www.facebook.com/marketplace/item/1234567890",
          bundleId
        })
      });
      if (!markRes.ok) {
        const text = await markRes.text();
        throw new Error(`Mark posted failed (${markRes.status}): ${text}`);
      }
      results.push({ step: "Mark posted", ok: true });
    } catch (error) {
      results.push({ step: "Mark posted", ok: false, detail: error instanceof Error ? error.message : String(error) });
      results.forEach(logResult);
      process.exit(1);
    }
  } else {
    results.push({ step: "Mark posted", ok: true, detail: "Skipped (SMOKE_MARK_POSTED=false)" });
  }

  results.forEach(logResult);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
