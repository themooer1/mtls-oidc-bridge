# Integration Tests

This folder builds a local Docker Compose environment for exercising the OP through Envoy as it will run in production.

The important path is:

1. `certs` generates a CA, an Envoy server cert, and a client cert with subject `CN=mtls-conformance-user`.
2. `mtls-edge` exposes:
   - `http://localhost:10080` as a plain proxy to the Python echo backend.
   - `https://localhost:10443` as an mTLS proxy to the Python echo backend with XFCC `SANITIZE_SET`.
   - `https://localhost:19443` as an mTLS proxy to the OP.
3. `cert-client-proxy` exposes `http://localhost:18080` and automatically presents the generated client certificate to `mtls-edge`.
4. The OP runs with file-backed users and clients from `op-config/`.

Run the proxy and OP smoke checks:

```sh
git submodule update --init --recursive
cd "integration tests"
./scripts/smoke.sh
```

Run the OpenID Foundation conformance suite:

```sh
git submodule update --init --recursive
cd "integration tests"
./scripts/run-conformance.sh
```

The conformance wrapper starts this compose stack, builds/starts the official suite if needed, and runs:

```text
oidcc-basic-certification-test-plan[server_metadata=discovery][client_registration=static_client]
```

The harness intentionally starts with no expected skips. The app auto-authenticates from the certificate, so some prompt/session/logout-oriented tests may need careful interpretation after the first run, but redirect URI and token flow tests should not be disabled preemptively.

The conformance suite is pinned as a git submodule at `conformance-suite/` from `https://gitlab.com/openid/conformance-suite.git`. By default the wrapper connects the conformance suite `server` container to the `openid-tls-connector-integration_default` Docker network and points discovery at `http://cert-client-proxy:18080`. If you change the compose project, use a separate suite checkout, or run the suite differently, set `INTEGRATION_NETWORK`, `OP_BASE_URL`, or `CONFORMANCE_SUITE_DIR` explicitly.

If the host Python environment does not already have the conformance-suite script dependencies, `run-conformance.sh` creates `.conformance-python/` and installs `scripts/requirements.txt` from the suite checkout. The generated conformance JSON is written under `/tmp/openid-tls-conformance.*` because the upstream `run-test-plan.py` command parser does not tolerate spaces in the config-file path.
