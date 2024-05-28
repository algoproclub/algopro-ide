package main

import (
	"bytes"
	"context"
	"io"
	"log/slog"
	"net/http"
	"os"
	"strings"
	"testing/iotest"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	"github.com/mraron/njudge/pkg/language"
	"github.com/mraron/njudge/pkg/language/langs/cpp"
	_ "github.com/mraron/njudge/pkg/language/langs/java"
	_ "github.com/mraron/njudge/pkg/language/langs/pypy3"
	"github.com/mraron/njudge/pkg/language/memory"
	slogecho "github.com/samber/slog-echo"

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

type ExecuteRequest struct {
	Language string `json:"language"`
	Filename string `json:"filename"`
	Source   []byte `json:"source"`
	Input    []byte `json:"input"`
}

func (req ExecuteRequest) Run(ctx context.Context, sp sandbox.Provider) (*ExecuteResponse, error) {
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
		return &ExecuteResponse{
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

	return &ExecuteResponse{
		Compiled:       true,
		CompilerOutput: compileError.String(),

		Verdict: status.Verdict,
		Output:  stdout.String(),
		Stderr:  stderr.String(),
		Memory:  int(status.Memory / memory.KB),
		Time:    status.Time,
	}, nil

}

type ExecuteResponse struct {
	Compiled       bool   `json:"compiled"`
	CompilerOutput string `json:"compiler_output"`

	Verdict sandbox.Verdict `json:"verdict"`
	Output  string          `json:"output"`
	Stderr  string          `json:"stderr"`
	Memory  int             `json:"memory"`
	Time    time.Duration   `json:"time"`
}

func main() {
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, nil)))

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

	e := echo.New()
	e.Use(slogecho.New(slog.Default()))
	e.Use(middleware.Recover())
	e.POST("/execute", func(c echo.Context) error {
		req := ExecuteRequest{}
		if err := c.Bind(&req); err != nil {
			return err
		}

		slog.Info("got request", "req", req, "source", string(req.Source))

		resp, err := req.Run(c.Request().Context(), sp)
		if err != nil {
			return err
		}

		slog.Info("got response", "req", req, "resp", resp)

		return c.JSON(http.StatusOK, resp)
	})
	e.Logger.Fatal(e.Start(":" + Port))
}
