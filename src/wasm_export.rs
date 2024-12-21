//a Imports
use js_sys::Array;
use wasm_bindgen::prelude::*;

use star_catalog::{Catalog, CatalogIndex, Star, StarFilter, Subcube};

use crate::Rrc;
use crate::{WasmVec3f32, WasmVec3f64};

//a WasmCatalog
//tp WasmCatalog
#[wasm_bindgen]
pub struct WasmCatalog {
    cat: Rrc<Catalog>,
}

//ip WasmCatalog
#[wasm_bindgen]
impl WasmCatalog {
    //cp new
    /// Create a new [WasmCatalog]
    #[wasm_bindgen(constructor)]
    pub fn new(json: &str) -> Result<WasmCatalog, JsValue> {
        let mut catalog = Catalog::default();
        if json == "hipp_bright" {
            catalog = postcard::from_bytes(star_catalog::hipparcos::HIPP_BRIGHT_PST)
                .map_err(|s| s.to_string())?;
        }
        catalog.sort();
        catalog.derive_data();
        let cat = catalog.into();
        Ok(Self { cat })
    }

    //mp count
    #[wasm_bindgen(getter)]
    pub fn count(&self) -> usize {
        self.cat.borrow().len()
    }

    //mp max_magnitude
    pub fn max_magnitude(&self, magnitude: f32) {
        self.cat
            .borrow_mut()
            .retain(move |s, _n| s.brighter_than(magnitude));
        self.cat.borrow_mut().sort();
        self.cat.borrow_mut().derive_data();
    }

    //mp sort
    pub fn sort(&self) {
        self.cat.borrow_mut().sort();
        self.cat.borrow_mut().derive_data();
    }

    //mp find
    pub fn find(&self, name_or_id: &str) -> Option<usize> {
        let Ok(index) = self.cat.borrow().find_id_or_name(name_or_id) else {
            return None;
        };
        Some(index.as_usize())
    }

    //mp star
    pub fn star(&self, index: usize) -> Option<WasmStar> {
        let index: CatalogIndex = index.into();
        Some(self.cat.borrow()[index].clone().into())
    }

    //mp name_star
    pub fn name_star(&self, id: usize, name: &str) -> bool {
        let mut catalog = self.cat.borrow_mut();
        if !catalog.is_sorted() {
            return false;
        }
        let Some(index) = catalog.find_sorted(id) else {
            return false;
        };
        catalog.add_name(index, name);
        true
    }

    //mp closest_to
    pub fn closest_to(&self, ra: f64, de: f64) -> Option<usize> {
        let catalog = self.cat.borrow();
        catalog.closest_to(ra, de).map(|(_, s)| s.as_usize())
    }

    //mp clear_filter
    pub fn clear_filter(&self) {
        self.cat.borrow_mut().clear_filter();
    }

    //mp filter_max_magnitude
    pub fn filter_max_magnitude(&self, magnitude: f32) {
        self.cat
            .borrow_mut()
            .add_filter(StarFilter::brighter_than(magnitude));
    }

    //mp filter_closer_to
    pub fn filter_closer_to(&self, v: &WasmVec3f64, angle: f64) {
        let v = v.into();
        self.cat
            .borrow_mut()
            .add_filter(StarFilter::cos_to_gt(v, angle.cos()));
    }

    //mp find_stars_around
    pub fn find_stars_around(
        &self,
        v: &WasmVec3f64,
        max_angle: f64,
        first: usize,
        max_results: usize,
    ) -> Array {
        let f_orig = self
            .cat
            .borrow_mut()
            .add_filter(StarFilter::select(first, max_results));

        let result = js_sys::Array::new();
        let v = v.into();
        for index in self.cat.borrow().find_stars_around(&v, max_angle) {
            result.push(&index.as_usize().into());
        }
        self.cat.borrow_mut().set_filter(f_orig);
        result
    }

    //mp find_star_triangles
    pub fn find_star_triangles(
        &self,
        max_angle_delta: f64,
        a0: f64,
        a1: f64,
        a2: f64,
        max_triangles: usize,
    ) -> Array {
        let f_orig = self
            .cat
            .borrow_mut()
            .add_filter(StarFilter::select(0, max_triangles));

        let result = js_sys::Array::new();
        let angles_to_find = [a0, a1, a2];
        let s = Subcube::iter_all();
        for (i0, i1, i2) in
            self.cat
                .borrow()
                .find_star_triangles(s, &angles_to_find, max_angle_delta)
        {
            result.push(&i0.as_usize().into());
            result.push(&i1.as_usize().into());
            result.push(&i2.as_usize().into());
        }

        self.cat.borrow_mut().set_filter(f_orig);
        result
    }

    //zz All done
}

//a WasmStar
//tp WasmStar
#[wasm_bindgen]
pub struct WasmStar {
    s: Star,
}

//ip WasmStar
#[wasm_bindgen]
impl WasmStar {
    //mp vec_of_ra_de
    pub fn vec_of_ra_de(ra: f64, de: f64) -> WasmVec3f64 {
        Star::vec_of_ra_de(ra, de).into()
    }

    //ap id
    #[wasm_bindgen(getter)]
    pub fn id(&self) -> usize {
        self.s.id
    }

    //ap right_ascension
    #[wasm_bindgen(getter)]
    pub fn right_ascension(&self) -> f64 {
        self.s.ra
    }

    //ap declination
    #[wasm_bindgen(getter)]
    pub fn declination(&self) -> f64 {
        self.s.de
    }

    //ap distance
    #[wasm_bindgen(getter)]
    pub fn distance(&self) -> f32 {
        self.s.ly
    }

    //ap magnitude
    #[wasm_bindgen(getter)]
    pub fn magnitude(&self) -> f32 {
        self.s.mag
    }

    //ap blue_violet
    #[wasm_bindgen(getter)]
    pub fn blue_violet(&self) -> f32 {
        self.s.bv
    }

    //ap vector
    #[wasm_bindgen(getter)]
    pub fn vector(&self) -> WasmVec3f64 {
        self.s.vector.into()
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
