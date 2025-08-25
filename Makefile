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


.PHONY: star_catalog.zip
star_catalog.zip:
	zip star_catalog.zip favicon.ico
	zip star_catalog.zip http/Blue_Marble_2002_x10.jpg
	zip star_catalog.zip http/main.css
	zip star_catalog.zip http/favicon.ico
	zip star_catalog.zip http/hipparcos.js
	zip star_catalog.zip http/html.js
	zip star_catalog.zip http/draw.js
	zip star_catalog.zip http/mouse.js
	zip star_catalog.zip http/tabbed.js
	zip star_catalog.zip http/utils.js

	zip star_catalog.zip http/view_properties.js

	zip star_catalog.zip http/clock.js
	zip star_catalog.zip http/compass.js
	zip star_catalog.zip http/elevation.js
	zip star_catalog.zip http/earth.js
	zip star_catalog.zip http/map_canvas.js
	zip star_catalog.zip http/sky_canvas.js
	zip star_catalog.zip http/log.js
	zip star_catalog.zip http/styling.js

	zip star_catalog.zip http/index.html

	zip star_catalog.zip http/star_catalog.js
	zip star_catalog.zip http/tabbed.css
	zip star_catalog.zip pkg/package.json
	zip star_catalog.zip pkg/star_catalog_wasm.d.ts
	zip star_catalog.zip pkg/star_catalog_wasm.js
	zip star_catalog.zip pkg/star_catalog_wasm_bg.wasm
	zip star_catalog.zip pkg/star_catalog_wasm_bg.wasm.d.ts
