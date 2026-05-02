WASM_PACK = wasm-pack build --dev --target web
WASM_PACK = WASM_PACK_WASM_OPT=false wasm-pack build --release --target web
WASM_PACK = WASM_PACK_WASM_OPT=true wasm-pack build --dev --target web
WASM_PACK = wasm-pack build --dev --target web
WASM_PACK = WASM_PACK_WASM_OPT=true wasm-pack build --release --target web

.PHONY: all
all:
	$(MAKE) js
	${WASM_PACK}

start_http:
	python3 -m http.server 3001

help:
	@echo "To compile the typescript to the 'js' directory (where it is checked into git):"
	@echo "    make js"
	@echo
	@echo "To install 'tsc' first install node (sad face): node-v24.14.1.pkg"
	@echo "Then"
	@echo "    npm install typescript"
	@echo ""

js:
	npx tsc -b

.PHONY: zip
zip: star_catalog.zip

star_catalog.zip: http pkg javascript
	rm star_catalog.zip

	zip star_catalog.zip favicon.ico
	zip star_catalog.zip http/Blue_Marble_2002_x10.jpg
	zip star_catalog.zip http/main.css
	zip star_catalog.zip http/favicon.ico
	zip star_catalog.zip http/index.html

	zip star_catalog.zip javascript/*.js

	zip star_catalog.zip pkg/package.json
	zip star_catalog.zip pkg/star_catalog_wasm.d.ts
	zip star_catalog.zip pkg/star_catalog_wasm.js
	zip star_catalog.zip pkg/star_catalog_wasm_bg.wasm
	zip star_catalog.zip pkg/star_catalog_wasm_bg.wasm.d.ts
