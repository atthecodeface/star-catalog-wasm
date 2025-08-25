//a Imports
use wasm_bindgen::prelude::*;

use crate::{Icosphere, Vertex};
use crate::{WasmVec2f32, WasmVec3f32};

//a WasmVertex
//tp WasmVertex
#[wasm_bindgen]
pub struct WasmVertex(Vertex);
#[wasm_bindgen]
impl WasmVertex {
    #[wasm_bindgen(getter)]
    pub fn position(&self) -> WasmVec3f32 {
        self.0.position_xyz.into()
    }

    #[wasm_bindgen(getter)]
    pub fn texture(&self) -> WasmVec2f32 {
        self.0.texture_uv.into()
    }
}
impl From<Vertex> for WasmVertex {
    fn from(v: Vertex) -> WasmVertex {
        WasmVertex(v)
    }
}

//a WasmIcosphere
//tp WasmIcosphere
#[wasm_bindgen]
pub struct WasmIcosphere(Icosphere);
#[wasm_bindgen]
impl WasmIcosphere {
    //cp new
    /// Create a new [WasmCatalog]
    #[wasm_bindgen(constructor)]
    pub fn new() -> WasmIcosphere {
        let ico = Icosphere::default();
        Self(ico)
    }

    pub fn subdivide(&mut self, division: u32) {
        for f in 0..20 {
            self.0.add_subdivided_face(f, division);
        }
    }
    pub fn add_subdvided_face(&mut self, f: usize, division: u32) {
        self.0.add_subdivided_face(f, division);
    }

    #[wasm_bindgen(getter)]
    pub fn num_vertices(&self) -> usize {
        self.0.subdiv_vertices.len()
    }
    #[wasm_bindgen(getter)]
    pub fn num_faces(&self) -> usize {
        self.0.subdiv_faces.len()
    }

    pub fn subdiv_face(&self, n: usize) -> Box<[u32]> {
        let (a, b, c) = self.0.subdiv_faces[n];
        Box::new([a, b, c])
    }
    pub fn subdiv_vertex(&self, n: usize) -> WasmVertex {
        self.0.subdiv_vertex(n).into()
    }
}
