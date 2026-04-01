.PHONY: build clean test windows macos linux

BINARY_NAME=db-cli
VERSION=1.0.0
COMMIT=$(shell git rev-parse --short HEAD 2>/dev/null || echo "dev")
DATE=$(shell date -u +"%Y-%m-%d %H:%M:%S UTC")

LDFLAGS=-ldflags="-s -w -X github.com/xiaokexiang/db-cli/cmd.Version=$(VERSION) -X github.com/xiaokexiang/db-cli/cmd.Commit=$(COMMIT) -X github.com/xiaokexiang/db-cli/cmd.Date=\"$(DATE)\""

build:
	go build $(LDFLAGS) -o $(BINARY_NAME) ./cmd

clean:
	rm -f $(BINARY_NAME)
	rm -rf build/ dist/

windows:
	GOOS=windows GOARCH=amd64 $(MAKE) build BINARY_NAME=build/$(BINARY_NAME)-windows-amd64.exe
	GOOS=windows GOARCH=arm64 $(MAKE) build BINARY_NAME=build/$(BINARY_NAME)-windows-arm64.exe

macos:
	GOOS=darwin GOARCH=amd64 $(MAKE) build BINARY_NAME=build/$(BINARY_NAME)-darwin-amd64
	GOOS=darwin GOARCH=arm64 $(MAKE) build BINARY_NAME=build/$(BINARY_NAME)-darwin-arm64

linux:
	GOOS=linux GOARCH=amd64 $(MAKE) build BINARY_NAME=build/$(BINARY_NAME)-linux-amd64
	GOOS=linux GOARCH=arm64 $(MAKE) build BINARY_NAME=build/$(BINARY_NAME)-linux-arm64

test:
	go test -v ./...
