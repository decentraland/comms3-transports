UNAME := $(shell uname)

ifneq ($(CI), true)
LOCAL_ARG = --local --verbose --diagnostics
endif


PROTOBUF_VERSION = 3.19.1
ifeq ($(UNAME), Darwin)
PROTOBUF_ZIP = protoc-$(PROTOBUF_VERSION)-osx-x86_64.zip
else
PROTOBUF_ZIP = protoc-$(PROTOBUF_VERSION)-linux-x86_64.zip
endif

protoc3/bin/protoc:
	@# remove local folder
	rm -rf protoc3 || true

	@# Make sure you grab the latest version
	curl -OL https://github.com/protocolbuffers/protobuf/releases/download/v$(PROTOBUF_VERSION)/$(PROTOBUF_ZIP)

	@# Unzip
	unzip $(PROTOBUF_ZIP) -d protoc3
	@# delete the files
	rm $(PROTOBUF_ZIP)

	@# move protoc to /usr/local/bin/
	chmod +x protoc3/bin/protoc

build-proto: protoc3/bin/protoc
	protoc3/bin/protoc \
		--plugin=./node_modules/.bin/protoc-gen-ts_proto \
		--ts_proto_opt=esModuleInterop=true,oneof=unions\
		--ts_proto_out="$(PWD)/src/proto" \
		-I="$(PWD)/src/proto" \
		"$(PWD)/src/proto/comms.proto"  \
		"$(PWD)/src/proto/p2p.proto"  \
		"$(PWD)/src/proto/ws.proto"  \
		"$(PWD)/src/proto/archipelago.proto" 

test:
	node_modules/.bin/jest --detectOpenHandles --colors --runInBand $(TESTARGS)

test-integration:
	node_modules/.bin/jest --config=jest-integration.config.js --detectOpenHandles --colors --runInBand $(TESTARGS)

test-all: test test-integration 

test-watch:
	node_modules/.bin/jest --detectOpenHandles --colors --runInBand --watch $(TESTARGS)

build: build-proto
	./node_modules/.bin/tsc -p tsconfig.json
	rm -rf node_modules/@microsoft/api-extractor/node_modules/typescript || true
	./node_modules/.bin/api-extractor run $(LOCAL_ARG) --typescript-compiler-folder ./node_modules/typescript

lint:
	@node_modules/.bin/eslint . --ext .ts

lint-fix: ## Fix bad formatting on all .ts and .tsx files
	@node_modules/.bin/eslint . --ext .ts --fix

install:
	nmp ci

.PHONY: build test build-proto lint lint-fix install
