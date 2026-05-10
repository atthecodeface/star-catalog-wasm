use geo_nd_wasm::WasmQuatf64;
use js_sys::Array;
use wasm_bindgen::prelude::*;

use star_catalog::{
    Catalog, CatalogIndex, StarFilter, StarTriangleMatch, StarTriangleSearch, Subcube,
};

use crate::Rrc;
use crate::{Vec3f64, WasmStar, WasmVec3f64};

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
    ) -> Vec<WasmQuatf64> {
        // }, f64, f64)> {
        let subcube_iter = Subcube::iter_all();
        let img_space_vectors: Vec<_> = img_space_vectors.into_iter().map(|a| *a).collect();
        crate::console_log!("vectors {img_space_vectors:?}");
        let (_finished, mut candidates) = self.cat.borrow().find_best_star_mappings(
            subcube_iter,
            &img_space_vectors,
            max_angle_delta,
            10 * 1000 * 1000,
        );

        crate::console_log!("Found {} candidates", candidates.len());

        candidates.sort_by(|a, b| a.quality.partial_cmp(&b.quality).unwrap());
        let mut r = vec![];
        for c in candidates {
            let rijk = {
                use star_catalog::geo_nd::Quaternion;
                c.quaternion().as_rijk()
            };
            use geo_nd_wasm::geo_nd::Quaternion;
            r.push(
                // (
                crate::Quatf64::of_rijk(rijk.0, rijk.1, rijk.2, rijk.3).into(),
                // c.0.angle_sum(),
                //  c.1,
                // )
            );
        }
        r
    }

    //zz All done
}
