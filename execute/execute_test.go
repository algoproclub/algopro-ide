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

	"firebase.google.com/go/v4/auth"
	"github.com/mraron/njudge/pkg/language/sandbox"
	"github.com/stretchr/testify/assert"
)

var verbose = flag.Bool("verbose", false, "show req and resp")

type fakeTokenVerifier struct{}

func (fakeTokenVerifier) VerifyIDToken(ctx context.Context, idToken string) (*auth.Token, error) {
	if idToken != "valid-token" {
		return nil, fmt.Errorf("invalid token")
	}
	return &auth.Token{UID: "test-user"}, nil
}

type fakeTokenVerifierForProject struct {
	projectID string
}

func (v fakeTokenVerifierForProject) VerifyIDToken(ctx context.Context, idToken string) (*auth.Token, error) {
	if idToken != v.projectID+"-token" {
		return nil, fmt.Errorf("invalid token for %s", v.projectID)
	}
	return &auth.Token{UID: v.projectID + "-user"}, nil
}

func TestVerifyFirebaseToken(t *testing.T) {
	server := Server{tokenVerifier: fakeTokenVerifier{}}

	assert.NoError(t, server.verifyFirebaseToken(context.Background(), "Bearer valid-token"))
	assert.Error(t, server.verifyFirebaseToken(context.Background(), ""))
	assert.Error(t, server.verifyFirebaseToken(context.Background(), "Bearer invalid-token"))
}

func TestMultiProjectTokenVerifier(t *testing.T) {
	verifier := MultiProjectTokenVerifier{
		verifiers: []TokenVerifier{
			fakeTokenVerifierForProject{projectID: "algopro"},
			fakeTokenVerifierForProject{projectID: "matfiz"},
		},
	}

	algoproToken, err := verifier.VerifyIDToken(context.Background(), "algopro-token")
	assert.NoError(t, err)
	assert.Equal(t, "algopro-user", algoproToken.UID)

	matfizToken, err := verifier.VerifyIDToken(context.Background(), "matfiz-token")
	assert.NoError(t, err)
	assert.Equal(t, "matfiz-user", matfizToken.UID)

	_, err = verifier.VerifyIDToken(context.Background(), "unknown-token")
	assert.Error(t, err)
}

func TestRequestAcceptsUTF8JSON(t *testing.T) {
	req := Request{}
	err := json.Unmarshal([]byte(`{
		"language": "py",
		"filename": "main.py",
		"source": "print(\"hello világ\")",
		"input": "árvíztűrő tükörfúrógép"
	}`), &req)

	assert.NoError(t, err)
	assert.Equal(t, `print("hello világ")`, req.Source)
	assert.Equal(t, "árvíztűrő tükörfúrógép", req.Input)
}

func TestRequestInputWithinLimit(t *testing.T) {
	assert.True(t, Request{Input: strings.Repeat("a", int(InputLimit))}.InputWithinLimit())
	assert.False(t, Request{Input: strings.Repeat("a", int(InputLimit)+1)}.InputWithinLimit())
	assert.False(t, Request{Input: strings.Repeat("á", int(InputLimit/2)+1)}.InputWithinLimit())
}

func TestRequestValidFilename(t *testing.T) {
	assert.True(t, Request{Language: "cpp", Filename: "main.cpp"}.Valid())
	assert.True(t, Request{Language: "py", Filename: "main.py"}.Valid())
	assert.True(t, Request{Language: "java", Filename: "Main_2.java"}.Valid())
	assert.False(t, Request{Language: "cpp", Filename: "../../app/main.go"}.Valid())
	assert.False(t, Request{Language: "cpp", Filename: "main.cpp; touch /tmp/pwned"}.Valid())
	assert.False(t, Request{Language: "java", Filename: "-Main.java"}.Valid())
}

