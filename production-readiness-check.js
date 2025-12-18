
import fetch from 'node-fetch';
import https from 'https';

// Ignore self-signed certs if any (though Prod should have valid SSL)
const agent = new https.Agent({
  rejectUnauthorized: false
});

const API_URL = 'https://app.zcr.ai/api';

async function checkProduction() {
    console.log(`Checking Production API at ${API_URL}...`);
    
    // 1. Login
    console.log(`\n1. Authenticating as SuperAdmin...`);
    const loginRes = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: 'superadmin@zcr.ai',
            password: 'SuperAdmin@123!'
        }),
        agent
    });

    if (!loginRes.ok) {
        console.error(`❌ Login Failed: ${loginRes.status} ${loginRes.statusText}`);
        const text = await loginRes.text();
        console.error(text);
        process.exit(1);
    }

    // Capture cookies
    const cookies = loginRes.headers.get('set-cookie');
    if (!cookies) {
        console.error(`❌ Login succeeded but no cookies received!`);
        process.exit(1);
    }
    console.log(`✅ Login Success! (Cookie received)`);

    // Helper for authenticated requests
    const authHeaders = {
        'Cookie': cookies,
        'Content-Type': 'application/json'
    };

    // 2. Check Dashboard Summary
    console.log(`\n2. Verifying Dashboard Data Flow...`);
    const summaryRes = await fetch(`${API_URL}/dashboard/summary?days=7`, {
        headers: authHeaders,
        agent
    });

    if (!summaryRes.ok) {
        console.error(`❌ Dashboard Summary Failed: ${summaryRes.status}`);
        const errText = await summaryRes.text();
        console.error(`Error Body: ${errText}`);
        
        // Retry with selected_tenant cookie if first attempt failed
        console.log("Retrying with explicit selected_tenant cookie...");
        const retryRes = await fetch(`${API_URL}/dashboard/summary?days=7`, {
            headers: {
                ...authHeaders,
                'Cookie': `${authHeaders.Cookie}; selected_tenant=c8abd753-3015-4508-aa7b-6bcf732934e5`
            },
            agent
        });
        
        if (!retryRes.ok) {
             const retryErr = await retryRes.text();
             console.error(`Retry Failed: ${retryErr}`);
             process.exit(1);
        } else {
             console.log("✅ Retry Succeeded with tenant cookie!");
             const retryData = await retryRes.json();
             console.log(JSON.stringify(retryData, null, 2));
             process.exit(0);
        }
    }

    const summaryData = await summaryRes.json();
    console.log(`✅ Dashboard Data Retrieved:`);
    console.log(JSON.stringify(summaryData, null, 2));

    if (summaryData.totalEvents === 0) {
        console.warn(`⚠️ Warning: Total Events is 0. Data ingestion might be idle.`);
    } else {
        console.log(`🚀 System is ACTIVE processing ${summaryData.totalEvents} events.`);
    }

    // 3. Check Recent Detections
    console.log(`\n3. Verifying Detection Engine...`);
    const detectionsRes = await fetch(`${API_URL}/dashboard/recent-detections?limit=5`, {
        headers: authHeaders,
        agent
    });

    if (detectionsRes.ok) {
        const detections = await detectionsRes.json();
        console.log(`✅ Recent Detections Retrieved: ${detections.length} found.`);
    } else {
        console.error(`❌ Recent Detections Failed: ${detectionsRes.status}`);
    }

    console.log(`\n4. Verifying SentinelOne Data...`);
    const s1Res = await fetch(`${API_URL}/dashboard/summary?days=30&source=sentinelone`, {
        headers: {
            ...authHeaders,
             'Cookie': `${authHeaders.Cookie}; selected_tenant=c8abd753-3015-4508-aa7b-6bcf732934e5`
        },
        agent
    });
    
    if (s1Res.ok) {
        const s1Data = await s1Res.json();
        console.log(`✅ SentinelOne Stats:`, JSON.stringify(s1Data, null, 2));
        
        if (s1Data.totalEvents > 0) {
            console.log(`🎉 CONFIRMED: ${s1Data.totalEvents} SentinelOne events found!`);
        } else {
             console.log(`⚠️ No SentinelOne events found in the last 30 days.`);
        }
    } else {
        console.error("❌ Failed to query SentinelOne stats");
    }

    console.log(`\n✅ SYSTEM IS USABLE.`);
}

checkProduction().catch(console.error);
