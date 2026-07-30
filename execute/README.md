# execute

Communicates with the frontend directly from the browser. Requests must include
a Firebase ID token in the `Authorization: Bearer <token>` header.

Requirements:

- go 1.22
- [Isolate](https://github.com/ioi/isolate) v2.6 installed with cgroups v2

## how to run

Build the binary (`go build`) and run with `./execute` (set the env var `EXECUTE_DUMMY` in order to use unsafe sandboxing)

Important: tests might fail because of [this issue](https://github.com/google/sanitizers/issues/856), run `sudo sysctl vm.mmap_rnd_bits=28` before running the tests.

## tests

`go test .` runs a collection of tests that have been collected from the students and teachers.

Use `go test -v .` to view the request and response objects.

## http server

listens on `:1235`

Set `FIREBASE_PROJECT_IDS` to the comma-separated Firebase project IDs whose
users may run code, for example the Algo Pro and MATFIZ projects. The legacy
single-project `FIREBASE_PROJECT_ID` is still accepted when
`FIREBASE_PROJECT_IDS` is not set. For local development against the Firebase
emulator, also set `FIREBASE_AUTH_EMULATOR_HOST`. Token verification uses
Google's public keys, so the execute service does not need Firebase
service-account credentials.

Set `EXECUTE_ALLOWED_ORIGINS` to a comma-separated list of frontend origins
allowed by CORS. It defaults to `http://localhost:3000`. Browser requests with
an unlisted `Origin` are rejected.

C++ compilations are cached under `/tmp/execute-server/compile-cache`. The
cache is deleted on server startup, then kept under 1 GB on disk using
in-memory LRU metadata. Compiler output is capped at 64 KiB and compiled
artifacts at 64 MiB.

### POST /execute

request:

- headers:
  - `Authorization: Bearer <Firebase ID token>`
  - `Content-Type: application/json`
- json body with fields:
  - language: string, `"cpp"`, `"java"` or `"py"`
  - filename: string, filename from algopro ide (e.g. `main.cpp`)
  - source: string, source code as UTF-8 JSON text
  - input: string, input data as UTF-8 JSON text

responses:

- 500:
  - when: undefined internal error happened (this shouldn't happen)
  - response body is undefined
- 400:
  - when: request is malformed
  - response body is undefined
- 401:
  - when: the Firebase ID token is missing or invalid
- 413:
  - when: input data is larger than 5000 UTF-8 bytes, the request body is larger than 100000 bytes, or a C++ artifact is larger than 64 MiB
- 200:
  - when: successful execution (incl. compilation error, TL, RTE etc.)
  - json body with fields:
    - compiled: boolean
    - compiler_output: string
    - verdict: integer ([reference](https://pkg.go.dev/github.com/mraron/njudge@v0.5.0/pkg/language/sandbox#Verdict))
      - 1: OK
      - 2: time limit exceeded (>5secs)
      - 4: memory limit exceeded (>128MiB)
      - 8: runtime error
      - 16: internal error
      - 32: compilation error
    - output: string, the stdout produced by the program (max 5000 bytes)
    - stderr: string, the stderr produced by the program (including ASan, max 10000 bytes)
    - memory: int, memory usage in KiBs
    - time: string, cpu time used in a [string format](https://pkg.go.dev/time#Duration.String)

## Deployment on Ubuntu 26.04

### Install the compilers and runtimes

Install the default C++ compiler:

```sh
sudo apt update
sudo apt install --no-install-recommends g++
```

The execute service invokes `/usr/bin/g++`.

Install the latest packaged PyPy release from the
[PyPy PPA](https://launchpad.net/~pypy/+archive/ubuntu/ppa):

```sh
sudo apt install software-properties-common wget
sudo add-apt-repository ppa:pypy/ppa
sudo apt update
sudo apt install pypy3
```

Install pip and NumPy for PyPy in order to use the latest versions.

```sh
wget https://bootstrap.pypa.io/get-pip.py
sudo pypy3 get-pip.py --break-system-packages
sudo pypy3 -m pip install 'numpy>=2.0' --break-system-packages --root-user-action=ignore
rm get-pip.py
```

This root-level pip installation is a workaround for the current server setup.
We should replace it with a cleaner, reproducible way to provide NumPy to PyPy.

### Install IOI Isolate

Build and install the pinned Isolate version expected by this service:

```sh
sudo apt install --no-install-recommends git make libcap-dev libseccomp-dev libsystemd-dev pkgconf
git clone --depth 1 --branch v2.6 https://github.com/ioi/isolate.git
cd isolate
make isolate isolate-check-environment isolate-cg-keeper
sudo make install
sudo addgroup --system isolate
sudo adduser --disabled-login --ingroup isolate --home /nonexistent --no-create-home --shell /bin/false --comment "" isolate
sudo systemctl daemon-reload
sudo systemctl enable --now isolate.service
```

Check that Isolate started successfully:

```sh
systemctl status isolate.service
```

### Configure AddressSanitizer

Ubuntu's high-entropy mmap randomization can intermittently prevent ASan from
allocating its shadow memory. Apply the
[recommended workaround](https://github.com/google/sanitizers/issues/1614#issuecomment-2010316781)
and persist it across reboots:

```sh
echo 'vm.mmap_rnd_bits = 28' | sudo tee /etc/sysctl.d/99-execute-asan.conf
sudo sysctl --system
```

### Build and upload the execute binary

Production runs on an AWS EC2 `t4g.small` instance, which uses the AArch64
architecture.

From the `execute` directory, cross-compile a Linux ARM64 binary:

```sh
GOOS=linux GOARCH=arm64 go build
scp execute ubuntu@<server>:/home/ubuntu/execute
```

The first C++ compilation may generate a precompiled header. PCH generation
runs with a 768 MiB compiler memory limit, and the PCH files are kept under a
separate 256 MiB disk limit.

### Run execute with systemd

Create `/etc/systemd/system/execute.service`:

```ini
[Unit]
Description=Execute backend
Wants=network-online.target
After=network-online.target isolate.service
Requires=isolate.service

[Service]
Type=simple
User=ubuntu
ExecStart=/home/ubuntu/execute
Restart=always
RestartSec=3
Environment="FIREBASE_PROJECT_IDS=algopro-app,algopro-dev,matfiz-ide"
Environment="EXECUTE_ALLOWED_ORIGINS=https://ide.algopro.hu,https://dev.ide.algopro.hu,https://ide.matfiz.org"

[Install]
WantedBy=multi-user.target
```

Enable and start the service:

```sh
sudo systemctl daemon-reload
sudo systemctl enable --now execute.service
systemctl status execute.service
```

Logs are available through journald:

```sh
journalctl -u execute.service -f
```

After uploading a new binary, restart the service with
`sudo systemctl restart execute.service`.

### Expose the service through Caddy

Install [Caddy](https://caddyserver.com/docs/install):

```sh
sudo apt install caddy
```

Point the hostname's DNS record at the server, allow inbound TCP ports 80 and
443, and configure `/etc/caddy/Caddyfile`:

```caddyfile
execute.algopro.hu {
	reverse_proxy 127.0.0.1:1235
}
```

Validate and reload the configuration:

```sh
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Caddy obtains and renews the TLS certificate automatically. Port 1235 should
not be exposed publicly; only Caddy needs to reach it.
