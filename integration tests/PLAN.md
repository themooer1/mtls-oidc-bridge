# Integration Test Plan

Goal: run this OP behind Envoy in the same trust shape used in production, then point the OpenID Foundation conformance suite at a proxy that automatically presents a test client certificate.

1. Generate a local CA, Envoy server certificate, and browser-simulation client certificate in a container.
2. Start Envoy with a plain HTTP listener and proxy to a trivial Python backend.
3. Enable a second Envoy listener with downstream mTLS validation and verify the same backend is reachable only with the generated client certificate.
4. Configure Envoy `forward_client_cert_details: SANITIZE_SET` and `set_current_client_cert_details.subject: true`; verify the backend receives `x-forwarded-client-cert` with `Subject="CN=mtls-conformance-user"`.
5. Start the OP with file-backed users and clients, and route an mTLS Envoy listener to it.
6. Start a second Envoy proxy that accepts ordinary HTTP from the conformance suite, originates mTLS to the OP edge listener with the generated client cert, and preserves forwarded host/proto/port headers so issuer metadata is stable.
7. Run OpenID Connect Core Basic OP conformance with static client registration. Do not disable tests up front; record failures first, then decide whether they are product gaps, harness issues, or genuinely inapplicable to certificate-auto-login.

The local Docker smoke script covers steps 1-6. The conformance wrapper covers step 7 with the official suite checkout.

