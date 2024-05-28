package main

import (
	"context"
	"flag"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/mraron/njudge/pkg/language/sandbox"
	"github.com/stretchr/testify/assert"
)

var verbose = flag.Bool("verbose", false, "show req and resp")

func TestExecuteRequestRun(t *testing.T) {
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
		req     ExecuteRequest
		wantErr bool
		resp    ExecuteResponse
	}{
		{
			"cpp_asan",
			ExecuteRequest{
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
			false,
			ExecuteResponse{
				Compiled: true,
				Verdict:  sandbox.VerdictRE,
			},
		},
		{
			"py_error",
			ExecuteRequest{
				Language: "py",
				Filename: "main.py",
				Source:   []byte(`asdfdsf`),
			},
			false,
			ExecuteResponse{
				Compiled: true,
				Verdict:  sandbox.VerdictRE,
			},
		},
		{
			"cpp_compile_error",
			ExecuteRequest{
				Language: "cpp",
				Filename: "main.cpp",
				Source: []byte(`#include<iostream>
				int main() {béla}`),
			},
			false,
			ExecuteResponse{
				Compiled: false,
				Verdict:  sandbox.VerdictCE,
			},
		},
		{
			"cpp_tl",
			ExecuteRequest{
				Language: "cpp",
				Filename: "main.cpp",
				Source: []byte(`#include<iostream>
				int main() {
					while(1) std::cerr<<"teszt\n";
				}`),
			},
			false,
			ExecuteResponse{
				Compiled: true,
				Verdict:  sandbox.VerdictTL,
			},
		},
		{
			"cpp_undefined",
			ExecuteRequest{
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
			false,
			ExecuteResponse{
				Compiled: true,
				Verdict:  sandbox.VerdictRE,
			},
		},
		{
			`atleast_cpp17`,
			ExecuteRequest{
				Language: "cpp",
				Filename: "main.cpp",
				Source: []byte(`#include<optional>
				int main() {
					std::optional<int> o;
					o = 23;
				}
				`),
			},
			false,
			ExecuteResponse{
				Compiled: true,
				Verdict:  sandbox.VerdictOK,
			},
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			resp, err := test.req.Run(context.TODO(), sp)
			if test.wantErr {
				assert.NotNil(t, err)
			} else {
				assert.Nil(t, err)
			}
			assert.Equal(t, test.resp.Compiled, resp.Compiled)
			assert.Equal(t, test.resp.Verdict, resp.Verdict)
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
		name           string
		contentType    string
		body           string
		wantStatusCode int
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
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodPost, "/execute", strings.NewReader(test.body))
			req.Header.Set("Content-Type", test.contentType)
			w := httptest.NewRecorder()
			server.PostExecute(w, req)

			res := w.Result()
			assert.Equal(t, test.wantStatusCode, res.StatusCode)
		})
	}

}
