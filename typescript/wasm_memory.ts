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
  float32_array(ptr: number, num_floats: number): Float32Array {
    return new Float32Array(this.memory.buffer, ptr, num_floats * 4);
  }
}
