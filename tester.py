import urllib.request
import urllib.parse
import json

# Configuration
TOKEN_URL = "http://localhost:3000/token"
REDIRECT_URI = "https://oidcdebugger.com/debug"
GRANT_TYPE = "authorization_code"
CLIENT_ID = "testid"  # Automatically included now

print("--- OpenAuth Token Endpoint Tester ---")
print(f"Target URL: {TOKEN_URL}")
print("Press Ctrl+C at any time to exit.\n")

while True:
    try:
        print("-" * 40)
        
        # 1. Prompt for code_verifier FIRST
        code_verifier = input("Enter code_verifier:\n> ").strip()
        
        if not code_verifier:
            print("❌ Error: code_verifier is required for PKCE!")
            continue

        # 2. Prompt for the string pasted from oidcdebugger SECOND
        debugger_paste = input("\nPaste query string from oidcdebugger (e.g., code=...&state=...):\n> ").strip()
        
        if not debugger_paste:
            print("Input cannot be empty. Please try again.")
            continue
            
        # Parse the pasted string into a dictionary
        parsed_query = urllib.parse.parse_qs(debugger_paste)
        
        # Extract code and state safely
        code = parsed_query.get("code", [None])[0]
        state = parsed_query.get("state", [None])[0]
        
        if not code:
            print("❌ Error: Could not find 'code' in the pasted text!")
            continue

        # 3. Build the payload (including client_id)
        payload = {
            "grant_type": GRANT_TYPE,
            "client_id": CLIENT_ID,
            "code": code,
            "redirect_uri": REDIRECT_URI,
            "code_verifier": code_verifier
        }
        
        # Include state if it was provided in the paste
        if state:
            payload["state"] = state

        # Encode payload to x-www-form-urlencoded
        data = urllib.parse.urlencode(payload).encode("utf-8")
        
        # 4. Create and send the request
        req = urllib.request.Request(
            TOKEN_URL, 
            data=data, 
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        
        print("\nSending POST request...")
        with urllib.request.urlopen(req) as response:
            status = response.getcode()
            body = response.read().decode("utf-8")
            
            print(f"✅ Success! HTTP Status: {status}")
            try:
                # Pretty print JSON response if possible
                parsed_json = json.loads(body)
                print(json.dumps(parsed_json, indent=2))
            except json.JSONDecodeError:
                print(body)
                
    except urllib.error.HTTPError as e:
        print(f"❌ HTTP Error: {e.code} {e.reason}")
        try:
            error_body = e.read().decode("utf-8")
            parsed_error = json.loads(error_body)
            print(json.dumps(parsed_error, indent=2))
        except Exception:
            try:
                print(e.read().decode("utf-8") or "No error body returned.")
            except Exception:
                print("Could not read error payload.")
            
    except urllib.error.URLError as e:
        print(f"❌ Connection Error: Cannot reach {TOKEN_URL}. Is your server running?")
        print(f"Reason: {e.reason}")
        
    except (KeyboardInterrupt, SystemExit):
        print("\n\nExiting tester. Goodbye!")
        break
    except Exception as e:
        print(f"An unexpected error occurred: {e}")