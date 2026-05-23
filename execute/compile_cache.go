package main

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/binary"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing/iotest"
	"time"

	"github.com/mraron/njudge/pkg/language"
	"github.com/mraron/njudge/pkg/language/sandbox"
	"golang.org/x/sync/singleflight"
)

const (
	compileCacheBinaryName = "a.out"
	compileCacheOutputName = "compiler-output"
)

type CompiledArtifact struct {
	Compiled       bool
	CompilerOutput string
	Binary         *sandbox.File
}

type compileCacheData struct {
	compiled       bool
	compilerOutput string
	binaryName     string
	binary         []byte
}

type CompileCacheEntry struct {
	dir        string
	size       int64
	lastAccess time.Time
	readers    int
	evicted    bool
}

type CompileCache struct {
	dir     string
	maxSize int64

	mu        sync.Mutex
	totalSize int64
	entries   map[string]*CompileCacheEntry
	compiles  singleflight.Group
}

func NewCompileCache(dir string, maxSize int64) (*CompileCache, error) {
	if maxSize < 1 {
		return nil, fmt.Errorf("compile cache max size must be positive")
	}
	if err := os.RemoveAll(dir); err != nil {
		return nil, err
	}
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, err
	}

	return &CompileCache{
		dir:     dir,
		maxSize: maxSize,
		entries: map[string]*CompileCacheEntry{},
	}, nil
}

func (c *CompileCache) KeyForRequest(req Request) string {
	h := sha256.New()
	writeCacheKeyPart(h, req.Language)
	writeCacheKeyPart(h, req.Filename)
	writeCacheKeyPart(h, req.Source)
	return fmt.Sprintf("%x", h.Sum(nil))
}

func writeCacheKeyPart(w io.Writer, value string) {
	var length [8]byte
	binary.LittleEndian.PutUint64(length[:], uint64(len(value)))
	_, _ = w.Write(length[:])
	_, _ = io.WriteString(w, value)
}

func (c *CompileCache) Compile(
	ctx context.Context,
	req Request,
	sp sandbox.Provider,
	lang language.Language,
) (*CompiledArtifact, error) {
	key := c.KeyForRequest(req)
	return c.getOrCompile(ctx, key, func() (compileCacheData, error) {
		compileCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), CompileTimeout)
		defer cancel()
		return withSandbox(compileCtx, sp, func(sbox sandbox.Sandbox) (compileCacheData, error) {
			return compileSource(compileCtx, req, sbox, lang)
		})
	})
}

func compileSource(ctx context.Context, req Request, sbox sandbox.Sandbox, lang language.Language) (compileCacheData, error) {
	compileOutput := &bytes.Buffer{}
	bin, err := lang.Compile(ctx, sbox, sandbox.File{
		Name:   req.Filename,
		Source: io.NopCloser(strings.NewReader(req.Source)),
	}, iotest.TruncateWriter(compileOutput, CompilerOutputLimit), nil)
	if err != nil {
		if errors.Is(err, sandbox.ErrFileTooLarge) {
			return compileCacheData{}, err
		}
		if ctx.Err() != nil {
			return compileCacheData{}, ctx.Err()
		}
		return compileCacheData{
			compiled:       false,
			compilerOutput: compileOutput.String(),
		}, nil
	}
	defer bin.Source.Close()

	binaryBytes, err := io.ReadAll(bin.Source)
	if err != nil {
		return compileCacheData{}, err
	}
	return compileCacheData{
		compiled:       true,
		compilerOutput: compileOutput.String(),
		binaryName:     bin.Name,
		binary:         binaryBytes,
	}, nil
}

func (c *CompileCache) getOrCompile(ctx context.Context, key string, compile func() (compileCacheData, error)) (*CompiledArtifact, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}

	resultCh := c.compiles.DoChan(key, func() (any, error) {
		if data, ok, err := c.get(key); ok {
			return data, nil
		} else if err != nil {
			slog.Warn("discarding unreadable compile cache entry", "key", key, "error", err)
		}

		data, err := compile()
		if err != nil {
			return nil, err
		}
		if data.compiled {
			if err := c.store(key, data); err != nil {
				slog.Warn("could not cache compiled artifact", "key", key, "error", err)
			}
		}
		return data, nil
	})

	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	case result := <-resultCh:
		if err := ctx.Err(); err != nil {
			return nil, err
		}
		if result.Err != nil {
			return nil, result.Err
		}
		data := result.Val.(compileCacheData)
		return newCompiledArtifact(data), nil
	}
}

