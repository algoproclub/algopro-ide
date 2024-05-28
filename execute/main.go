package main

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net"
	"net/http"
	"os"
	"strings"
	"testing/iotest"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"github.com/mraron/njudge/pkg/language"
	"github.com/mraron/njudge/pkg/language/langs/cpp"
	_ "github.com/mraron/njudge/pkg/language/langs/java"
	_ "github.com/mraron/njudge/pkg/language/langs/pypy3"
	"github.com/mraron/njudge/pkg/language/memory"
	"github.com/mraron/njudge/pkg/language/sandbox"
)

var (
	Port        = "1235"
	TimeLimit   = 5 * time.Second
	MemoryLimit = 128 * memory.MiB

	StdoutLimit = 5000 * memory.Byte
	StderrLimit = 5000 * memory.Byte

	CppArgs = strings.Fields("-std=c++17 -O2 -Wall -fsanitize=undefined -fsanitize=address -fno-sanitize-recover=all -g -DONLINE_JUDGE")
)

func mustLanguage(l language.Language, err error) language.Language {
	if err != nil {
		panic(err)
	}
	return l
}

var Languages = map[string]language.Language{
	"cpp":  cpp.New("cpp17", "C++ 17", cpp.WithCompileArgs(CppArgs)),
	"java": mustLanguage(language.DefaultStore.Get("java")),
	"py":   mustLanguage(language.DefaultStore.Get("pypy3")),
}

type SandboxWithErrorStream struct {
	sandbox.Sandbox
	ErrorStream io.Writer
}

func (s SandboxWithErrorStream) Run(ctx context.Context, config sandbox.RunConfig, toRun string, toRunArgs ...string) (*sandbox.Status, error) {
	config.Stderr = s.ErrorStream
	return s.Sandbox.Run(ctx, config, toRun, toRunArgs...)
}

type SandboxWithEnvs struct {
	sandbox.Sandbox
	Envs []string
}

func (s SandboxWithEnvs) Run(ctx context.Context, config sandbox.RunConfig, toRun string, toRunArgs ...string) (*sandbox.Status, error) {
	config.Env = append(config.Env, s.Envs...)
	return s.Sandbox.Run(ctx, config, toRun, toRunArgs...)
}

type Request struct {
	Language string `json:"language"`
	Filename string `json:"filename"`
	Source   []byte `json:"source"`
	Input    []byte `json:"input"`
}

func (req Request) Valid() bool {
	if _, ok := Languages[req.Language]; !ok {
		return false
	}
	if len(req.Filename) == 0 {
		return false
	}
	return true
}

func (req Request) Run(ctx context.Context, sp sandbox.Provider) (*Response, error) {
	sbox, err := sp.Get()
	if err != nil {
		return nil, err
	}

	sbox.Init(ctx)
	defer func(ctx context.Context) {
		sbox.Cleanup(ctx)
		sp.Put(sbox)
	}(ctx)

	lang := Languages[req.Language]
	var bin *sandbox.File
	compileError := &bytes.Buffer{}

	if bin, err = lang.Compile(ctx, sbox, sandbox.File{
		Name:   req.Filename,
		Source: io.NopCloser(bytes.NewBuffer(req.Source)),
	}, compileError, nil); err != nil {
		return &Response{
			Compiled:       false,
			CompilerOutput: compileError.String(),
			Verdict:        sandbox.VerdictCE,
		}, nil
	}

	stdout := &bytes.Buffer{}
	stdoutLimiter := iotest.TruncateWriter(stdout, int64(StdoutLimit))

	stderr := &bytes.Buffer{}
	stderrLimiter := iotest.TruncateWriter(stderr, int64(StderrLimit))

	runSandbox := SandboxWithErrorStream{
		Sandbox: SandboxWithEnvs{
			Sandbox: sbox,
			Envs:    []string{"ASAN_OPTIONS=detect_leaks=0"},
		},
		ErrorStream: stderrLimiter,
	}
	status, err := lang.Run(
		ctx,
		runSandbox,
		*bin,
		bytes.NewBuffer(req.Input),
		stdoutLimiter, TimeLimit, MemoryLimit)
	if err != nil {
		return nil, err
	}

	return &Response{
		Compiled:       true,
		CompilerOutput: compileError.String(),

		Verdict: status.Verdict,
		Output:  stdout.String(),
		Stderr:  stderr.String(),
		Memory:  int(status.Memory / memory.KB),
		Time:    status.Time,
	}, nil

}

type Response struct {
	Compiled       bool   `json:"compiled"`
	CompilerOutput string `json:"compiler_output"`

	Verdict sandbox.Verdict `json:"verdict"`
	Output  string          `json:"output"`
	Stderr  string          `json:"stderr"`
	Memory  int             `json:"memory"`
	Time    time.Duration   `json:"time"`
}

type Server struct {
	logger *slog.Logger
	sp     sandbox.Provider
}

func (s Server) PostExecute(w http.ResponseWriter, r *http.Request) {
	if !strings.HasPrefix(r.Header.Get("Content-Type"), "application/json") {
		w.WriteHeader(http.StatusBadRequest)
		return
	}

	req := Request{}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || !req.Valid() {
		w.WriteHeader(http.StatusBadRequest)
		return
	}

	s.logger.Info("got request", "req", req, "source", string(req.Source))

	resp, err := req.Run(r.Context(), s.sp)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		return
	}

	s.logger.Info("got response", "req", req, "resp", resp)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(resp)
}

func main() {
	sp := sandbox.NewProvider()
	if os.Getenv("EXECUTE_DUMMY") != "" {
		for i := 0; i < 10; i++ {
			s, err := sandbox.NewDummy()
			if err != nil {
				panic(err)
			}
			sp.Put(s)
		}
	} else {
		for i := 0; i < 2; i++ {
			s, err := sandbox.NewIsolate(255+i, sandbox.IsolateOptionUseLogger(slog.Default()))
			if err != nil {
				panic(err)
			}
			sp.Put(s)
		}
	}

	server := Server{
		logger: slog.New(slog.NewJSONHandler(os.Stdout, nil)),
		sp:     sp,
	}

	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)

	r.Post("/execute", server.PostExecute)

	http.ListenAndServe(net.JoinHostPort("0.0.0.0", Port), r)
}
