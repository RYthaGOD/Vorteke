const fetch = require('node-fetch');

async function testPump() {
    try {
        const res = await fetch('https://frontend-api.pump.fun/coins?offset=0&limit=10&sort=last_reply&include_description=true');
        console.log("Status:", res.status);
        if (res.ok) {
            const data = await res.json();
            console.log("Found:", data.length, "tokens");
            if (data.length > 0) {
                console.log("First token:", data[0].mint, data[0].symbol);
            }
        } else {
            const text = await res.text();
            console.log("Error body:", text);
        }
    } catch (e) {
        console.error("Fetch failed:", e);
    }
}

testPump();
