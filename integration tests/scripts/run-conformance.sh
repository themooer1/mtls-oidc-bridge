#!/bin/sh
set -eu

cd "$(dirname "$0")/.."

suite_dir=${CONFORMANCE_SUITE_DIR:-$(pwd)/conformance-suite}
if [ ! -d "$suite_dir/.git" ] && [ ! -f "$suite_dir/.git" ]; then
  echo "OpenID Foundation conformance-suite submodule is not initialized." >&2
  echo "Run from the repository root:" >&2
  echo "  git submodule update --init --recursive" >&2
  echo "Or set CONFORMANCE_SUITE_DIR to another checkout." >&2
  exit 2
fi

suite_dir=$(cd "$suite_dir" && pwd)
if [ ! -f "$suite_dir/builder-compose.yml" ] || [ ! -f "$suite_dir/scripts/run-test-plan.py" ]; then
  echo "CONFORMANCE_SUITE_DIR does not look like an OpenID Foundation conformance-suite checkout: $suite_dir" >&2
  exit 2
fi

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
builder_compose_override=
python_venv=$(pwd)/.conformance-python
mkdir -p "$export_dir"

echo "Using conformance suite checkout at $suite_dir"
echo "Writing conformance results under $export_dir"

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
  if [ -f "$suite_dir/.git" ]; then
    gitdir_pointer=$(sed -n 's/^gitdir: //p' "$suite_dir/.git")
    if [ -n "$gitdir_pointer" ]; then
      host_git_dir=$(python3 - "$suite_dir" "$gitdir_pointer" <<'PY'
import os
import sys

suite_dir = sys.argv[1]
gitdir_pointer = sys.argv[2]
if os.path.isabs(gitdir_pointer):
    print(os.path.normpath(gitdir_pointer))
else:
    print(os.path.normpath(os.path.join(suite_dir, gitdir_pointer)))
PY
)
      container_git_dir=$(python3 - "$gitdir_pointer" <<'PY'
import os
import sys

gitdir_pointer = sys.argv[1]
if os.path.isabs(gitdir_pointer):
    print(os.path.normpath(gitdir_pointer))
else:
    print(os.path.normpath(os.path.join("/usr/src/mymaven", gitdir_pointer)))
PY
)
      builder_compose_override=$config_dir/builder-submodule-git.yml
      cat > "$builder_compose_override" <<EOF
services:
  builder:
    volumes:
      - "$host_git_dir:$container_git_dir:ro"
EOF
    fi
  fi

  if [ -n "$builder_compose_override" ]; then
    (cd "$suite_dir" && MAVEN_CACHE="${MAVEN_CACHE:-$HOME/.m2}" "$docker_bin" compose -f builder-compose.yml -f "$builder_compose_override" run --rm builder)
  else
    (cd "$suite_dir" && MAVEN_CACHE="${MAVEN_CACHE:-$HOME/.m2}" "$docker_bin" compose -f builder-compose.yml run --rm builder)
  fi
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
