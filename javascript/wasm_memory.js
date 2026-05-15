export class WasmMemory {
    constructor(memory) {
        this.memory = memory;
        this.memory_view = new DataView(this.memory.buffer);
    }
    refresh_view() {
        this.memory_view = new DataView(this.memory.buffer);
    }
    float32_array(ptr, num_floats) {
        return new Float32Array(this.memory.buffer, ptr, num_floats * 4);
    }
}
