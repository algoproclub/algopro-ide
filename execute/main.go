package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net"
	"net/http"
	"os"
	"regexp"
	"strings"
	"testing/iotest"
	"time"

	firebase "firebase.google.com/go/v4"
	"firebase.google.com/go/v4/auth"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"github.com/mraron/njudge/pkg/language"
	"github.com/mraron/njudge/pkg/language/langs/cpp"
	_ "github.com/mraron/njudge/pkg/language/langs/java"
	_ "github.com/mraron/njudge/pkg/language/langs/pypy3"
	"github.com/mraron/njudge/pkg/language/memory"
	"github.com/mraron/njudge/pkg/language/sandbox"
	"google.golang.org/api/option"
)

var (
	Port        = "1235"
	TimeLimit   = 5 * time.Second
	MemoryLimit = 128 * memory.MiB

	StdoutLimit         = 5000 * memory.Byte
	StderrLimit         = 10000 * memory.Byte
	InputLimit          = 5000 * memory.Byte
	BodyLimit           = 100000 * memory.Byte
	PCHCacheDir         = "/tmp/execute-server/pch"
	CompileCacheDir     = "/tmp/execute-server/compile-cache"
	CompileCacheMaxSize = int64(memory.GB)

	CompileArtifactLimit = int64(64 * memory.MiB)
	CompilerOutputLimit  = int64(64 * memory.KiB)
	CompileTimeout       = 30 * time.Second

	CppArgs             = strings.Fields("-std=c++20 -O2 -Wall -Wextra -Wshadow -Wfloat-equal -Wduplicated-cond -Wlogical-op -Wno-sign-compare -fsanitize=undefined -fsanitize=address -fno-sanitize-recover=all -g -DONLINE_JUDGE -fdiagnostics-color=always -fdiagnostics-urls=always")
	JavaFilenamePattern = regexp.MustCompile(`^[A-Za-z_$][A-Za-z0-9_$]*\.java$`)
)

func mustLanguage(l language.Language, err error) language.Language {
	if err != nil {
		panic(err)
	}
	return l
}

var Languages = map[string]language.Language{
	"cpp": cpp.New(
		"cpp20",
		"C++ 20",
		cpp.WithCompileArgs(CppArgs),
		cpp.WithPCHCache(PCHCacheDir, int64(256*memory.MiB)),
		cpp.WithMaxArtifactSize(CompileArtifactLimit),
	),
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
	Source   string `json:"source"`
	Input    string `json:"input"`
}

func (req Request) Valid() bool {
	switch req.Language {
	case "cpp":
		return req.Filename == "main.cpp"
	case "py":
		return req.Filename == "main.py"
	case "java":
		return len(req.Filename) <= 128 && JavaFilenamePattern.MatchString(req.Filename)
	}
	return false
}

func (req Request) InputWithinLimit() bool {
	return int64(len([]byte(req.Input))) <= int64(InputLimit)
}

func withSandbox[T any](ctx context.Context, sp sandbox.Provider, run func(sandbox.Sandbox) (T, error)) (result T, err error) {
	sbox, err := sp.Get(ctx)
	if err != nil {
		return result, err
	}
	if err := sbox.Init(ctx); err != nil {
		sp.Put(sbox)
		return result, err
	}
	defer func() {
		err = errors.Join(err, sbox.Cleanup(context.Background()))
		sp.Put(sbox)
	}()
	return run(sbox)
}

