export class WasmMemory {
    constructor(memory) {
        this.memory = memory;
        this.memory_view = new DataView(this.memory.buffer);
    }
    refresh_view() {
        this.memory_view = new DataView(this.memory.buffer);
    }
    float64_array(ptr, num_floats) {
        return new Float64Array(this.memory.buffer, ptr, num_floats);
    }
    float_array_of_vec3f64(vec) {
        return this.float64_array(vec.buffer, 3);
    }
}
