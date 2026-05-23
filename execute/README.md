# execute

Communicates with the frontend directly from the browser. Requests must include
a Firebase ID token in the `Authorization: Bearer <token>` header.

Requirements:

- go 1.22
- isolate v1 installed:
  - install isolate from tag `v1.10.1` (for example using `git clone --depth 1 --branch v1.10.1 https://github.com/ioi/isolate`)
  - if not enabled, [enable cgroups v1](https://wiki.archlinux.org/title/cgroups#Enable_cgroup_v1)

## how to run

Build the binary (`go build`) and run with `./execute` (set the env var `EXECUTE_DUMMY` in order to use unsafe sandboxing)

Important: tests might fail because of [this issue](https://github.com/google/sanitizers/issues/856), run `sudo sysctl vm.mmap_rnd_bits=28` before running the tests.

## tests

`go test .` runs a collection of tests that have been collected from the students and teachers.

Use `go test . -verbose` to view the request and response objects.

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
  - when: input data is larger than 5000 UTF-8 bytes, or the request body is larger than 100000 bytes
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
    - stderr: string, the stderr produced by the program (including ASAN, max 5000 bytes)
    - memory: int, memory usage in KiBs
    - time: string, cpu time used in a [string format](https://pkg.go.dev/time#Duration.String)

## Deployment instructions

Install the g++ compiler:

```
$ sudo apt --no-install-recommends install g++
```

Install latest pypy3:

```
$ sudo add-apt-repository ppa:pypy/ppa
$ sudo apt update
$ sudo apt install pypy3
```

Build this go binary locally (with `GOOS=linux GOARCH=amd64` if on a different platform), and then copy it to the server via `scp`.

Compile and build IOI Isolate on the server locally:

```
$ sudo apt install git make libcap-dev libsystemd-dev pkgconf
$ git clone https://github.com/ioi/isolate.git
$ cd isolate && sudo make install
$ sudo cp systemd/isolate.service /etc/systemd/system
$ sudo systemctl start isolate && sudo systemctl enable isolate
```

Disable "High Entropy mmap randomization" to fix intermittent memory allocation failures with ASan shadow memory enabled (https://github.com/google/sanitizers/issues/1614#issuecomment-2010316781):

```
$ sudo sysctl vm.mmap_rnd_bits=28
```

Install Numpy under pypy3 (this is a bit hacky, pypy does not support NumPy 1.x which is the default on Ubuntu 24.04):

```
$ wget https://bootstrap.pypa.io/get-pip.py
$ pypy3 get-pip.py --break-system-packages
$ sudo pypy3 -m pip install numpy>=2.0 --break-system-packages
```
