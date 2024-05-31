package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/mraron/njudge/pkg/language/sandbox"
	"github.com/stretchr/testify/assert"
)

var verbose = flag.Bool("verbose", false, "show req and resp")

func TestExecuteRequestRun(t *testing.T) {
	TimeLimit = 100 * time.Millisecond // hacky

	logger := slog.New(slog.NewJSONHandler(io.Discard, nil))
	if *verbose {
		logger = slog.Default()
	}

	sp := sandbox.NewProvider()
	s, err := sandbox.NewIsolate(255, sandbox.IsolateOptionUseLogger(logger))
	assert.NoError(t, err)
	sp.Put(s)
	tests := []struct {
		name    string
		req     Request
		wantErr bool

		checkOutput bool
		checkStderr bool
		resp        Response
	}{
		{
			name: "cpp_asan",
			req: Request{
				Language: "cpp",
				Filename: "main.cpp",
				Source: []byte(`#include <bits/stdc++.h>
using namespace std;

int main() {
	int t;
	cin>>t;
	while(t--){
		int n;
		cin>>n;
		vector<int> v(n);
		for(int i=0; i<n; i++) cin>>v[i];

	int kulomb = 1;
	for(int i=0; i<n; i++){
		if (v[i]==v[i-1]){
			v[i]++;
	}
	}
	for(int i=1; i<n; i++){
		if (v[i]=!v[i-1]){
			kulomb++;
	}
	}
	cout<<kulomb<<endl;
	}

	
}
`),
				Input: []byte(`5
				6
				1 2 2 2 5 6
				2
				4 4
				6
				1 1 3 4 4 5
				1
				1
				6
				1 1 1 2 2 2`),
			},
			wantErr: false,
			resp: Response{
				Compiled: true,
				Verdict:  sandbox.VerdictRE,
			},
		},
		{
			name: "py_error",
			req: Request{
				Language: "py",
				Filename: "main.py",
				Source:   []byte(`asdfdsf`),
			},
			wantErr: false,
			resp: Response{
				Compiled: true,
				Verdict:  sandbox.VerdictRE,
			},
		},
		{
			name: "cpp_compile_error",
			req: Request{
				Language: "cpp",
				Filename: "main.cpp",
				Source: []byte(`#include<iostream>
int main() {béla}`),
			},
			wantErr: false,
			resp: Response{
				Compiled: false,
				Verdict:  sandbox.VerdictCE,
			},
		},
		{
			name: "cpp_tl",
			req: Request{
				Language: "cpp",
				Filename: "main.cpp",
				Source: []byte(`#include<iostream>
int main() {
	while(1) std::cerr<<"teszt\n";
}`),
			},
			wantErr: false,
			resp: Response{
				Compiled: true,
				Verdict:  sandbox.VerdictTL,
			},
		},
		{
			name: "cpp_undefined",
			req: Request{
				Language: "cpp",
				Filename: "main.cpp",
				Source: []byte(`#include<iostream>
int main() {
	int x;
	std::cin>>x;
	std::cout<<x*x<<"\n";
}`),
				Input: []byte(`10000000`),
			},
			wantErr: false,
			resp: Response{
				Compiled: true,
				Verdict:  sandbox.VerdictRE,
			},
		},
		{
			name: "atleast_cpp17",
			req: Request{
				Language: "cpp",
				Filename: "main.cpp",
				Source: []byte(`#include<optional>
				int main() {
					std::optional<int> o;
					o = 23;
				}
				`),
			},
			wantErr: false,
			resp: Response{
				Compiled: true,
				Verdict:  sandbox.VerdictOK,
			},
		},
		{
			name: "has_output_stderr",
			req: Request{
				Language: "py",
				Filename: "main.py",
				Source: []byte(`import sys
print("hello vilag")
print("error", file=sys.stderr)`),
			},
			wantErr:     false,
			checkOutput: true,
			checkStderr: true,
			resp: Response{
				Compiled: true,
				Verdict:  sandbox.VerdictOK,
				Output:   "hello vilag\n",
				Stderr:   "error\n",
			},
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			assert.True(t, test.req.Valid())
			resp, err := test.req.Run(context.TODO(), sp)
			if test.wantErr {
				assert.NotNil(t, err)
			} else {
				assert.Nil(t, err)
			}
			assert.Equal(t, test.resp.Compiled, resp.Compiled)
			assert.Equal(t, test.resp.Verdict, resp.Verdict)
			if test.checkOutput {
				assert.Equal(t, test.resp.Output, resp.Output)
			}
			if test.checkStderr {
				assert.Equal(t, test.resp.Stderr, resp.Stderr)
			}

			logger.Info(fmt.Sprintf("run test %s", test.name), "req", test.req, "resp", resp)
		})
	}
}

