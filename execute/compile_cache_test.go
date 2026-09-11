package main

import (
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/mraron/njudge/pkg/language"
	"github.com/mraron/njudge/pkg/language/sandbox"
)

func testCache(t *testing.T, maxSize int64) *CompileCache {
	t.Helper()

	cache, err := NewCompileCache(t.TempDir(), maxSize)
	if err != nil {
		t.Fatal(err)
	}
	return cache
}

func compileBytes(b string) func() (compileCacheData, error) {
	return func() (compileCacheData, error) {
		return compileCacheData{compiled: true, binaryName: "a.out", binary: []byte(b)}, nil
	}
}

func TestCompileCacheKey(t *testing.T) {
	cache := testCache(t, 100)
	req := Request{Language: "cpp", Filename: "main.cpp", Source: "int main() {}"}
	key := cache.KeyForRequest(req)
	if len(key) != 64 {
		t.Fatalf("cache key length = %d, want 64", len(key))
	}

	if key != cache.KeyForRequest(req) {
		t.Fatal("cache key should be stable")
	}

	req.Source = "int main() { return 1; }"
	if key == cache.KeyForRequest(req) {
		t.Fatal("cache key should include source")
	}

	req.Source = "int main() {}"
	req.Filename = "solution.cpp"
	if key == cache.KeyForRequest(req) {
		t.Fatal("cache key should include filename")
	}

	if cache.KeyForRequest(Request{Language: "a", Filename: "bc"}) ==
		cache.KeyForRequest(Request{Language: "ab", Filename: "c"}) {
		t.Fatal("cache key fields should be framed")
	}
}

func TestCompileCacheCoalescesConcurrentCompiles(t *testing.T) {
	cache := testCache(t, 100)

	var calls atomic.Int32
	var wg sync.WaitGroup
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			artifact, err := cache.getOrCompile(context.Background(), "same", func() (compileCacheData, error) {
				calls.Add(1)
				time.Sleep(10 * time.Millisecond)
				return compileCacheData{compiled: true, binary: []byte("binary")}, nil
			})
			if err != nil {
				t.Error(err)
				return
			}
			got, _ := io.ReadAll(artifact.Binary.Source)
			if string(got) != "binary" {
				t.Errorf("got %q", got)
			}
		}()
	}
	wg.Wait()

	if calls.Load() != 1 {
		t.Fatalf("compiled %d times", calls.Load())
	}
}

func TestCompileCacheEvictsLRU(t *testing.T) {
	cache := testCache(t, 10)

	_, err := cache.getOrCompile(context.Background(), "first", compileBytes("1111"))
	if err != nil {
		t.Fatal(err)
	}
	firstDir := cache.entries["first"].dir
	time.Sleep(time.Millisecond)

	_, err = cache.getOrCompile(context.Background(), "second", compileBytes("2222"))
	if err != nil {
		t.Fatal(err)
	}
	secondDir := cache.entries["second"].dir
	time.Sleep(time.Millisecond)

	if _, err = cache.getOrCompile(context.Background(), "first", compileBytes("nope")); err != nil {
		t.Fatal(err)
	}
	time.Sleep(time.Millisecond)

	if _, err = cache.getOrCompile(context.Background(), "third", compileBytes("3333")); err != nil {
		t.Fatal(err)
	}

	if _, ok := cache.entries["first"]; !ok {
		t.Fatal("first should still be cached")
	}
	if _, ok := cache.entries["second"]; ok {
		t.Fatal("second should have been evicted")
	}
	if _, ok := cache.entries["third"]; !ok {
		t.Fatal("third should be cached")
	}
	if _, err := os.Stat(firstDir); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(secondDir); !os.IsNotExist(err) {
		t.Fatalf("second dir still exists: %v", err)
	}
}

func readArtifact(t *testing.T, artifact *CompiledArtifact) string {
	t.Helper()
	defer artifact.Binary.Source.Close()
	data, err := io.ReadAll(artifact.Binary.Source)
	if err != nil {
		t.Fatal(err)
	}
	return string(data)
}

