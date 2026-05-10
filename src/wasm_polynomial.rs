use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct WasmPolynomial {
    poly: Vec<f64>,
}
#[wasm_bindgen]
impl WasmPolynomial {
    #[wasm_bindgen(constructor)]
    pub fn new(poly: Vec<f64>) -> Self {
        Self { poly }
    }

    #[wasm_bindgen(getter)]
    pub fn poly(&self) -> Vec<f64> {
        self.poly.clone()
    }

    pub fn set(&mut self, n: usize, v: f64) {
        if n < self.poly.len() {
            self.poly[n] = v;
        }
    }

    pub fn calc(&self, x: f64) -> f64 {
        let mut r = 0.;
        let mut xn = 1.0;
        for p in self.poly.iter() {
            r += p * xn;
            xn *= x;
        }
        r
    }
    pub fn min_squares(&mut self, p: usize, xs: &[f64], ys: &[f64]) -> bool {
        use geo_nd_wasm::geo_nd::matrix;
        let n = xs.len();
        if ys.len() != n {
            crate::console_log!("Mismatch in array lengths");
            return false;
        }
        let mut xi_m = vec![0.; n * p]; // N rows of P columns
        let mut xi_m_t = vec![0.; n * p]; // P rows of N columns

        for (i, x) in xs.iter().enumerate() {
            let mut xn = 1.;
            for j in 0..p {
                xi_m[i * p + j] = xn;
                xi_m_t[j * n + i] = xn;
                xn *= x;
            }
        }
        let mut x_xt = vec![0.; p * p]; // P by P matrix
        matrix::multiply_dyn(p, n, p, &xi_m_t, &xi_m, &mut x_xt);

        let mut x_xt_inverse = vec![0.0; p * p];
        let mut lu = vec![0.0; p * p];
        let mut pivot = vec![0; p];
        let determinant = matrix::lup_decompose(p, &x_xt, &mut lu, &mut pivot);
        if determinant.abs() == 0.0 {
            crate::console_log!("Determinant was {determinant}");
            return false;
        }
        if !(matrix::lup_invert(
            p,
            &lu,
            &pivot,
            &mut x_xt_inverse,
            &mut vec![0.0; p],
            &mut vec![0.0; p],
        )) {
            crate::console_log!("Failed to invert");
            return false;
        }

        let mut xt_y = vec![0.; p]; // P row vector
        matrix::multiply_dyn(p, n, 1, &xi_m_t, &ys, &mut xt_y);
        let mut res = vec![0.; p]; // P row vector
        matrix::multiply_dyn(p, p, 1, &x_xt_inverse, &xt_y, &mut res);
        self.poly = res;
        true
    }
}