func (c *CompileCache) get(key string) (compileCacheData, bool, error) {
	c.mu.Lock()
	entry, ok := c.entries[key]
	if ok {
		entry.lastAccess = time.Now()
		entry.readers++
	}
	c.mu.Unlock()
	if !ok {
		return compileCacheData{}, false, nil
	}

	data, readErr := entry.read()

	c.mu.Lock()
	entry.readers--
	if readErr != nil && c.entries[key] == entry {
		delete(c.entries, key)
		c.totalSize -= entry.size
		entry.evicted = true
	}
	remove := entry.evicted && entry.readers == 0
	c.mu.Unlock()

	if remove {
		if err := os.RemoveAll(entry.dir); err != nil {
			slog.Warn("could not remove compile cache entry", "dir", entry.dir, "error", err)
		}
	}
	return data, readErr == nil, readErr
}

func (c *CompileCache) store(key string, data compileCacheData) error {
	now := time.Now()
	entryDir, err := os.MkdirTemp(c.dir, key+"-")
	if err != nil {
		return err
	}
	stored := false
	defer func() {
		if !stored {
			_ = os.RemoveAll(entryDir)
		}
	}()

	entry := &CompileCacheEntry{
		dir:        entryDir,
		size:       int64(len(data.binary) + len(data.compilerOutput)),
		lastAccess: now,
	}
	if err := os.WriteFile(filepath.Join(entryDir, compileCacheBinaryName), data.binary, 0o700); err != nil {
		return err
	}
	if err := os.WriteFile(filepath.Join(entryDir, compileCacheOutputName), []byte(data.compilerOutput), 0o600); err != nil {
		return err
	}

	c.mu.Lock()
	c.entries[key] = entry
	c.totalSize += entry.size
	evicted := c.evictLRULocked()
	c.mu.Unlock()
	stored = true

	return removeCacheEntries(evicted)
}

func (c *CompileCache) evictLRULocked() []*CompileCacheEntry {
	var evicted []*CompileCacheEntry
	for c.totalSize > c.maxSize {
		var lruKey string
		var lruEntry *CompileCacheEntry
		for key, entry := range c.entries {
			if lruEntry == nil || entry.lastAccess.Before(lruEntry.lastAccess) {
				lruKey = key
				lruEntry = entry
			}
		}
		delete(c.entries, lruKey)
		c.totalSize -= lruEntry.size
		lruEntry.evicted = true
		if lruEntry.readers == 0 {
			evicted = append(evicted, lruEntry)
		}
	}
	return evicted
}

func removeCacheEntries(entries []*CompileCacheEntry) error {
	var err error
	for _, entry := range entries {
		err = errors.Join(err, os.RemoveAll(entry.dir))
	}
	return err
}

func newCompiledArtifact(data compileCacheData) *CompiledArtifact {
	artifact := &CompiledArtifact{
		Compiled:       data.compiled,
		CompilerOutput: data.compilerOutput,
	}
	if !data.compiled {
		return artifact
	}

	artifact.Binary = &sandbox.File{
		Name:   data.binaryName,
		Source: io.NopCloser(bytes.NewReader(data.binary)),
	}
	return artifact
}

func (entry *CompileCacheEntry) read() (compileCacheData, error) {
	binaryBytes, err := os.ReadFile(filepath.Join(entry.dir, compileCacheBinaryName))
	if err != nil {
		return compileCacheData{}, err
	}
	compilerOutput, err := os.ReadFile(filepath.Join(entry.dir, compileCacheOutputName))
	if err != nil {
		return compileCacheData{}, err
	}
	return compileCacheData{
		compiled:       true,
		compilerOutput: string(compilerOutput),
		binaryName:     compileCacheBinaryName,
		binary:         binaryBytes,
	}, nil
}