func TestCompileCacheRecoversFromUnreadableEntry(t *testing.T) {
	cache := testCache(t, 100)
	if _, err := cache.getOrCompile(context.Background(), "key", compileBytes("old")); err != nil {
		t.Fatal(err)
	}
	entry := cache.entries["key"]
	if err := os.Remove(filepath.Join(entry.dir, compileCacheBinaryName)); err != nil {
		t.Fatal(err)
	}

	artifact, err := cache.getOrCompile(context.Background(), "key", compileBytes("new"))
	if err != nil {
		t.Fatal(err)
	}
	if got := readArtifact(t, artifact); got != "new" {
		t.Fatalf("got %q", got)
	}
}

func TestCompileCacheContinuesWhenStoreFails(t *testing.T) {
	cache := testCache(t, 100)
	cache.dir = filepath.Join(t.TempDir(), "missing")

	artifact, err := cache.getOrCompile(context.Background(), "key", compileBytes("binary"))
	if err != nil {
		t.Fatal(err)
	}
	if got := readArtifact(t, artifact); got != "binary" {
		t.Fatalf("got %q", got)
	}
}

func TestCompileCacheStoresCompilerOutputOnDisk(t *testing.T) {
	cache := testCache(t, 100)
	var calls atomic.Int32
	compile := func() (compileCacheData, error) {
		calls.Add(1)
		return compileCacheData{
			compiled:       true,
			compilerOutput: "warning",
			binaryName:     "a.out",
			binary:         []byte("binary"),
		}, nil
	}
	if _, err := cache.getOrCompile(context.Background(), "key", compile); err != nil {
		t.Fatal(err)
	}

	entry := cache.entries["key"]
	output, err := os.ReadFile(filepath.Join(entry.dir, compileCacheOutputName))
	if err != nil {
		t.Fatal(err)
	}
	if string(output) != "warning" {
		t.Fatalf("compiler output = %q", output)
	}

	artifact, err := cache.getOrCompile(context.Background(), "key", compile)
	if err != nil {
		t.Fatal(err)
	}
	if calls.Load() != 1 || artifact.CompilerOutput != "warning" {
		t.Fatalf("calls = %d, compiler output = %q", calls.Load(), artifact.CompilerOutput)
	}
}

type fakeLanguage struct {
	language.Language
	name   string
	output string
	err    error
}

func (l fakeLanguage) Compile(
	_ context.Context,
	_ sandbox.Sandbox,
	source sandbox.File,
	stderr io.Writer,
	_ []sandbox.File,
) (*sandbox.File, error) {
	defer source.Source.Close()
	_, _ = io.WriteString(stderr, l.output)
	if l.err != nil {
		return nil, fmt.Errorf("compile: %w", l.err)
	}
	return &sandbox.File{
		Name:   l.name,
		Source: io.NopCloser(strings.NewReader("binary")),
	}, nil
}

func TestCompileSourceLimitsOutputAndPreservesName(t *testing.T) {
	data, err := compileSource(
		context.Background(),
		Request{Filename: "main.fake", Source: "source"},
		nil,
		fakeLanguage{
			name:   "Main.class",
			output: strings.Repeat("x", int(CompilerOutputLimit)+1),
		},
	)
	if err != nil {
		t.Fatal(err)
	}
	if data.binaryName != "Main.class" {
		t.Fatalf("binary name = %q", data.binaryName)
	}
	if len(data.compilerOutput) != int(CompilerOutputLimit) {
		t.Fatalf("compiler output length = %d", len(data.compilerOutput))
	}
}

func TestCompileSourcePropagatesArtifactLimit(t *testing.T) {
	_, err := compileSource(
		context.Background(),
		Request{Filename: "main.fake", Source: "source"},
		nil,
		fakeLanguage{err: sandbox.ErrFileTooLarge},
	)
	if !errors.Is(err, sandbox.ErrFileTooLarge) {
		t.Fatalf("got %v", err)
	}
}

func TestCompileCacheTimesOut(t *testing.T) {
	previousTimeout := CompileTimeout
	CompileTimeout = 5 * time.Millisecond
	t.Cleanup(func() { CompileTimeout = previousTimeout })

	cache := testCache(t, 100)
	_, err := cache.Compile(
		context.Background(),
		Request{Filename: "main.fake", Source: "source"},
		sandbox.NewProvider(),
		fakeLanguage{},
	)
	if !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("got %v", err)
	}
}
