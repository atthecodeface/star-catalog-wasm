import { WebglShaderSrc } from "./web_gl";

export class EarthShader implements WebglShaderSrc {
  id = "earth";
  vertex = `
  uniform mat4 projection;
              uniform mat4 view;
              uniform mat4 model;
              attribute vec4 position;
              attribute vec2 tex_coord;
              varying vec2 vTextureCoord;
              void main() {
              gl_Position = projection * view * model * position;
              vTextureCoord = tex_coord;
              }
  `;

  fragment = `
    precision mediump float;
    varying vec2 vTextureCoord;
    uniform vec4 color;
         uniform sampler2D uSampler;
  //          out vec4 fragColor;

    void main() {
    lowp int icoquad = 0;
    float u = vTextureCoord.x;
    float v = vTextureCoord.y;
    if (v>=0.5) {
      v -= 0.5;
      icoquad = 5;
    }
    if (u>=0.6) {
      u -= 0.6;
      icoquad += 3;
      v = 0.5-v;
    }
    if (u>=0.4) {
      u -= 0.2;
      icoquad += 1;
    }
    if (u>=0.2) {
      u -= 0.2;
      icoquad += 1;
      v = 0.5-v;
    }
    u = 5.0 * u;
    v = 2.0 * v;
    float un = 1.0-u;
    float vn = 1.0-v;
    vec4 weights = vec4(un-v, v, 0.0, u);
    if (u > vn) { // u + v > 1 ==> u > vn
            weights = vec4(0.0, un, u-vn, vn);
             }
    float phi = 1.618033988749895;
    vec3 w = vec3( -1.0,  phi,  0.0); // 0
    vec3 x = vec3(  1.0,  phi,  0.0); // 1
    vec3 y = vec3(  phi,  0.0,  1.0); // 9
    vec3 z = vec3(  0.0,  1.0,  phi); // 5
    if (icoquad==1) {
          w = vec3(  phi,  0.0,  1.0); // 9
          x = vec3(  0.0,  1.0,  phi); // 5
          y = vec3( -phi,  0.0,  1.0); // 11
          z = vec3(  0.0, -1.0,  phi); // 4
             }
    if (icoquad==2) {
          w = vec3(  0.0, -1.0,  phi); // 4
          x = vec3( -phi,  0.0,  1.0); // 11
          y = vec3( -phi,  0.0, -1.0); // 10
            z = vec3( -1.0, -phi,  0.0); // 2
             }
    if (icoquad==3) {
          w = vec3( -1.0, -phi,  0.0); // 2
          x = vec3( -phi,  0.0, -1.0); // 10
          y = vec3(  0.0,  1.0, -phi); // 7
          z = vec3(  0.0, -1.0, -phi); // 6
             }
    if (icoquad==4) {
          w = vec3(  0.0,  1.0, -phi); // 7
          x = vec3(  0.0, -1.0, -phi); // 6
          y = vec3(  1.0, -phi,  0.0); // 3
          z = vec3(  phi,  0.0, -1.0); // 8
             }
    if (icoquad==5) {
          w = vec3(  0.0,  1.0,  phi); // 5
          x = vec3( -phi,  0.0,  1.0); // 11
          y = vec3( -phi,  0.0, -1.0); // 10
          z = vec3( -1.0,  phi,  0.0); // 0
           }
    if (icoquad==6) {
          w = vec3( -phi,  0.0, -1.0); // 10
          x = vec3( -1.0,  phi,  0.0); // 0
          y = vec3(  1.0,  phi,  0.0); // 1
          z = vec3(  0.0,  1.0, -phi); // 7
           }
    if (icoquad==7) {
          w = vec3(  0.0,  1.0, -phi); // 7
          x = vec3(  1.0,  phi,  0.0); // 1
          y = vec3(  phi,  0.0,  1.0); // 9
          z = vec3(  phi,  0.0, -1.0); // 8
           }
    if (icoquad==8) {
          w = vec3(  phi,  0.0, -1.0); // 8
          x = vec3(  phi,  0.0,  1.0); // 9
          y = vec3(  0.0, -1.0,  phi); // 4
          z = vec3(  1.0, -phi,  0.0); // 3
           }
    if (icoquad==9) {
          w = vec3(  0.0, -1.0,  phi); // 4
          x = vec3(  1.0, -phi,  0.0); // 3
          y = vec3(  0.0, -1.0, -phi); // 6
          z = vec3( -1.0, -phi,  0.0); // 2
           }
    vec3 d = weights[0]*w + weights[1]*x + weights[2]*y + weights[3]*z;
    d = d / length(d);
    vec2 texcoord = vec2( atan(d.y, d.x)/6.283185307179586 + 0.5, asin(-d.z)/3.1415926538 + 0.5);
    vec4 c =  texture2D(uSampler, texcoord);
    c.r = (c.r * 0.9) + 0.1;
    c.g = (c.g * 0.9) + 0.1;
    c.b = (c.b * 0.9) + 0.1;


    if (color.a == 0.0) {
    c = color;
    } else {
    c = (1.0-color.a) * c + color.a * vec4(c.r*color.r, c.g*color.g, c.b*color.b, 1.0);
    }
    c.a = 1.0;
    gl_FragColor = c;

    }
    `;

  extra_uniforms: string[] = [];
}

export class SphereShader implements WebglShaderSrc {
  id: string = "sphere";
  extra_uniforms: string[] = [];

  vertex: string = `
  uniform mat4 projection;
  uniform mat4 view;
  uniform mat4 model;

  attribute vec4 position;
  attribute vec2 tex_coord;


  varying vec2 vTextureCoord;
  varying vec3 col;
  void main() {
            vec4 pos;
            pos = projection * view * model * position;
            gl_Position = pos;
            col.x = (2.0+tex_coord.x)/3.0;
            col.y = (2.0+tex_coord.y)/3.0;
            col.z = (2.0+tex_coord.y)/3.0;
            vTextureCoord = tex_coord;
  }
`;

  fragment: string = `
  precision mediump float;
  varying vec2 vTextureCoord;
  varying vec3 col;
  uniform vec4 color;
  void main() {
  gl_FragColor.r = color.r*col.r;
  gl_FragColor.g = color.g*col.g;
  gl_FragColor.b = color.b*col.b;
  gl_FragColor.a = color.a;
  }
  `;
}
