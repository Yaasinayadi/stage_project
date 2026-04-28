import urllib.request
import json
import time

try:
    req = urllib.request.Request('http://localhost:8069/api/tickets', headers={'Origin': 'http://localhost:3000'})
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode())
        tickets = data.get('data', [])
        print(f"Found {len(tickets)} tickets")
        
        for t in tickets:
            if not t.get('category'):
                print(f"Fixing ticket {t['id']} - {t['name']}...")
                try:
                    fix_req = urllib.request.Request(f"http://localhost:8069/api/ticket/{t['id']}/ai-suggest", headers={'Origin': 'http://localhost:3000'})
                    with urllib.request.urlopen(fix_req) as fix_res:
                        print(f"Ticket {t['id']} fixed.")
                except Exception as e:
                    print(f"Error fixing ticket {t['id']}: {e}")
                time.sleep(1) # prevent overloading
        print("Done")
except Exception as e:
    print(e)
