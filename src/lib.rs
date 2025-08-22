//a To do
// Web code to take picture using camera on device
//
// <div class="camera">
//   <video id="video">Video stream not available.</video>
//   <button id="start-button">Capture photo</button>
// </div>
// <canvas id="canvas"></canvas>
// <div class="output">
//   <img id="photo" alt="The screen capture will appear in this box." />
// </div>
//
//
// const width = 320; // We will scale the photo width to this
// let height = 0; // This will be computed based on the input stream
//
// let streaming = false;
//
// const video = document.getElementById("video");
// const canvas = document.getElementById("canvas");
// const photo = document.getElementById("photo");
// const startButton = document.getElementById("start-button");
// const allowButton = document.getElementById("permissions-button");
//
// allowButton.addEventListener("click", () => {
//   navigator.mediaDevices
//     .getUserMedia({ video: true, audio: false })
//     .then((stream) => {
//       video.srcObject = stream;
//       video.play();
//     })
//     .catch((err) => {
//       console.error(`An error occurred: ${err}`);
//     });
// });
//
// video.addEventListener(
//   "canplay",
//   (ev) => {
//     if (!streaming) {
//       height = video.videoHeight / (video.videoWidth / width);
//
//       video.setAttribute("width", width);
//       video.setAttribute("height", height);
//       canvas.setAttribute("width", width);
//       canvas.setAttribute("height", height);
//       streaming = true;
//     }
//   },
//   false,
// );
//
// startButton.addEventListener(
//   "click",
//   (ev) => {
//     takePicture();
//     ev.preventDefault();
//   },
//   false,
// );
//
// function clearPhoto() {
//   const context = canvas.getContext("2d");
//   context.fillStyle = "#aaaaaa";
//   context.fillRect(0, 0, canvas.width, canvas.height);
//
//   const data = canvas.toDataURL("image/png");
//   photo.setAttribute("src", data);
// }
//
// clearPhoto();
//
// function takePicture() {
//   const context = canvas.getContext("2d");
//   if (width && height) {
//     canvas.width = width;
//     canvas.height = height;
//     context.drawImage(video, 0, 0, width, height);
//
//     const data = canvas.toDataURL("image/png");
//     photo.setAttribute("src", data);
//   } else {
//     clearPhoto();
//   }
// }
//
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