func TestPostExecute(t *testing.T) {
	logger := slog.New(slog.NewJSONHandler(io.Discard, nil))
	if *verbose {
		logger = slog.Default()
	}

	sp := sandbox.NewProvider()
	s, err := sandbox.NewIsolate(255, sandbox.IsolateOptionUseLogger(logger))
	assert.NoError(t, err)
	sp.Put(s)

	server := Server{logger, sp}
	tests := []struct {
		name        string
		contentType string
		body        string

		wantStatusCode      int
		checkResponseBody   bool
		checkResponseOutput bool
		checkResponseStderr bool
		wantResponse        Response
	}{
		{
			name:           "empty_request",
			contentType:    "application/json",
			body:           "",
			wantStatusCode: http.StatusBadRequest,
		},
		{
			name:           "invalid_language",
			contentType:    "application/json",
			body:           `{"language": "cppp"}`,
			wantStatusCode: http.StatusBadRequest,
		},
		{
			name:           "no_filename",
			contentType:    "application/json",
			body:           `{"language": "cpp"}`,
			wantStatusCode: http.StatusBadRequest,
		},
		{
			name:           "no_filename",
			contentType:    "application/json",
			body:           `{"language": "cpp", "filename": "main.cpp"}`,
			wantStatusCode: http.StatusOK,
		},
		{
			name:        "hello_world_py",
			contentType: "application/json",
			//not a backdoor(tm)
			body:                `{"language": "py", "filename": "main.py", "source": "aW1wb3J0IHN5cwpwcmludCgiaGVsbG8gdmlsw6FnIikKcHJpbnQoInN0ZMOpcnIiLCBmaWxlPXN5cy5zdGRlcnIp"}`,
			wantStatusCode:      http.StatusOK,
			checkResponseBody:   true,
			checkResponseOutput: true,
			wantResponse: Response{
				Compiled: true,
				Verdict:  sandbox.VerdictOK,
				Output:   "hello világ\n",
				Stderr:   "stdérr\n",
			},
		},
		{
			name:                "aplusb_py",
			contentType:         "application/json",
			body:                `{"language": "py", "filename": "main.py", "source": "YSwgYiA9IG1hcChpbnQsIGlucHV0KCkuc3BsaXQoKSkKcHJpbnQoImVyZWRtw6luecO8bms6ICIrc3RyKGErYikp", "input": "IDEwICAgIDIwIA=="}`,
			wantStatusCode:      http.StatusOK,
			checkResponseBody:   true,
			checkResponseOutput: true,
			wantResponse: Response{
				Compiled: true,
				Verdict:  sandbox.VerdictOK,
				Output:   "eredményünk: 30\n",
			},
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodPost, "/execute", strings.NewReader(test.body))
			req.Header.Set("Content-Type", test.contentType)

			w := httptest.NewRecorder()
			server.PostExecute(w, req)
			res := w.Result()

			assert.Equal(t, test.wantStatusCode, res.StatusCode)
			if test.checkResponseBody {
				assert.True(t, strings.HasPrefix(res.Header.Get("Content-Type"), "application/json"), "Content-Type=%s", res.Header.Get("Content-Type"))
				resp := Response{}
				assert.Nil(t, json.NewDecoder(res.Body).Decode(&resp))
				assert.Equal(t, test.wantResponse.Compiled, resp.Compiled)
				assert.Equal(t, test.wantResponse.Verdict, resp.Verdict)
				if test.checkResponseOutput {
					assert.Equal(t, test.wantResponse.Output, resp.Output)
				}
				if test.checkResponseStderr {
					assert.Equal(t, test.wantResponse.Stderr, resp.Stderr)
				}
			}
		})
	}

}
