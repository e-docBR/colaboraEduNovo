import urllib.request
import re

try:
    url = "https://web.whatsapp.com/"
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
    with urllib.request.urlopen(req) as response:
        html = response.read().decode('utf-8')
        # Find the appVersion string
        match = re.search(r'"is_wa_web":true,"appVersion":"([^"]+)"', html)
        if match:
            version = match.group(1)
            print(version)
        else:
            print("Version not found")
except Exception as e:
    print(f"Error: {e}")
