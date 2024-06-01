FROM golang:1.22-bookworm

WORKDIR /app

COPY go.mod ./
COPY go.sum ./

RUN go mod download
RUN go mod verify

COPY main.go ./
RUN go build -o execute

ENTRYPOINT ["/app/execute"]