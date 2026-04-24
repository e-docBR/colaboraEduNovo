const https = require('https');
https.get('https://web.whatsapp.com/check-update?version=1.0.0&platform=web', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            console.log("WA_VERSION=" + json.currentVersion);
        } catch(e) {
            console.log("Error parsing: " + data);
        }
    });
});
