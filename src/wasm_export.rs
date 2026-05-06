//a Imports
// test stars
//
// alkaid 67301 : opposite is 4.36 degrees
// mizar 65378 : opposite is 10.46 degrees
// alioth 62956 : opposite is 6.67 degrees

use js_sys::Array;
use wasm_bindgen::prelude::*;

use star_catalog::{
    Catalog, CatalogIndex, Star, StarFilter, StarTriangleMatch, StarTriangleSearch, Subcube,
};

use crate::Rrc;
use crate::{Vec3f64, WasmVec3f32, WasmVec3f64};

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

    //mp closest_to_ra_de
    pub fn closest_to_ra_de(&self, ra: f64, de: f64) -> Option<usize> {
        let catalog = self.cat.borrow();
        let s = Subcube::iter_all();
        catalog
            .closest_to_ra_de(s, ra, de)
            .map(|(_, s)| s.as_usize())
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
        let v: Vec3f64 = v.into();
        self.cat
            .borrow_mut()
            .add_filter(StarFilter::cos_to_gt(v.into(), angle.cos()));
    }

    //mp find_stars_around
    /// Find stars around a vector within a given angle in radians
    pub fn find_stars_around(
        &self,
        v: &WasmVec3f64,
        max_angle: f64,
        first: usize,
        max_results: usize,
    ) -> Array {
        self.cat
            .borrow_mut()
            .add_filter(StarFilter::select(first, max_results));

        let result = js_sys::Array::new();
        let v: Vec3f64 = v.into();
        for index in self.cat.borrow().find_stars_around(&v, max_angle) {
            result.push(&index.as_usize().into());
        }
        self.cat.borrow_mut().clear_filter();
        result
    }

    //mp find_star_triangles
    /// Find stars around a vector within a given angle in radians
    pub fn find_star_triangles(
        &self,
        max_angle_delta: f64,
        a0: f64,
        a1: f64,
        a2: f64,
        _max_triangles: usize,
    ) -> Vec<u32> {
        //        let f_orig = self
        //            .cat
        //            .borrow_mut()
        //            .add_filter(StarFilter::select(0, max_triangles));

        let mut result = vec![]; // js_sys::Array::new();
        let angles_to_find = [a0, a1, a2];
        let subcube_iter = Subcube::iter_all();
        crate::console_log!("{:?} {max_angle_delta}", angles_to_find);
        /*
                self.cat.borrow_mut().clear_filter();
                self.cat
                    .borrow_mut()
                    .add_filter(StarFilter::brighter_than(5.0));
        */
        let search = StarTriangleSearch::of_angles(angles_to_find, max_angle_delta).unwrap();
        let (finished, mut candidates) =
            self.cat
                .borrow()
                .find_star_triangles(subcube_iter, &search, 10 * 1000 * 1000);
        crate::console_log!("{finished} {}", candidates.len());
        candidates.sort_by(StarTriangleMatch::compare_angle_sum);
        for tm in candidates {
            let t = tm.triangle();
            result.push(t.0.as_usize() as u32);
            result.push(t.1.as_usize() as u32);
            result.push(t.2.as_usize() as u32);
        }
        result
    }

    pub fn find_best_star_mappings(
        &self,
        img_space_vectors: Vec<WasmVec3f64>,
        max_angle_delta: f64,
    ) -> bool {
        let subcube_iter = Subcube::iter_all();
        self.cat.borrow_mut().clear_filter();
        self.cat
            .borrow_mut()
            .add_filter(StarFilter::brighter_than(5.0));

        let img_space_vectors: Vec<_> = img_space_vectors.into_iter().map(|a| *a).collect();
        crate::console_log!("vectors {img_space_vectors:?}");
        let (finished, candidates) = self.cat.borrow().find_best_star_mappings(
            subcube_iter,
            &img_space_vectors,
            max_angle_delta,
            10 * 1000 * 1000,
        );
        for (c, a) in &candidates {
            if *a < 0.01 {
                crate::console_log!("candidate {c:?} {a}");
            }
        }
        crate::console_log!("{finished} {}", candidates.len());
        false
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
