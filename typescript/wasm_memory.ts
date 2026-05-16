import { WasmVec3f64, WasmVec3f32 } from "../pkg/star_catalog_wasm.js";

export class WasmMemory {
  memory: WebAssembly.Memory;
  memory_view: DataView;
  constructor(memory: WebAssembly.Memory) {
    this.memory = memory;
    this.memory_view = new DataView(this.memory.buffer);
  }
  refresh_view() {
    this.memory_view = new DataView(this.memory.buffer);
  }
  private float64_array(ptr: number, num_floats: number): Float64Array {
    return new Float64Array(this.memory.buffer, ptr, num_floats);
  }
  float_array_of_vec3f64(vec: WasmVec3f64): Float64Array {
    return this.float64_array(vec.buffer, 3);
  }

  private float32_array(ptr: number, num_floats: number): Float32Array {
    return new Float32Array(this.memory.buffer, ptr, num_floats);
  }
  float_array_of_vec3f32(vec: WasmVec3f32): Float32Array {
    return this.float32_array(vec.buffer, 3);
  }
}