func (req Request) Run(ctx context.Context, sp sandbox.Provider, compileCache *CompileCache) (*Response, error) {
	lang := Languages[req.Language]
	if compileCache != nil && req.Language == "cpp" {
		artifact, err := compileCache.Compile(ctx, req, sp, lang)
		if err != nil {
			return nil, err
		}
		if !artifact.Compiled {
			return &Response{
				Compiled:       false,
				CompilerOutput: artifact.CompilerOutput,
				Verdict:        sandbox.VerdictCE,
			}, nil
		}
		return withSandbox(ctx, sp, func(sbox sandbox.Sandbox) (*Response, error) {
			return req.runCompiled(ctx, sbox, lang, artifact)
		})
	}

	return withSandbox(ctx, sp, func(sbox sandbox.Sandbox) (*Response, error) {
		data, err := compileSource(ctx, req, sbox, lang)
		if err != nil {
			return nil, err
		}
		artifact := newCompiledArtifact(data)
		if !artifact.Compiled {
			return &Response{
				Compiled:       false,
				CompilerOutput: artifact.CompilerOutput,
				Verdict:        sandbox.VerdictCE,
			}, nil
		}
		return req.runCompiled(ctx, sbox, lang, artifact)
	})
}

func (req Request) runCompiled(ctx context.Context, sbox sandbox.Sandbox, lang language.Language, artifact *CompiledArtifact) (*Response, error) {
	stdout := &bytes.Buffer{}
	stdoutLimiter := iotest.TruncateWriter(stdout, int64(StdoutLimit))

	stderr := &bytes.Buffer{}
	stderrLimiter := iotest.TruncateWriter(stderr, int64(StderrLimit))

	runSandbox := SandboxWithErrorStream{
		// detect_stack_use_after_return=0 is a workaround for https://github.com/algoproclub/algopro-ide/issues/330
		Sandbox: SandboxWithEnvs{
			Sandbox: sbox,
			Envs:    []string{"ASAN_OPTIONS=detect_leaks=0:detect_stack_use_after_return=0"},
		},
		ErrorStream: stderrLimiter,
	}
	status, err := lang.Run(
		ctx,
		runSandbox,
		*artifact.Binary,
		strings.NewReader(req.Input),
		stdoutLimiter, TimeLimit, MemoryLimit)
	if err != nil {
		return nil, err
	}

	return &Response{
		Compiled:       true,
		CompilerOutput: artifact.CompilerOutput,

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

type TokenVerifier interface {
	VerifyIDToken(ctx context.Context, idToken string) (*auth.Token, error)
}

type MultiProjectTokenVerifier struct {
	verifiers []TokenVerifier
}

func (v MultiProjectTokenVerifier) VerifyIDToken(ctx context.Context, idToken string) (*auth.Token, error) {
	var lastErr error
	for _, verifier := range v.verifiers {
		token, err := verifier.VerifyIDToken(ctx, idToken)
		if err == nil {
			return token, nil
		}
		lastErr = err
	}
	if lastErr != nil {
		return nil, lastErr
	}
	return nil, errors.New("no Firebase projects configured")
}

type Server struct {
	logger         *slog.Logger
	sp             sandbox.Provider
	tokenVerifier  TokenVerifier
	allowedOrigins []string
	compileCache   *CompileCache
}

func parseAllowedOrigins() []string {
	origins := strings.Split(os.Getenv("EXECUTE_ALLOWED_ORIGINS"), ",")
	if len(origins) == 1 && origins[0] == "" {
		return []string{"http://localhost:3000"}
	}

	for i := range origins {
		origins[i] = strings.TrimSpace(origins[i])
	}
	return origins
}

func parseFirebaseProjectIDs() []string {
	projectIDs := strings.Split(os.Getenv("FIREBASE_PROJECT_IDS"), ",")
	if len(projectIDs) == 1 && projectIDs[0] == "" {
		projectID := os.Getenv("FIREBASE_PROJECT_ID")
		if projectID == "" {
			projectID = "algopro-app"
		}
		projectIDs = []string{projectID}
	}

	seen := map[string]bool{}
	uniqueProjectIDs := make([]string, 0, len(projectIDs))
	for _, projectID := range projectIDs {
		projectID = strings.TrimSpace(projectID)
		if projectID == "" || seen[projectID] {
			continue
		}
		seen[projectID] = true
		uniqueProjectIDs = append(uniqueProjectIDs, projectID)
	}
	return uniqueProjectIDs
}

func newTokenVerifier(ctx context.Context) (TokenVerifier, error) {
	projectIDs := parseFirebaseProjectIDs()
	verifiers := make([]TokenVerifier, 0, len(projectIDs))
	for _, projectID := range projectIDs {
		app, err := firebase.NewApp(ctx, &firebase.Config{ProjectID: projectID}, option.WithoutAuthentication())
		if err != nil {
			return nil, err
		}
		client, err := app.Auth(ctx)
		if err != nil {
			return nil, err
		}
		verifiers = append(verifiers, client)
	}
	return MultiProjectTokenVerifier{verifiers: verifiers}, nil
}

func (s Server) originAllowed(origin string) bool {
	for _, allowedOrigin := range s.allowedOrigins {
		if allowedOrigin == origin {
			return true
		}
	}
	return false
}

func (s Server) WithCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin != "" {
			if !s.originAllowed(origin) {
				w.WriteHeader(http.StatusForbidden)
				return
			}
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Vary", "Origin")
			w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
			w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
		}

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func (s Server) verifyFirebaseToken(ctx context.Context, authHeader string) error {
	if s.tokenVerifier == nil {
		return nil
	}

	token := strings.TrimSpace(strings.TrimPrefix(authHeader, "Bearer "))
	if token == "" || token == authHeader {
		return errors.New("missing bearer token")
	}

	_, err := s.tokenVerifier.VerifyIDToken(ctx, token)
	return err
}

func (s Server) PostExecute(w http.ResponseWriter, r *http.Request) {
	if err := s.verifyFirebaseToken(r.Context(), r.Header.Get("Authorization")); err != nil {
		http.Error(w, "missing or invalid Firebase ID token", http.StatusUnauthorized)
		return
	}

	if !strings.HasPrefix(r.Header.Get("Content-Type"), "application/json") {
		w.WriteHeader(http.StatusBadRequest)
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, int64(BodyLimit))
	body, err := io.ReadAll(r.Body)
	if err != nil {
		var maxBytesError *http.MaxBytesError
		if errors.As(err, &maxBytesError) {
			http.Error(w, "request body is too large", http.StatusRequestEntityTooLarge)
			return
		}
		w.WriteHeader(http.StatusBadRequest)
		return
	}
	req := Request{}
	if err := json.Unmarshal(body, &req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		return
	}
	if !req.Valid() {
		w.WriteHeader(http.StatusBadRequest)
		return
	}
	if !req.InputWithinLimit() {
		http.Error(w, "input is too large", http.StatusRequestEntityTooLarge)
		return
	}

	s.logger.Info(
		"got request",
		"language", req.Language,
		"filename", req.Filename,
	)

	resp, err := req.Run(r.Context(), s.sp, s.compileCache)
	if err != nil {
		if errors.Is(err, sandbox.ErrFileTooLarge) {
			http.Error(w, "compiled artifact is too large", http.StatusRequestEntityTooLarge)
			return
		}
		w.WriteHeader(http.StatusInternalServerError)
		return
	}

	s.logger.Info("got response", "language", req.Language, "filename", req.Filename, "resp", resp)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(resp)
}

func main() {
	ctx := context.Background()
	if err := os.MkdirAll(PCHCacheDir, 0o755); err != nil {
		panic(err)
	}
	compileCache, err := NewCompileCache(
		CompileCacheDir,
		CompileCacheMaxSize,
	)
	if err != nil {
		panic(err)
	}

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

	tokenVerifier, err := newTokenVerifier(ctx)
	if err != nil {
		panic(err)
	}

	server := Server{
		logger:         slog.New(slog.NewJSONHandler(os.Stdout, nil)),
		sp:             sp,
		tokenVerifier:  tokenVerifier,
		allowedOrigins: parseAllowedOrigins(),
		compileCache:   compileCache,
	}

	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(server.WithCORS)

	r.Post("/execute", server.PostExecute)
	r.Options("/execute", func(w http.ResponseWriter, r *http.Request) {})

	http.ListenAndServe(net.JoinHostPort("0.0.0.0", Port), r)
}
