# execute

Communicates with the frontend through the `/api/execute/` NextJS api route.

Requirements:
* go 1.22
* isolate v1 installed:
   - install isolate from tag `v1.10.1` (for example using `git clone --depth 1 --branch v1.10.1 https://github.com/ioi/isolate`)
   - if not enabled, [enable cgroups v1](https://wiki.archlinux.org/title/cgroups#Enable_cgroup_v1)

## how to run

Build the binary (`go build`) and run with `./execute` (set the env var `EXECUTE_DUMMY` in order to use unsafe sandboxing)

## tests

`go test .` runs a collection of tests that have been collected from the students and teachers. 

Use `go test . -verbose` to view the request and response objects. 

## http server
listens on `:1235`

### POST /execute

request: 
* json body with fields: 
   * language: string, `"cpp"`, `"java"` or `"py"`
   * filename: string, filename from algopro ide (e.g. `main.cpp`)
   * source: string, base64 of the utf-8 encoded source code
   * input: string, base64 of the utf-8 encoded input data

responses:

* 500: 
   * when: undefined internal error happened (this shouldn't happen)
   * response body is undefined
* 400:
   * when: request is malformed
   * response body is undefined
* 200: 
   * when: successful execution (incl. compilation error, TL, RTE etc.)
   * json body with fields:
       * compiled: boolean
       * compiler_output: string
       * verdict: integer ([reference](https://pkg.go.dev/github.com/mraron/njudge@v0.5.0/pkg/language/sandbox#Verdict))
           * 1: OK
           * 2: time limit exceeded (>5secs)
           * 4: memory limit exceeded (>128MiB)
           * 8: runtime error
           * 16: internal error
           * 32: compilation error
       * output: string, the stdout produced by the program (max 5000 bytes)
       * stderr: string, the stderr produced by the program (including ASAN, max 5000 bytes)
       * memory: int, memory usage in KiBs
       * time: string, cpu time used in a [string format](https://pkg.go.dev/time#Duration.String)
