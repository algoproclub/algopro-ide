package main

import (
	"context"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/mraron/njudge/pkg/language/memory"
	"github.com/mraron/njudge/pkg/language/sandbox"
)

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

type SandboxWithMemoryLimit struct {
	sandbox.Sandbox
	Limit memory.Amount
}

func (s SandboxWithMemoryLimit) Run(ctx context.Context, config sandbox.RunConfig, toRun string, toRunArgs ...string) (*sandbox.Status, error) {
	config.MemoryLimit = s.Limit
	return s.Sandbox.Run(ctx, config, toRun, toRunArgs...)
}

type SandboxPrecompileBits struct {
	sandbox.Sandbox
	pathToBits string
}

func (s SandboxPrecompileBits) Run(ctx context.Context, config sandbox.RunConfig, toRun string, toRunArgs ...string) (*sandbox.Status, error) {
	switch s.Sandbox.(type) {
	case *sandbox.Dummy:
		toRunArgs = append(toRunArgs, "-isystem", s.pathToBits)
	case *sandbox.Isolate:
		config.DirectoryMaps = append(config.DirectoryMaps, sandbox.DirectoryMap{
			Inside:  "/precompiled",
			Outside: s.pathToBits,
			Options: []sandbox.DirectoryMapOption{},
		})
		toRunArgs = append(toRunArgs, "-isystem", "/precompiled")
	}
	return s.Sandbox.Run(ctx, config, toRun, toRunArgs...)
}

func CreateTempPrecompiledBits() (string, error) {
	path, err := os.MkdirTemp("", "precompiled_bits")
	if err != nil {
		return "", err
	}

	bitsDir := filepath.Join(path, "bits")
	if err = os.Mkdir(bitsDir, 0755); err != nil {
		return "", err
	}
	f, err := os.Create(filepath.Join(bitsDir, "stdc++.h"))
	if err != nil {
		return "", err
	}
	_, err = f.WriteString("#include <bits/stdc++.h>\n")
	if err != nil {
		return "", err
	}
	if err = f.Close(); err != nil {
		return "", err
	}

	cmd := exec.Command("g++", append(strings.Fields("-c bits/stdc++.h -o bits/stdc++.h.gch"), CppArgs...)...)
	cmd.Dir = path
	return path, cmd.Run()
}
