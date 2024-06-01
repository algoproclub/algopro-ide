package sanitizer

import (
	"regexp"
	"strconv"
	"strings"
)

type ErrorKind string

// These should be the most useful errors for the students
const (
	//ASAN errors
	IllegalMemoryAccess ErrorKind = "illegal_memory_access"

	//UBSan errors
	IntegerOverflow ErrorKind = "integer_overflow"
	DivisionByZero  ErrorKind = "division_by_zero"
	MissingReturn   ErrorKind = "missing_return"

	Other ErrorKind = "other"
)

type Error struct {
	Line   int       `json:"line"`
	Column int       `json:"column"`
	Kind   ErrorKind `json:"kind"`
}

var asanLineRegex = regexp.MustCompile(`#(\d*) 0x([0-9a-f]*) in main (.*).cpp:(\d*)`)
var ubsanRegex = regexp.MustCompile(`(.*).cpp:(\d+):(\d+): runtime error: (.+)`)

func ParseStderr(stderr string) (*Error, error) {
	if strings.Contains(stderr, "AddressSanitizer: heap-buffer-overflow") {
		res := Error{
			Line:   0,
			Column: 0,
			Kind:   IllegalMemoryAccess,
		}
		asanLineMatch := asanLineRegex.FindStringSubmatch(stderr)
		if len(asanLineMatch) > 0 {
			line, err := strconv.Atoi(asanLineMatch[4])
			if err != nil {
				return nil, err
			}
			res.Line = line
		}
		return &res, nil
	}

	ubsanMatch := ubsanRegex.FindStringSubmatch(stderr)
	if len(ubsanMatch) > 0 {
		line, err := strconv.Atoi(ubsanMatch[2])
		if err != nil {
			return nil, err
		}
		col, err := strconv.Atoi(ubsanMatch[3])
		if err != nil {
			return nil, err
		}

		res := Error{
			Line:   line,
			Column: col,
		}

		msg := ubsanMatch[4]
		if msg == "division by zero" {
			res.Kind = DivisionByZero
		} else if strings.HasPrefix(msg, "signed integer overflow") {
			res.Kind = IntegerOverflow
		} else if msg == "execution reached the end of a value-returning function without returning a value" {
			res.Kind = MissingReturn
		} else {
			res.Kind = Other
		}

		return &res, nil
	}

	return nil, nil
}
