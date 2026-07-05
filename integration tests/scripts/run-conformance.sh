#!/bin/sh
set -eu

cd "$(dirname "$0")/.."

if [ -z "${CONFORMANCE_SUITE_DIR:-}" ]; then
  echo "Set CONFORMANCE_SUITE_DIR to an OpenID Foundation conformance-suite checkout." >&2
  echo "Example:" >&2
  echo "  git clone https://gitlab.com/openid/conformance-suite.git ../conformance-suite" >&2
  echo "  CONFORMANCE_SUITE_DIR=../conformance-suite ./scripts/run-conformance.sh" >&2
  exit 2
fi

suite_dir=$(cd "$CONFORMANCE_SUITE_DIR" && pwd)
docker_bin=${DOCKER:-$(command -v docker || true)}
if [ -z "$docker_bin" ] && [ -x /usr/local/bin/docker ]; then
  docker_bin=/usr/local/bin/docker
fi
if [ -z "$docker_bin" ]; then
  echo "docker was not found on PATH or at /usr/local/bin/docker" >&2
  exit 127
fi

op_base_url=${OP_BASE_URL:-http://cert-client-proxy:18080}
conformance_project=${CONFORMANCE_COMPOSE_PROJECT:-conformance-suite}
integration_network=${INTEGRATION_NETWORK:-openid-tls-connector-integration_default}
export_dir=${EXPORT_DIR:-$(pwd)/results}
config_dir=$(mktemp -d /tmp/openid-tls-conformance.XXXXXX)
config_file=$config_dir/basic-static-client.json
python_venv=$(pwd)/.conformance-python
mkdir -p "$export_dir"

python3 - "$op_base_url" conformance/basic-static-client.template.json > "$config_file" <<'PY'
import sys
op_base_url = sys.argv[1].rstrip("/")
with open(sys.argv[2], "r", encoding="utf-8") as fh:
    template = fh.read()
sys.stdout.write(template.replace("${OP_BASE_URL}", op_base_url))
PY

"$docker_bin" compose -f docker-compose.yml up --build -d certs echo-backend op mtls-edge cert-client-proxy

if [ ! -f "$suite_dir/target/fapi-test-suite.jar" ]; then
  echo "Building conformance suite jar..."
  (cd "$suite_dir" && MAVEN_CACHE="${MAVEN_CACHE:-$HOME/.m2}" "$docker_bin" compose -f builder-compose.yml run --rm builder)
fi

if ! python3 -c 'import httpx' >/dev/null 2>&1; then
  if [ ! -x "$python_venv/bin/python" ]; then
    python3 -m venv "$python_venv"
  fi
  "$python_venv/bin/python" -m pip install -r "$suite_dir/scripts/requirements.txt"
  conformance_python="$python_venv/bin/python"
else
  conformance_python=python3
fi

(
  cd "$suite_dir"
  COMPOSE_PROJECT_NAME="$conformance_project" "$docker_bin" compose up -d
)

server_container=$(
  cd "$suite_dir"
  COMPOSE_PROJECT_NAME="$conformance_project" "$docker_bin" compose ps -q server
)
if [ -n "$server_container" ]; then
  "$docker_bin" network connect "$integration_network" "$server_container" 2>/dev/null || true
fi

echo "Running OIDCC Basic OP static-client test plan against $op_base_url"
run_plan() {
  "$conformance_python" scripts/run-test-plan.py \
    --export-dir "$export_dir" \
    "oidcc-basic-certification-test-plan[server_metadata=discovery][client_registration=static_client]" \
    "$config_file"
}

(
  cd "$suite_dir"
  if [ -n "${CONFORMANCE_SERVER:-}" ]; then
    CONFORMANCE_SERVER="$CONFORMANCE_SERVER" run_plan
  else
    run_plan
  fi
)
