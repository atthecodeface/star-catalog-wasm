use geo_nd_wasm::{WasmQuatf32, WasmVec3f32};
pub use star_catalog::{Orbit, SOLAR_SYSTEM};

use wasm_bindgen::prelude::*;
#[wasm_bindgen]
pub struct WasmOrbit {
    orbit: Orbit,
}

#[wasm_bindgen]
impl WasmOrbit {
    /// Create a new [WasmOrbit]
    #[wasm_bindgen(constructor)]
    pub fn new() -> WasmOrbit {
        let orbit = Orbit::default();
        Self { orbit }
    }

    /// Create a [WasmOrbit] from an element of the solar system, if it is there
    pub fn of_solar_system(name: &str) -> Option<WasmOrbit> {
        for ns in SOLAR_SYSTEM {
            if ns.0 == name {
                let orbit: Orbit = ns.1.into();
                return Some(Self { orbit });
            }
        }
        None
    }

    pub fn period_of_orbit(&self) -> f64 {
        self.orbit.period_of_orbit()
    }

    pub fn orbit_to_parent(&self) -> WasmQuatf32 {
        self.orbit.orbit_to_parent().into()
    }

    pub fn parent_to_orbit(&self) -> WasmQuatf32 {
        self.orbit.parent_to_orbit().into()
    }

    pub fn perigee_distance(&self) -> f64 {
        self.orbit.perigee_distance()
    }
    pub fn apogee_distance(&self) -> f64 {
        self.orbit.apogee_distance()
    }
    pub fn orbit_vec_of_unix_time(&self, time_secs: f64, v: &mut WasmVec3f32) {
        let f = self.orbit.orbit_vec_of_unix_time(time_secs as i64);
        *v = [f[0], f[1], 0.0].into();
    }
    pub fn orbit_vec_of_true_anomaly(&self, true_anomaly: f64, v: &mut WasmVec3f32) {
        let f = self.orbit.orbit_vec_of_true_anomlay(true_anomaly);
        *v = [f[0], f[1], 0.0].into();
    }
}
