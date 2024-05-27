package main

import (
	"bytes"
	"fmt"
	"io"
	"log"
	"log/slog"
	"net/http"
	"os"
	"strings"
	"testing/iotest"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	"github.com/mraron/njudge/pkg/language"
	_ "github.com/mraron/njudge/pkg/language/langs/cpp"
	_ "github.com/mraron/njudge/pkg/language/langs/java"
	_ "github.com/mraron/njudge/pkg/language/langs/pypy3"
	slogecho "github.com/samber/slog-echo"

	"github.com/mraron/njudge/pkg/language/sandbox"
)

type Cpp struct {
	id   string
	name string
	ver  string
}

func (c Cpp) Id() string {
	return c.id
}

func (c Cpp) Name() string {
	return c.name
}

func (c Cpp) DefaultFileName() string {
	return "main.cpp"
}

func (c Cpp) Compile(s language.Sandbox, r language.File, w io.Writer, e io.Writer, extras []language.File) error {
	err := s.CreateFile("main.cpp", r.Source)
	if err != nil {
		return err
	}

	params := "main.cpp"
	for _, f := range extras {
		err := s.CreateFile(f.Name, f.Source)
		if err != nil {
			return err
		}

		if !strings.HasSuffix(f.Name, ".h") {
			params += " "
			params += f.Name
		}
	}

	errorStream := &bytes.Buffer{}
	if _, err := s.SetMaxProcesses(200).
		Env().TimeLimit(10*time.Second).
		MemoryLimit(2560000).Stdout(errorStream).
		Stderr(e).WorkingDirectory(s.Pwd()).
		Run("/usr/bin/g++ -std="+c.ver+" -O2 -Wall -fsanitize=undefined -fsanitize=address -fno-sanitize-recover=all -g -DONLINE_JUDGE "+params, false); err != nil {
		e.Write(errorStream.Bytes())
		return err
	}

	bin, err := s.GetFile("a.out")
	if err != nil {
		return err
	}

	_, err = io.Copy(w, bin)
	return err
}

func (Cpp) Run(s language.Sandbox, binary, stdin io.Reader, stdout io.Writer, tl time.Duration, ml int) (language.Status, error) {
	stat := language.Status{}
	stat.Verdict = language.VerdictXX

	if err := s.CreateFile("a.out", binary); err != nil {
		return stat, err
	}

	if err := s.MakeExecutable("a.out"); err != nil {
		return stat, err
	}

	return s.Stdin(stdin).Stdout(stdout).TimeLimit(tl).MemoryLimit(ml/1024).Run("a.out", true)
}

func (c Cpp) Test(s language.Sandbox) error {
	return nil
}

type SandboxProvider struct {
	sandboxes chan language.Sandbox
}

func NewSandboxProvider(size int) *SandboxProvider {
	return &SandboxProvider{make(chan language.Sandbox, size)}
}

func (sp *SandboxProvider) Get() language.Sandbox {
	return <-sp.sandboxes
}

func (sp *SandboxProvider) Put(s language.Sandbox) {
	sp.sandboxes <- s
}

var Languages = map[string]language.Language{
	"cpp":  Cpp{"cpp17", "C++17", "c++17"},
	"java": language.DefaultStore.Get("java"),
	"py":   language.DefaultStore.Get("pypy3"),
}

type ExecuteRequest struct {
	Language string `json:"language"`
	Filename string `json:"filename"`
	Source   []byte `json:"source"`
	Input    []byte `json:"input"`
}

func (req ExecuteRequest) Run(sp *SandboxProvider) (*ExecuteResponse, error) {
	sandbox := sp.Get()

	sandbox.Init(log.Default())
	defer func() {
		sandbox.Cleanup()
		sp.Put(sandbox)
	}()

	lang := Languages[req.Language]
	bin, compileError := &bytes.Buffer{}, &bytes.Buffer{}
	sandbox.AddArg("-s")
	if err := lang.Compile(sandbox, language.File{
		Name:   req.Filename,
		Source: bytes.NewBuffer(req.Source),
	}, bin, compileError, nil); err != nil {
		fmt.Println(err.Error())
		return &ExecuteResponse{
			Compiled:       false,
			CompilerOutput: compileError.String(),
			Verdict:        language.VerdictCE,
		}, nil
	}

	stdout := &bytes.Buffer{}
	stderr := &bytes.Buffer{}
	stdoutLimiter := iotest.TruncateWriter(stdout, 5000)
	stderrLimiter := iotest.TruncateWriter(stderr, 5000)

	sandbox.Stderr(stderrLimiter). /*.AddArg("-s")*/ SetEnv("ASAN_OPTIONS=detect_leaks=0")
	status, err := lang.Run(sandbox, bin, bytes.NewBuffer(req.Input), stdoutLimiter, 5*time.Second, 128*1024*1024)
	if err != nil {
		return nil, err
	}

	return &ExecuteResponse{
		Compiled:       true,
		CompilerOutput: compileError.String(),

		Verdict: status.Verdict,
		Output:  stdout.String(),
		Stderr:  stderr.String(),
		Memory:  status.Memory,
		Time:    status.Time,
	}, nil

}

type ExecuteResponse struct {
	Compiled       bool   `json:"compiled"`
	CompilerOutput string `json:"compiler_output"`

	Verdict language.Verdict `json:"verdict"`
	Output  string           `json:"output"`
	Stderr  string           `json:"stderr"`
	Memory  int              `json:"memory"`
	Time    time.Duration    `json:"time"`
}

func main() {
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, nil)))

	sp := NewSandboxProvider(10)
	if os.Getenv("EXECUTE_DUMMY") != "" {
		for i := 0; i < 10; i++ {
			s := sandbox.NewDummy()
			sp.Put(s)
		}
	} else {
		for i := 0; i < 2; i++ {
			s := NewIsolate(255 + i)
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

		resp, err := req.Run(sp)
		if err != nil {
			return err
		}

		slog.Info("got response", "req", req, "resp", resp)

		return c.JSON(http.StatusOK, resp)
	})
	e.Logger.Fatal(e.Start(":1235"))
}
