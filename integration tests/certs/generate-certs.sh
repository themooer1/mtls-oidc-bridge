#!/bin/sh
set -eu

out=/certs
mkdir -p "$out"

if [ -f "$out/ca.crt" ] && [ -f "$out/client.crt" ] && [ -f "$out/server.crt" ]; then
  echo "certificates already exist in $out"
  exit 0
fi

rm -f "$out"/*.crt "$out"/*.csr "$out"/*.key "$out"/*.srl "$out"/*.cnf

openssl genrsa -out "$out/ca.key" 4096
openssl req -x509 -new -nodes -key "$out/ca.key" -sha256 -days 3650 \
  -subj "/CN=openid-tls-connector-test-ca" \
  -out "$out/ca.crt"

cat > "$out/server.cnf" <<'EOF'
[req]
distinguished_name = dn
req_extensions = v3_req
prompt = no

[dn]
CN = mtls-edge

[v3_req]
subjectAltName = @alt_names

[alt_names]
DNS.1 = mtls-edge
DNS.2 = localhost
IP.1 = 127.0.0.1
EOF

openssl genrsa -out "$out/server.key" 2048
openssl req -new -key "$out/server.key" -out "$out/server.csr" -config "$out/server.cnf"
openssl x509 -req -in "$out/server.csr" -CA "$out/ca.crt" -CAkey "$out/ca.key" \
  -CAcreateserial -out "$out/server.crt" -days 825 -sha256 \
  -extensions v3_req -extfile "$out/server.cnf"

cat > "$out/client.cnf" <<'EOF'
[req]
distinguished_name = dn
req_extensions = v3_req
prompt = no

[dn]
CN = mtls-conformance-user

[v3_req]
extendedKeyUsage = clientAuth
EOF

openssl genrsa -out "$out/client.key" 2048
openssl req -new -key "$out/client.key" -out "$out/client.csr" -config "$out/client.cnf"
openssl x509 -req -in "$out/client.csr" -CA "$out/ca.crt" -CAkey "$out/ca.key" \
  -CAcreateserial -out "$out/client.crt" -days 825 -sha256 \
  -extensions v3_req -extfile "$out/client.cnf"

chmod 0644 "$out"/*.crt
chmod 0600 "$out"/*.key
echo "generated CA, server, and client certificates in $out"

