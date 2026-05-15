import { WasmCatalog } from "../pkg/star_catalog_wasm.js";
import { WasmMemory } from "./wasm_memory.js";
import { Styling } from "./styling.js";

export interface Application {
  wasm_memory: WasmMemory;
  catalog: WasmCatalog;
  styling(): Styling;
  styling_updated(): void;
  time_date_updated(): void;
  location_updated(): void;
  observer_view_updated(): void;
  window_updated(): void;
  view_updated(): void;
}
