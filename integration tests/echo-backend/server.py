from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        body = {
            "path": self.path,
            "headers": {key.lower(): value for key, value in self.headers.items()},
        }
        payload = json.dumps(body, indent=2, sort_keys=True).encode("utf-8")
        self.send_response(200)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def log_message(self, fmt, *args):
        print("%s - %s" % (self.address_string(), fmt % args), flush=True)


ThreadingHTTPServer(("0.0.0.0", 9000), Handler).serve_forever()

