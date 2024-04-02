package main

import (
	"bytes"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	"github.com/mraron/njudge/pkg/language"
	_ "github.com/mraron/njudge/pkg/language/langs/cpp"
	_ "github.com/mraron/njudge/pkg/language/langs/java"
	_ "github.com/mraron/njudge/pkg/language/langs/pypy3"
	"go.skia.org/infra/go/util/limitwriter"

	"github.com/mraron/njudge/pkg/language/sandbox"
)

var Languages = map[string]language.Language{
	"cpp":  language.DefaultStore.Get("cpp17"),
	"java": language.DefaultStore.Get("java"),
	"py":   language.DefaultStore.Get("pypy3"),
}

type ExecuteRequest struct {
	Language string `json:"language"`
	Filename string `json:"filename"`
	Source   []byte `json:"source"`
	Input    []byte `json:"input"`
}

func (req ExecuteRequest) Run(sp *language.SandboxProvider) (*ExecuteResponse, error) {
	sandbox, err := sp.Get()
	if err != nil {
		return nil, err
	}
	sandbox.Init(log.Default())
	defer func() {
		sandbox.Cleanup()
		sp.Put(sandbox)
	}()

	lang := Languages[req.Language]
	bin, compileError := &bytes.Buffer{}, &bytes.Buffer{}
	if err = lang.Compile(sandbox, language.File{
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
	stdoutLimiter := limitwriter.New(stdout, 5000)
	status, err := lang.Run(sandbox, bin, bytes.NewBuffer(req.Input), stdoutLimiter, 5*time.Second, 128*1024*1024)
	if err != nil {
		return nil, err
	}

	return &ExecuteResponse{
		Compiled:       true,
		CompilerOutput: "",

		Verdict: status.Verdict,
		Output:  stdout.String(),
		Stderr:  "not supported yet",
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
	sp := language.NewSandboxProvider()
	if os.Getenv("EXECUTE_DUMMY") != "" {
		for i := 0; i < 10; i++ {
			s := sandbox.NewDummy()
			sp.Put(s)
		}
	} else {
		for i := 0; i < 10; i++ {
			s := sandbox.NewIsolate(255 + i)
			sp.Put(s)
		}
	}

	e := echo.New()
	e.Use(middleware.Logger())
	e.POST("/execute", func(c echo.Context) error {
		req := ExecuteRequest{}
		if err := c.Bind(&req); err != nil {
			return err
		}
		fmt.Println(req.Filename, string(req.Input), req.Language, string(req.Source))

		resp, err := req.Run(sp)
		if err != nil {
			return err
		}
		fmt.Println(resp)
		return c.JSON(http.StatusOK, resp)
	})
	e.Logger.Fatal(e.Start(":1235"))
}
