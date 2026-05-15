import { WasmCatalog, WasmVec3f64 } from "../pkg/star_catalog_wasm.js";
import { WasmMemory } from "./wasm_memory.js";
import { Styling } from "./styling.js";
import { Log } from "./log.js";
import { ViewProperties } from "./view_properties.js";

export interface Application {
  wasm_memory: WasmMemory;
  catalog: WasmCatalog;
  view_properties: ViewProperties;
  log: Log;
  styling(): Styling;
  styling_updated(): void;
  time_date_updated(): void;
  location_updated(): void;
  observer_view_updated(): void;
  window_updated(): void;
  view_updated(): void;
  select_star(catalog_index: number | undefined): void;
  sky_view_center_on_ra_de(ra: number, de: number): void;
  sky_view_zoom_by(factor: number): void;
  sky_view_frame_to_ecef_set_vec(
    fx: number,
    fy: number,
    vec: WasmVec3f64,
  ): void;
}
