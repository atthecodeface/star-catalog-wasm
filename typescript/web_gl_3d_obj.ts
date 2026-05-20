import { WebglShaderSrc, WebglObjKind, Webgl } from "./web_gl.js";

export class Webgl3DObjSimpleShader implements WebglShaderSrc {
  id: string = "webgl_3d_simple";
  extra_uniforms: string[] = [];

  vertex: string = `#version 300 es
  uniform mat4 projection;
  uniform mat4 view;
  uniform mat4 model;

  in vec4 position;
  in vec2 tex_coord;

  out vec2 vTextureCoord;
  void main() {
            vec4 pos;
            pos = projection * view * model * position;
            gl_Position = pos;
            vTextureCoord = tex_coord;
  }
`;

  fragment: string = `#version 300 es
  precision mediump float;
  in vec2 vTextureCoord;
  uniform vec4 color;
  out vec4 FragColor; // must be the only output declaration; is not implicit!
  void main() {
    FragColor =  texture2D(uSampler, texcoord);
 }
  `;
}

export class Webgl3DObj implements WebglObjKind {
  positions: Float32Array;
  tex_coords: Float32Array;
  indices: Uint16Array;
  num_vertices: number = 0;
  num_indices: number = 0;
  position_buf: WebGLBuffer | null = null;
  tex_coord_buf: WebGLBuffer | null = null;
  indices_buf: WebGLBuffer | null = null;

  constructor(max_vertices: number, max_indices: number) {
    this.positions = new Float32Array(3 * max_vertices);
    this.tex_coords = new Float32Array(2 * max_vertices);
    this.indices = new Uint16Array(3 * max_indices);
  }

  add_vertex(position: Float32Array, texcoord: Float32Array) {
    this.positions.set(position, this.num_vertices * 3);
    this.tex_coords.set(texcoord, this.num_vertices * 2);
    this.num_vertices += 1;
  }

  add_face(indices: number[]) {
    this.indices.set(indices, this.num_indices);
    this.num_indices += indices.length;
  }

  webgl_set_uniforms(_wgl: Webgl) {}

  webgl_create(webgl: WebGLRenderingContext) {
    this.position_buf = webgl.createBuffer();
    webgl.bindBuffer(webgl.ARRAY_BUFFER, this.position_buf);
    webgl.bufferData(
      webgl.ARRAY_BUFFER,
      this.positions.buffer,
      webgl.STATIC_DRAW,
    );

    this.tex_coord_buf = webgl.createBuffer();
    webgl.bindBuffer(webgl.ARRAY_BUFFER, this.tex_coord_buf);
    webgl.bufferData(
      webgl.ARRAY_BUFFER,
      this.tex_coords.buffer,
      webgl.STATIC_DRAW,
    );

    this.indices_buf = webgl.createBuffer();
    webgl.bindBuffer(webgl.ELEMENT_ARRAY_BUFFER, this.indices_buf);
    webgl.bufferData(
      webgl.ELEMENT_ARRAY_BUFFER,
      this.indices.buffer,
      webgl.STATIC_DRAW,
    );
  }

  webgl_draw(webgl: WebGLRenderingContext) {
    webgl.bindBuffer(webgl.ARRAY_BUFFER, this.position_buf);
    webgl.enableVertexAttribArray(0);
    webgl.vertexAttribPointer(0, 3, webgl.FLOAT, false, 0, 0);
    webgl.bindBuffer(webgl.ARRAY_BUFFER, this.tex_coord_buf);
    webgl.enableVertexAttribArray(1);
    webgl.vertexAttribPointer(1, 2, webgl.FLOAT, false, 0, 0);

    webgl.bindBuffer(webgl.ELEMENT_ARRAY_BUFFER, this.indices_buf);
    webgl.drawElements(
      webgl.TRIANGLES,
      this.num_indices,
      webgl.UNSIGNED_SHORT,
      0,
    );
  }
}
