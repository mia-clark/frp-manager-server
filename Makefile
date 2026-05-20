SHELL := /bin/sh
VERSION ?= dev
BUILD_DATE := $(shell date -u +%Y-%m-%d)
LDFLAGS := -s -w \
    -X github.com/mia-clark/frp-manager-server/pkg/version.Number=$(VERSION) \
    -X github.com/mia-clark/frp-manager-server/pkg/version.BuildDate=$(BUILD_DATE)

.PHONY: build test vet tidy clean docker run

build:
	CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags "$(LDFLAGS)" -o bin/frpmgrd ./cmd/frpmgrd

build-host:
	CGO_ENABLED=0 go build -trimpath -ldflags "$(LDFLAGS)" -o bin/frpmgrd ./cmd/frpmgrd

test:
	go test ./...

vet:
	go vet ./...

tidy:
	go mod tidy

clean:
	rm -rf bin/

docker:
	docker build -f deploy/Dockerfile -t frpmgr-server:$(VERSION) --build-arg VERSION=$(VERSION) --build-arg BUILD_DATE=$(BUILD_DATE) .

run: build-host
	FRPMGR_API_TOKEN=dev FRPMGR_DATA_DIR=./tmp/data ./bin/frpmgrd serve
