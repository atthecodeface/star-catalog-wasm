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

  vertex: string = `#version 300 es
  uniform mat4 projection;
  uniform mat4 view;
  uniform mat4 model;

  in vec4 position;
  in vec2 tex_coord;

  out vec2 vTextureCoord;
  out vec3 col;
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

  fragment: string = `#version 300 es
  precision mediump float;
  in vec2 vTextureCoord;
  in vec3 col;
  uniform vec4 color;
  out vec4 FragColor; // must be the only output declaration; is not implicit!
  void main() {
  FragColor.r = color.r*col.r;
  FragColor.g = color.g*col.g;
  FragColor.b = color.b*col.b;
  FragColor.a = color.a;
  }
  `;
}

export class StarShader implements WebglShaderSrc {
  id: string = "stars";
  extra_uniforms: string[] = ["magnitude"];

  vertex: string = `#version 300 es
  uniform mat4 projection;
  uniform mat4 view;
  uniform mat4 model;

  uniform float magnitude;

  // These are implicit
  // in highp int gl_VertexID;
  // in highp int gl_InstanceID;
  // out highp vec4 gl_Position;
  // out highp float gl_PointSize;

  in ivec2 star;

  out vec3 star_color;
  void main() {
    uint u = uint(star.x) & 0xffffffu;
    uint v = uint(star.y) & 0xffffffu;
    bool u_is_neg = (star.x & 0x1000000)!=0;
    bool v_is_neg = (star.x & 0x2000000)!=0;
    bool w_is_neg = (star.x & 0x4000000)!=0;
    bool x_is_u = (star.x & 0x8000000)!=0;
    bool z_is_v = (star.x & 0x10000000)!=0;
    bool y_is_u = !x_is_u;
    bool y_is_v = !z_is_v;
    uint magnitude = uint(star.y >> 24) & 0x7fu;

    float uf_unsigned = float(u) / float(0x1000000);
    float vf_unsigned = float(v) / float(0x1000000);
    float wf_unsigned = sqrt(1.0 - uf_unsigned*uf_unsigned - vf_unsigned*vf_unsigned);
    float uf = u_is_neg ? (-uf_unsigned): (uf_unsigned);
    float vf = v_is_neg ? (-vf_unsigned): (vf_unsigned);
    float wf = w_is_neg ? (-wf_unsigned): (wf_unsigned);

    float x = x_is_u ? uf : wf;
    float y = y_is_u ? uf : (y_is_v ? vf : wf);
    float z = z_is_v ? vf : wf;

    vec4 star_vector;
    star_vector = vec4(x,y,z,1);

    vec4 position = projection * view * star_vector;
    gl_Position = position;
    if (position.z < 0.0) {gl_Position.z = 0.1;}
    if (position.z > 0.0) {gl_Position.z = 10000.0;}
    star_color = vec3(1,1,1);
    gl_PointSize = (magnitude > 4u) ? (float(magnitude)/4.0) : 1.0;
  }
`;

  fragment: string = `#version 300 es
  precision mediump float;
  in vec3 star_color;
  uniform vec4 color;

  out vec4 FragColor; // must be the only output declaration; is not implicit!

  // These are implicit
  // in highp vec4 gl_FragCoord;
  // in bool gl_FrontFacing;
  // out highp float gl_FragDepth;
  // in mediump vec2 gl_PointCoord;

  void main() {
  FragColor.r = color.r * star_color.r;
  FragColor.g = color.g * star_color.g;
  FragColor.b = color.b * star_color.b;
  FragColor.a = color.a;
  FragColor = vec4(1,1,1,1);
  }
  `;
}