func TestStrictCORS(t *testing.T) {
	server := Server{allowedOrigins: []string{"https://ide.algopro.hu"}}
	handlerCalled := false
	handler := server.WithCORS(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		handlerCalled = true
		w.WriteHeader(http.StatusOK)
	}))

	t.Run("allows_configured_origin", func(t *testing.T) {
		handlerCalled = false
		req := httptest.NewRequest(http.MethodPost, "/execute", nil)
		req.Header.Set("Origin", "https://ide.algopro.hu")
		w := httptest.NewRecorder()

		handler.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Result().StatusCode)
		assert.True(t, handlerCalled)
		assert.Equal(t, "https://ide.algopro.hu", w.Result().Header.Get("Access-Control-Allow-Origin"))
	})

	t.Run("rejects_unconfigured_origin", func(t *testing.T) {
		handlerCalled = false
		req := httptest.NewRequest(http.MethodPost, "/execute", nil)
		req.Header.Set("Origin", "https://evil.example")
		w := httptest.NewRecorder()

		handler.ServeHTTP(w, req)

		assert.Equal(t, http.StatusForbidden, w.Result().StatusCode)
		assert.False(t, handlerCalled)
		assert.Empty(t, w.Result().Header.Get("Access-Control-Allow-Origin"))
	})

	t.Run("allows_no_origin", func(t *testing.T) {
		handlerCalled = false
		req := httptest.NewRequest(http.MethodPost, "/execute", nil)
		w := httptest.NewRecorder()

		handler.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Result().StatusCode)
		assert.True(t, handlerCalled)
		assert.Empty(t, w.Result().Header.Get("Access-Control-Allow-Origin"))
	})

	t.Run("preflights_allowed_origin", func(t *testing.T) {
		handlerCalled = false
		req := httptest.NewRequest(http.MethodOptions, "/execute", nil)
		req.Header.Set("Origin", "https://ide.algopro.hu")
		w := httptest.NewRecorder()

		handler.ServeHTTP(w, req)

		assert.Equal(t, http.StatusNoContent, w.Result().StatusCode)
		assert.False(t, handlerCalled)
		assert.Equal(t, "https://ide.algopro.hu", w.Result().Header.Get("Access-Control-Allow-Origin"))
	})

	t.Run("preflights_reject_unconfigured_origin", func(t *testing.T) {
		handlerCalled = false
		req := httptest.NewRequest(http.MethodOptions, "/execute", nil)
		req.Header.Set("Origin", "https://evil.example")
		w := httptest.NewRecorder()

		handler.ServeHTTP(w, req)

		assert.Equal(t, http.StatusForbidden, w.Result().StatusCode)
		assert.False(t, handlerCalled)
		assert.Empty(t, w.Result().Header.Get("Access-Control-Allow-Origin"))
	})
}

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
				Source: `#include <bits/stdc++.h>
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
`,
				Input: `5
				6
				1 2 2 2 5 6
				2
				4 4
				6
				1 1 3 4 4 5
				1
				1
				6
				1 1 1 2 2 2`,
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
				Source:   `asdfdsf`,
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
				Source: `#include<iostream>
int main() {béla}`,
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
				Source: `#include<iostream>
int main() {
	while(1) std::cerr<<"teszt\n";
}`,
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
				Source: `#include<iostream>
int main() {
	int x;
	std::cin>>x;
	std::cout<<x*x<<"\n";
}`,
				Input: `10000000`,
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
				Source: `#include<optional>
				int main() {
					std::optional<int> o;
					o = 23;
				}
				`,
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
				Source: `import sys
print("hello vilag")
print("error", file=sys.stderr)`,
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
			resp, err := test.req.Run(context.TODO(), sp, nil)
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

	server := Server{
		logger:        logger,
		sp:            sp,
		tokenVerifier: fakeTokenVerifier{},
	}
	tests := []struct {
		name        string
		authHeader  string
		contentType string
		body        string

		wantStatusCode      int
		checkResponseBody   bool
		checkResponseOutput bool
		checkResponseStderr bool
		wantResponse        Response
	}{
		{
			name:           "missing_token",
			contentType:    "application/json",
			body:           `{"language": "cpp", "filename": "main.cpp"}`,
			wantStatusCode: http.StatusUnauthorized,
		},
		{
			name:           "empty_request",
			authHeader:     "Bearer valid-token",
			contentType:    "application/json",
			body:           "",
			wantStatusCode: http.StatusBadRequest,
		},
		{
			name:           "invalid_language",
			authHeader:     "Bearer valid-token",
			contentType:    "application/json",
			body:           `{"language": "cppp"}`,
			wantStatusCode: http.StatusBadRequest,
		},
		{
			name:           "no_filename",
			authHeader:     "Bearer valid-token",
			contentType:    "application/json",
			body:           `{"language": "cpp"}`,
			wantStatusCode: http.StatusBadRequest,
		},
		{
			name:           "empty_source",
			authHeader:     "Bearer valid-token",
			contentType:    "application/json",
			body:           `{"language": "cpp", "filename": "main.cpp"}`,
			wantStatusCode: http.StatusOK,
		},
		{
			name:        "hello_world_py",
			authHeader:  "Bearer valid-token",
			contentType: "application/json",
			//not a backdoor(tm)
			body:                `{"language": "py", "filename": "main.py", "source": "import sys\nprint(\"hello világ\")\nprint(\"stdérr\", file=sys.stderr)"}`,
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
			authHeader:          "Bearer valid-token",
			contentType:         "application/json",
			body:                `{"language": "py", "filename": "main.py", "source": "a, b = map(int, input().split())\nprint(\"eredményünk: \"+str(a+b))", "input": "10    20 "}`,
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
			req.Header.Set("Authorization", test.authHeader)

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

func TestPostExecuteRejectsOversizedInput(t *testing.T) {
	server := Server{
		logger:        slog.New(slog.NewJSONHandler(io.Discard, nil)),
		tokenVerifier: fakeTokenVerifier{},
	}
	body := `{"language": "cpp", "filename": "main.cpp", "input": "` + strings.Repeat("a", int(InputLimit)+1) + `"}`
	req := httptest.NewRequest(http.MethodPost, "/execute", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer valid-token")

	w := httptest.NewRecorder()
	server.PostExecute(w, req)

	assert.Equal(t, http.StatusRequestEntityTooLarge, w.Result().StatusCode)
}

func TestPostExecuteRejectsInvalidBody(t *testing.T) {
	server := Server{
		logger:        slog.New(slog.NewJSONHandler(io.Discard, nil)),
		tokenVerifier: fakeTokenVerifier{},
	}
	post := func(body string) int {
		req := httptest.NewRequest(http.MethodPost, "/execute", strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer valid-token")
		w := httptest.NewRecorder()
		server.PostExecute(w, req)
		return w.Result().StatusCode
	}
	body := `{"language":"cpp","filename":"main.cpp"}`
	assert.Equal(t, http.StatusRequestEntityTooLarge, post(body+strings.Repeat(" ", int(BodyLimit))))
	assert.Equal(t, http.StatusBadRequest, post(body+`{}`))
}
