module github.com/algopro/algopro-ide/execute

go 1.22

toolchain go1.22.3

require (
	github.com/go-chi/chi/v5 v5.0.12
	github.com/mraron/njudge v0.5.0
	github.com/stretchr/testify v1.9.0
)

require (
	github.com/davecgh/go-spew v1.1.2-0.20180830191138-d8f796af33cc // indirect
	github.com/gofrs/flock v0.12.1 // indirect
	github.com/kr/text v0.2.0 // indirect
	github.com/pmezard/go-difflib v1.0.1-0.20181226105442-5d4384ee4fb2 // indirect
	github.com/rogpeppe/go-internal v1.12.0 // indirect
	github.com/spf13/afero v1.11.0 // indirect
	golang.org/x/sys v0.23.0 // indirect
	golang.org/x/text v0.17.0 // indirect
	gopkg.in/yaml.v3 v3.0.1 // indirect
)

replace github.com/mraron/njudge => github.com/algoproclub/njudge v0.6.1-0.20250601095924-c6a9d0752fdb
