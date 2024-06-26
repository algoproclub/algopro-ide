FROM golang:1.22-bookworm

WORKDIR /app

COPY go.mod ./
COPY go.sum ./

RUN go mod download && go mod verify

COPY testdata/ ./testdata
COPY sanitizer/ ./sanitizer
COPY *.go ./
RUN go build -o execute

ENTRYPOINT ["/app/execute"]