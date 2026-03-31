.PHONY: build clean test windows macos linux

BINARY_NAME=db-cli
VERSION=1.0.0

build:
	go build -o $(BINARY_NAME) ./cmd

clean:
	rm -f $(BINARY_NAME)
	rm -rf build/
dist/

windows:
	GOOS=windows GOARCH=amd64 go build -o build/$(BINARY_NAME)-windows-amd64.exe ./cmd
	GOOS=windows GOARCH=arm64 go build -o build/$(BINARY_NAME)-windows-arm64.exe ./cmd

macos:
	GOOS=darwin GOARCH=amd64 go build -o build/$(BINARY_NAME)-darwin-amd64 ./cmd
	GOOS=darwin GOARCH=arm64 go build -o build/$(BINARY_NAME)-darwin-arm64 ./cmd

linux:
	GOOS=linux GOARCH=amd64 go build -o build/$(BINARY_NAME)-linux-amd64 ./cmd
	GOOS=linux GOARCH=arm64 go build -o build/$(BINARY_NAME)-linux-arm64 ./cmd

test:
	go test -v ./...
