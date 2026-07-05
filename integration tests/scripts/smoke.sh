#!/bin/sh
set -eu

cd "$(dirname "$0")/.."

docker_bin=${DOCKER:-$(command -v docker || true)}
if [ -z "$docker_bin" ] && [ -x /usr/local/bin/docker ]; then
  docker_bin=/usr/local/bin/docker
fi
if [ -z "$docker_bin" ]; then
  echo "docker was not found on PATH or at /usr/local/bin/docker" >&2
  exit 127
fi

compose() {
  "$docker_bin" compose -f docker-compose.yml "$@"
}

wait_for_http() {
  url=$1
  tries=60
  until curl -fsS "$url" >/dev/null 2>&1; do
    tries=$((tries - 1))
    if [ "$tries" -le 0 ]; then
      echo "timed out waiting for $url" >&2
      return 1
    fi
    sleep 1
  done
}

compose up --build -d certs echo-backend op mtls-edge cert-client-proxy

wait_for_http http://localhost:10080/headers
curl -fsS http://localhost:10080/headers >/dev/null
echo "plain Envoy -> Python backend works"

if curl -fsS --cacert .generated-certs/ca.crt https://localhost:10443/headers >/tmp/mtls-no-cert.json 2>/dev/null; then
  echo "mTLS listener unexpectedly accepted a request without a client certificate" >&2
  exit 1
fi
echo "mTLS listener rejects requests without a client certificate"

curl -fsS \
  --cacert .generated-certs/ca.crt \
  --cert .generated-certs/client.crt \
  --key .generated-certs/client.key \
  https://localhost:10443/headers > /tmp/mtls-with-cert.json

python3 - <<'PY'
import json
with open("/tmp/mtls-with-cert.json", "r", encoding="utf-8") as fh:
    headers = json.load(fh)["headers"]
xfcc = headers.get("x-forwarded-client-cert", "")
if 'Subject="CN=mtls-conformance-user"' not in xfcc:
    raise SystemExit(f"missing expected XFCC Subject in {xfcc!r}")
PY
echo "mTLS listener forwards XFCC Subject to the backend"

wait_for_http http://localhost:18080/.well-known/openid-configuration
python3 - <<'PY'
import json
import urllib.request

with urllib.request.urlopen("http://localhost:18080/.well-known/openid-configuration", timeout=5) as response:
    metadata = json.load(response)

required = [
    "authorization_endpoint",
    "token_endpoint",
    "jwks_uri",
    "userinfo_endpoint",
]
missing = [key for key in required if key not in metadata]
if missing:
    raise SystemExit(f"missing discovery keys: {missing}")
if metadata["issuer"] != "http://localhost:18080":
    raise SystemExit(f"unexpected issuer: {metadata['issuer']!r}")
PY
echo "automatic client-cert proxy reaches the OP and preserves issuer origin"
