//a To do
//
pub use geo_nd_wasm::{Quatf32, Vec2f32, Vec3f32, Vec4f32};
pub use geo_nd_wasm::{Quatf64, Vec2f64, Vec3f64, Vec4f64};
pub use geo_nd_wasm::{WasmVec2f32, WasmVec3f32, WasmVec3f64};

mod types;
pub use types::Rrc;

mod wasm_import;
pub use wasm_import::log as wasm_log;

mod wasm_export;
pub use wasm_export::{WasmCatalog, WasmStar};

mod icosphere;
pub use icosphere::{Icosphere, Vertex};

mod wasm_icosphere;
pub use wasm_icosphere::WasmVertex;

//a Useful macros
#[macro_export]
macro_rules! console_log {
    // Note that this is using the `log` function imported above during
    // `bare_bones`
    // ($($t:tt)*) => ( unsafe { crate::log(&format_args!($($t)*).to_string())} )
    ($($t:tt)*) => ( { $crate :: wasm_log(&format_args!($($t)*).to_string())} )
}
