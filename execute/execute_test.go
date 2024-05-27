package main

import (
	"testing"

	"github.com/mraron/njudge/pkg/language"
	"github.com/stretchr/testify/assert"
)

func TestExecuteRequestRun(t *testing.T) {
	sp := NewSandboxProvider(1)
	sp.Put(NewIsolate(255))
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
				Verdict:  language.VerdictRE,
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
				Verdict:  language.VerdictRE,
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
				Verdict:  language.VerdictCE,
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
				Verdict:  language.VerdictTL,
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
				Verdict:  language.VerdictRE,
			},
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			resp, err := test.req.Run(sp)
			if test.wantErr {
				assert.NotNil(t, err)
			} else {
				assert.Nil(t, err)
			}
			assert.Equal(t, test.resp.Compiled, resp.Compiled)
			assert.Equal(t, test.resp.Verdict, resp.Verdict)
		})
	}
}
