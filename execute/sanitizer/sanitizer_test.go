package sanitizer_test

import (
	"os"
	"testing"

	"github.com/algopro/algopro-ide/execute/sanitizer"
	"github.com/stretchr/testify/assert"
)

func mustReadFile(name string) []byte {
	res, err := os.ReadFile(name)
	if err != nil {
		panic(err)
	}
	return res
}

func TestStderr(t *testing.T) {
	tests := []struct {
		name     string
		stderr   string
		checkRes bool
		res      *sanitizer.Error
		errFunc  assert.ErrorAssertionFunc
	}{
		{
			name:     "div_by_zero",
			stderr:   string(mustReadFile("testdata/div_by_zero.txt")),
			checkRes: true,
			res: &sanitizer.Error{
				Line:   4,
				Column: 13,
				Kind:   sanitizer.DivisionByZero,
			},
			errFunc: assert.NoError,
		},
		{
			name:     "illegal_memory_read",
			stderr:   string(mustReadFile("testdata/illegal_memory_read.txt")),
			checkRes: true,
			res: &sanitizer.Error{
				Line:   7,
				Column: 0,
				Kind:   sanitizer.IllegalMemoryAccess,
			},
			errFunc: assert.NoError,
		},
		{
			name:     "illegal_memory_write",
			stderr:   string(mustReadFile("testdata/illegal_memory_write.txt")),
			checkRes: true,
			res: &sanitizer.Error{
				Line:   7,
				Column: 0,
				Kind:   sanitizer.IllegalMemoryAccess,
			},
			errFunc: assert.NoError,
		},
		{
			name:     "int32_overflow",
			stderr:   string(mustReadFile("testdata/int32_overflow.txt")),
			checkRes: true,
			res: &sanitizer.Error{
				Line:   5,
				Column: 18,
				Kind:   sanitizer.IntegerOverflow,
			},
			errFunc: assert.NoError,
		},
		{
			name:     "int64_overflow",
			stderr:   string(mustReadFile("testdata/int64_overflow.txt")),
			checkRes: true,
			res: &sanitizer.Error{
				Line:   5,
				Column: 15,
				Kind:   sanitizer.IntegerOverflow,
			},
			errFunc: assert.NoError,
		},
		{
			name:     "int32_underflow",
			stderr:   string(mustReadFile("testdata/int32_underflow.txt")),
			checkRes: true,
			res: &sanitizer.Error{
				Line:   7,
				Column: 19,
				Kind:   sanitizer.IntegerOverflow,
			},
			errFunc: assert.NoError,
		},
		{
			name:     "missing_return",
			stderr:   string(mustReadFile("testdata/missing_return.txt")),
			checkRes: true,
			res: &sanitizer.Error{
				Line:   3,
				Column: 5,
				Kind:   sanitizer.MissingReturn,
			},
			errFunc: assert.NoError,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			res, err := sanitizer.ParseStderr(test.stderr)
			test.errFunc(t, err)
			if test.checkRes {
				assert.Equal(t, test.res, res)
			}
		})
	}
}
