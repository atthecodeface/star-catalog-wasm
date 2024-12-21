WASM_PACK = wasm-pack build --dev --target web
WASM_PACK = WASM_PACK_WASM_OPT=false wasm-pack build --release --target web
WASM_PACK = WASM_PACK_WASM_OPT=true wasm-pack build --dev --target web
WASM_PACK = wasm-pack build --dev --target web
WASM_PACK = WASM_PACK_WASM_OPT=true wasm-pack build --release --target web

.PHONY: all
all:
	${WASM_PACK}

start_http:
	python3 -m http.server 3001

