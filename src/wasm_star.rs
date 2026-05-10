use wasm_bindgen::prelude::*;

use star_catalog::Star;

use crate::{WasmVec3f32, WasmVec3f64};

#[wasm_bindgen]
pub struct WasmStar {
    s: Star,
}

#[wasm_bindgen]
impl WasmStar {
    //mp vec_of_ra_de
    pub fn vec_of_ra_de(ra: f64, de: f64) -> WasmVec3f64 {
        Star::vec_of_ra_de(ra, de).into()
    }

    //ap id
    #[wasm_bindgen(getter)]
    pub fn id(&self) -> usize {
        self.s.id()
    }

    //ap right_ascension
    #[wasm_bindgen(getter)]
    pub fn right_ascension(&self) -> f64 {
        self.s.ra()
    }

    //ap declination
    #[wasm_bindgen(getter)]
    pub fn declination(&self) -> f64 {
        self.s.de()
    }

    //ap distance
    #[wasm_bindgen(getter)]
    pub fn distance(&self) -> f32 {
        self.s.distance()
    }

    //ap magnitude
    #[wasm_bindgen(getter)]
    pub fn magnitude(&self) -> f32 {
        self.s.magnitude()
    }

    //ap blue_violet
    #[wasm_bindgen(getter)]
    pub fn blue_violet(&self) -> f32 {
        self.s.bv()
    }

    //ap vector
    #[wasm_bindgen(getter)]
    pub fn vector(&self) -> WasmVec3f64 {
        (*self.s.vector()).into()
    }

    //mp set_vector
    pub fn set_vector(&self, v: &mut WasmVec3f64) {
        v.set(self.s.vector().as_ref());
    }

    //ap temperature
    #[wasm_bindgen(getter)]
    pub fn temperature(&self) -> f32 {
        self.s.temp()
    }

    //ap rgb
    #[wasm_bindgen(getter)]
    pub fn rgb(&self) -> WasmVec3f32 {
        let (r, g, b) = Star::temp_to_rgb(self.s.temp());
        [r, g, b].into()
    }

    //ap cos_angle_between
    pub fn cos_angle_between(&self, other: &WasmStar) -> f64 {
        self.s.cos_angle_between(&other.s)
    }

    //zz All done
}

impl From<Star> for WasmStar {
    fn from(s: Star) -> Self {
        WasmStar { s }
    }
}
