import { F as Ie, u as Ee, l as se, M as v, G as De, v as Oe, S as Fe, x as ae, E as u, e as D, y as S, z as Le, H as O, I as b, R as F, J as ne, K as He, t as m, b as f, i as B, w as L, L as K, N as We, c as Y, B as y, j as U, O as ze, Q as C, k as M, V as w, W as Ve, a as Ne, X as ie, Y as oe, Z as le, _ as ue, C as P, $ as je, a0 as A, a1 as J, D as H, a2 as $e, a3 as qe, P as Ke, d as Ye, T as X, a4 as Q, a5 as Je, a6 as Xe, a7 as Qe } from "./index-BD4kcFAx.js";
import { B as de, c as Ze } from "./colorToUniform-C2jGzNe1.js";
var et = `in vec2 vMaskCoord;
in vec2 vTextureCoord;

uniform sampler2D uTexture;
uniform sampler2D uMaskTexture;

uniform float uAlpha;
uniform vec4 uMaskClamp;
uniform float uInverse;

out vec4 finalColor;

void main(void)
{
    float clip = step(3.5,
        step(uMaskClamp.x, vMaskCoord.x) +
        step(uMaskClamp.y, vMaskCoord.y) +
        step(vMaskCoord.x, uMaskClamp.z) +
        step(vMaskCoord.y, uMaskClamp.w));

    // TODO look into why this is needed
    float npmAlpha = uAlpha;
    vec4 original = texture(uTexture, vTextureCoord);
    vec4 masky = texture(uMaskTexture, vMaskCoord);
    float alphaMul = 1.0 - npmAlpha * (1.0 - masky.a);

    float a = alphaMul * masky.r * npmAlpha * clip;

    if (uInverse == 1.0) {
        a = 1.0 - a;
    }

    finalColor = original * a;
}
`, tt = `in vec2 aPosition;

out vec2 vTextureCoord;
out vec2 vMaskCoord;


uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;
uniform mat3 uFilterMatrix;

vec4 filterVertexPosition(  vec2 aPosition )
{
    vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
       
    position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
    position.y = position.y * (2.0*uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;

    return vec4(position, 0.0, 1.0);
}

vec2 filterTextureCoord(  vec2 aPosition )
{
    return aPosition * (uOutputFrame.zw * uInputSize.zw);
}

vec2 getFilterCoord( vec2 aPosition )
{
    return  ( uFilterMatrix * vec3( filterTextureCoord(aPosition), 1.0)  ).xy;
}   

void main(void)
{
    gl_Position = filterVertexPosition(aPosition);
    vTextureCoord = filterTextureCoord(aPosition);
    vMaskCoord = getFilterCoord(aPosition);
}
`, Z = `struct GlobalFilterUniforms {
  uInputSize:vec4<f32>,
  uInputPixel:vec4<f32>,
  uInputClamp:vec4<f32>,
  uOutputFrame:vec4<f32>,
  uGlobalFrame:vec4<f32>,
  uOutputTexture:vec4<f32>,
};

struct MaskUniforms {
  uFilterMatrix:mat3x3<f32>,
  uMaskClamp:vec4<f32>,
  uAlpha:f32,
  uInverse:f32,
};

@group(0) @binding(0) var<uniform> gfu: GlobalFilterUniforms;
@group(0) @binding(1) var uTexture: texture_2d<f32>;
@group(0) @binding(2) var uSampler : sampler;

@group(1) @binding(0) var<uniform> filterUniforms : MaskUniforms;
@group(1) @binding(1) var uMaskTexture: texture_2d<f32>;

struct VSOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) uv : vec2<f32>,
    @location(1) filterUv : vec2<f32>,
};

fn filterVertexPosition(aPosition:vec2<f32>) -> vec4<f32>
{
    var position = aPosition * gfu.uOutputFrame.zw + gfu.uOutputFrame.xy;

    position.x = position.x * (2.0 / gfu.uOutputTexture.x) - 1.0;
    position.y = position.y * (2.0*gfu.uOutputTexture.z / gfu.uOutputTexture.y) - gfu.uOutputTexture.z;

    return vec4(position, 0.0, 1.0);
}

fn filterTextureCoord( aPosition:vec2<f32> ) -> vec2<f32>
{
    return aPosition * (gfu.uOutputFrame.zw * gfu.uInputSize.zw);
}

fn globalTextureCoord( aPosition:vec2<f32> ) -> vec2<f32>
{
  return  (aPosition.xy / gfu.uGlobalFrame.zw) + (gfu.uGlobalFrame.xy / gfu.uGlobalFrame.zw);
}

fn getFilterCoord(aPosition:vec2<f32> ) -> vec2<f32>
{
  return ( filterUniforms.uFilterMatrix * vec3( filterTextureCoord(aPosition), 1.0)  ).xy;
}

fn getSize() -> vec2<f32>
{
  return gfu.uGlobalFrame.zw;
}

@vertex
fn mainVertex(
  @location(0) aPosition : vec2<f32>,
) -> VSOutput {
  return VSOutput(
   filterVertexPosition(aPosition),
   filterTextureCoord(aPosition),
   getFilterCoord(aPosition)
  );
}

@fragment
fn mainFragment(
  @location(0) uv: vec2<f32>,
  @location(1) filterUv: vec2<f32>,
  @builtin(position) position: vec4<f32>
) -> @location(0) vec4<f32> {

    var maskClamp = filterUniforms.uMaskClamp;
    var uAlpha = filterUniforms.uAlpha;

    var clip = step(3.5,
      step(maskClamp.x, filterUv.x) +
      step(maskClamp.y, filterUv.y) +
      step(filterUv.x, maskClamp.z) +
      step(filterUv.y, maskClamp.w));

    var mask = textureSample(uMaskTexture, uSampler, filterUv);
    var source = textureSample(uTexture, uSampler, uv);
    var alphaMul = 1.0 - uAlpha * (1.0 - mask.a);

    var a: f32 = alphaMul * mask.r * uAlpha * clip;

    if (filterUniforms.uInverse == 1.0) {
        a = 1.0 - a;
    }

    return source * a;
}
`;
class rt extends Ie {
  constructor(e) {
    const { sprite: t, ...r } = e, s = new Ee(t.texture), n = new se({
      uFilterMatrix: { value: new v(), type: "mat3x3<f32>" },
      uMaskClamp: { value: s.uClampFrame, type: "vec4<f32>" },
      uAlpha: { value: 1, type: "f32" },
      uInverse: { value: e.inverse ? 1 : 0, type: "f32" }
    }), i = De.from({
      vertex: {
        source: Z,
        entryPoint: "mainVertex"
      },
      fragment: {
        source: Z,
        entryPoint: "mainFragment"
      }
    }), o = Oe.from({
      vertex: tt,
      fragment: et,
      name: "mask-filter"
    });
    super({
      ...r,
      gpuProgram: i,
      glProgram: o,
      clipToViewport: !1,
      resources: {
        filterUniforms: n,
        uMaskTexture: t.texture.source
      }
    }), this.sprite = t, this._textureMatrix = s;
  }
  set inverse(e) {
    this.resources.filterUniforms.uniforms.uInverse = e ? 1 : 0;
  }
  get inverse() {
    return this.resources.filterUniforms.uniforms.uInverse === 1;
  }
  apply(e, t, r, s) {
    this._textureMatrix.texture = this.sprite.texture, e.calculateSpriteMatrix(
      this.resources.filterUniforms.uniforms.uFilterMatrix,
      this.sprite
    ).prepend(this._textureMatrix.mapCoord), this.resources.uMaskTexture = this.sprite.texture.source, e.applyFilter(this, t, r, s);
  }
}
const W = class ce {
  constructor(e, t) {
    this.state = Fe.for2d(), this._batchersByInstructionSet = /* @__PURE__ */ Object.create(null), this._activeBatches = /* @__PURE__ */ Object.create(null), this.renderer = e, this._adaptor = t, this._adaptor.init?.(this);
  }
  static getBatcher(e) {
    return new this._availableBatchers[e]();
  }
  buildStart(e) {
    let t = this._batchersByInstructionSet[e.uid];
    t || (t = this._batchersByInstructionSet[e.uid] = /* @__PURE__ */ Object.create(null), t.default || (t.default = new ae({
      maxTextures: this.renderer.limits.maxBatchableTextures
    }))), this._activeBatches = t, this._activeBatch = this._activeBatches.default;
    for (const r in this._activeBatches)
      this._activeBatches[r].begin();
  }
  addToBatch(e, t) {
    if (this._activeBatch.name !== e.batcherName) {
      this._activeBatch.break(t);
      let r = this._activeBatches[e.batcherName];
      r || (r = this._activeBatches[e.batcherName] = ce.getBatcher(e.batcherName), r.begin()), this._activeBatch = r;
    }
    this._activeBatch.add(e);
  }
  break(e) {
    this._activeBatch.break(e);
  }
  buildEnd(e) {
    this._activeBatch.break(e);
    const t = this._activeBatches;
    for (const r in t) {
      const s = t[r], n = s.geometry;
      n.indexBuffer.setDataWithSize(s.indexBuffer, s.indexSize, !0), n.buffers[0].setDataWithSize(s.attributeBuffer.float32View, s.attributeSize, !1);
    }
  }
  upload(e) {
    const t = this._batchersByInstructionSet[e.uid];
    for (const r in t) {
      const s = t[r], n = s.geometry;
      s.dirty && (s.dirty = !1, n.buffers[0].update(s.attributeSize * 4));
    }
  }
  execute(e) {
    if (e.action === "startBatch") {
      const t = e.batcher, r = t.geometry, s = t.shader;
      this._adaptor.start(this, r, s);
    }
    this._adaptor.execute(this, e);
  }
  destroy() {
    this.state = null, this.renderer = null, this._adaptor = null;
    for (const e in this._activeBatches)
      this._activeBatches[e].destroy();
    this._activeBatches = null;
  }
};
W.extension = {
  type: [
    u.WebGLPipes,
    u.WebGPUPipes,
    u.CanvasPipes
  ],
  name: "batch"
};
W._availableBatchers = /* @__PURE__ */ Object.create(null);
let he = W;
D.handleByMap(u.Batcher, he._availableBatchers);
D.add(ae);
const Bt = {
  name: "texture-bit",
  vertex: {
    header: (
      /* wgsl */
      `

        struct TextureUniforms {
            uTextureMatrix:mat3x3<f32>,
        }

        @group(2) @binding(2) var<uniform> textureUniforms : TextureUniforms;
        `
    ),
    main: (
      /* wgsl */
      `
            uv = (textureUniforms.uTextureMatrix * vec3(uv, 1.0)).xy;
        `
    )
  },
  fragment: {
    header: (
      /* wgsl */
      `
            @group(2) @binding(0) var uTexture: texture_2d<f32>;
            @group(2) @binding(1) var uSampler: sampler;


        `
    ),
    main: (
      /* wgsl */
      `
            outColor = textureSample(uTexture, uSampler, vUV);
        `
    )
  }
}, Ut = {
  name: "texture-bit",
  vertex: {
    header: (
      /* glsl */
      `
            uniform mat3 uTextureMatrix;
        `
    ),
    main: (
      /* glsl */
      `
            uv = (uTextureMatrix * vec3(uv, 1.0)).xy;
        `
    )
  },
  fragment: {
    header: (
      /* glsl */
      `
        uniform sampler2D uTexture;


        `
    ),
    main: (
      /* glsl */
      `
            outColor = texture(uTexture, vUV);
        `
    )
  }
}, st = new O();
class at extends ne {
  constructor() {
    super(), this.filters = [new rt({
      sprite: new He(m.EMPTY),
      inverse: !1,
      resolution: "inherit",
      antialias: "inherit"
    })];
  }
  get sprite() {
    return this.filters[0].sprite;
  }
  set sprite(e) {
    this.filters[0].sprite = e;
  }
  get inverse() {
    return this.filters[0].inverse;
  }
  set inverse(e) {
    this.filters[0].inverse = e;
  }
}
class fe {
  constructor(e) {
    this._activeMaskStage = [], this._renderer = e;
  }
  push(e, t, r) {
    const s = this._renderer;
    if (s.renderPipes.batch.break(r), r.add({
      renderPipeId: "alphaMask",
      action: "pushMaskBegin",
      mask: e,
      inverse: t._maskOptions.inverse,
      canBundle: !1,
      maskedContainer: t
    }), e.inverse = t._maskOptions.inverse, e.renderMaskToTexture) {
      const n = e.mask;
      n.includeInBuild = !0, n.collectRenderables(
        r,
        s,
        null
      ), n.includeInBuild = !1;
    }
    s.renderPipes.batch.break(r), r.add({
      renderPipeId: "alphaMask",
      action: "pushMaskEnd",
      mask: e,
      maskedContainer: t,
      inverse: t._maskOptions.inverse,
      canBundle: !1
    });
  }
  pop(e, t, r) {
    this._renderer.renderPipes.batch.break(r), r.add({
      renderPipeId: "alphaMask",
      action: "popMaskEnd",
      mask: e,
      inverse: t._maskOptions.inverse,
      canBundle: !1
    });
  }
  execute(e) {
    const t = this._renderer, r = e.mask.renderMaskToTexture;
    if (e.action === "pushMaskBegin") {
      const s = S.get(at);
      if (s.inverse = e.inverse, r) {
        e.mask.mask.measurable = !0;
        const n = Le(e.mask.mask, !0, st);
        e.mask.mask.measurable = !1, n.ceil();
        const i = t.renderTarget.renderTarget.colorTexture.source, o = b.getOptimalTexture(
          n.width,
          n.height,
          i._resolution,
          i.antialias
        );
        t.renderTarget.push(o, !0), t.globalUniforms.push({
          offset: n,
          worldColor: 4294967295
        });
        const l = s.sprite;
        l.texture = o, l.worldTransform.tx = n.minX, l.worldTransform.ty = n.minY, this._activeMaskStage.push({
          filterEffect: s,
          maskedContainer: e.maskedContainer,
          filterTexture: o
        });
      } else
        s.sprite = e.mask.mask, this._activeMaskStage.push({
          filterEffect: s,
          maskedContainer: e.maskedContainer
        });
    } else if (e.action === "pushMaskEnd") {
      const s = this._activeMaskStage[this._activeMaskStage.length - 1];
      r && (t.type === F.WEBGL && t.renderTarget.finishRenderPass(), t.renderTarget.pop(), t.globalUniforms.pop()), t.filter.push({
        renderPipeId: "filter",
        action: "pushFilter",
        container: s.maskedContainer,
        filterEffect: s.filterEffect,
        canBundle: !1
      });
    } else if (e.action === "popMaskEnd") {
      t.filter.pop();
      const s = this._activeMaskStage.pop();
      r && b.returnTexture(s.filterTexture), S.return(s.filterEffect);
    }
  }
  destroy() {
    this._renderer = null, this._activeMaskStage = null;
  }
}
fe.extension = {
  type: [
    u.WebGLPipes,
    u.WebGPUPipes,
    u.CanvasPipes
  ],
  name: "alphaMask"
};
class pe {
  constructor(e) {
    this._colorStack = [], this._colorStackIndex = 0, this._currentColor = 0, this._renderer = e;
  }
  buildStart() {
    this._colorStack[0] = 15, this._colorStackIndex = 1, this._currentColor = 15;
  }
  push(e, t, r) {
    this._renderer.renderPipes.batch.break(r);
    const n = this._colorStack;
    n[this._colorStackIndex] = n[this._colorStackIndex - 1] & e.mask;
    const i = this._colorStack[this._colorStackIndex];
    i !== this._currentColor && (this._currentColor = i, r.add({
      renderPipeId: "colorMask",
      colorMask: i,
      canBundle: !1
    })), this._colorStackIndex++;
  }
  pop(e, t, r) {
    this._renderer.renderPipes.batch.break(r);
    const n = this._colorStack;
    this._colorStackIndex--;
    const i = n[this._colorStackIndex - 1];
    i !== this._currentColor && (this._currentColor = i, r.add({
      renderPipeId: "colorMask",
      colorMask: i,
      canBundle: !1
    }));
  }
  execute(e) {
    this._renderer.colorMask.setMask(e.colorMask);
  }
  destroy() {
    this._renderer = null, this._colorStack = null;
  }
}
pe.extension = {
  type: [
    u.WebGLPipes,
    u.WebGPUPipes,
    u.CanvasPipes
  ],
  name: "colorMask"
};
class me {
  constructor(e) {
    this._maskStackHash = {}, this._maskHash = /* @__PURE__ */ new WeakMap(), this._renderer = e;
  }
  push(e, t, r) {
    var s;
    const n = e, i = this._renderer;
    i.renderPipes.batch.break(r), i.renderPipes.blendMode.setBlendMode(n.mask, "none", r), r.add({
      renderPipeId: "stencilMask",
      action: "pushMaskBegin",
      mask: e,
      inverse: t._maskOptions.inverse,
      canBundle: !1
    });
    const o = n.mask;
    o.includeInBuild = !0, this._maskHash.has(n) || this._maskHash.set(n, {
      instructionsStart: 0,
      instructionsLength: 0
    });
    const l = this._maskHash.get(n);
    l.instructionsStart = r.instructionSize, o.collectRenderables(
      r,
      i,
      null
    ), o.includeInBuild = !1, i.renderPipes.batch.break(r), r.add({
      renderPipeId: "stencilMask",
      action: "pushMaskEnd",
      mask: e,
      inverse: t._maskOptions.inverse,
      canBundle: !1
    });
    const d = r.instructionSize - l.instructionsStart - 1;
    l.instructionsLength = d;
    const c = i.renderTarget.renderTarget.uid;
    (s = this._maskStackHash)[c] ?? (s[c] = 0);
  }
  pop(e, t, r) {
    const s = e, n = this._renderer;
    n.renderPipes.batch.break(r), n.renderPipes.blendMode.setBlendMode(s.mask, "none", r), r.add({
      renderPipeId: "stencilMask",
      action: "popMaskBegin",
      inverse: t._maskOptions.inverse,
      canBundle: !1
    });
    const i = this._maskHash.get(e);
    for (let o = 0; o < i.instructionsLength; o++)
      r.instructions[r.instructionSize++] = r.instructions[i.instructionsStart++];
    r.add({
      renderPipeId: "stencilMask",
      action: "popMaskEnd",
      canBundle: !1
    });
  }
  execute(e) {
    var t;
    const r = this._renderer, s = r.renderTarget.renderTarget.uid;
    let n = (t = this._maskStackHash)[s] ?? (t[s] = 0);
    e.action === "pushMaskBegin" ? (r.renderTarget.ensureDepthStencil(), r.stencil.setStencilMode(f.RENDERING_MASK_ADD, n), n++, r.colorMask.setMask(0)) : e.action === "pushMaskEnd" ? (e.inverse ? r.stencil.setStencilMode(f.INVERSE_MASK_ACTIVE, n) : r.stencil.setStencilMode(f.MASK_ACTIVE, n), r.colorMask.setMask(15)) : e.action === "popMaskBegin" ? (r.colorMask.setMask(0), n !== 0 ? r.stencil.setStencilMode(f.RENDERING_MASK_REMOVE, n) : (r.renderTarget.clear(null, B.STENCIL), r.stencil.setStencilMode(f.DISABLED, n)), n--) : e.action === "popMaskEnd" && (e.inverse ? r.stencil.setStencilMode(f.INVERSE_MASK_ACTIVE, n) : r.stencil.setStencilMode(f.MASK_ACTIVE, n), r.colorMask.setMask(15)), this._maskStackHash[s] = n;
  }
  destroy() {
    this._renderer = null, this._maskStackHash = null, this._maskHash = null;
  }
}
me.extension = {
  type: [
    u.WebGLPipes,
    u.WebGPUPipes,
    u.CanvasPipes
  ],
  name: "stencilMask"
};
function At(a, e) {
  for (const t in a.attributes) {
    const r = a.attributes[t], s = e[t];
    s ? (r.format ?? (r.format = s.format), r.offset ?? (r.offset = s.offset), r.instance ?? (r.instance = s.instance)) : L(`Attribute ${t} is not present in the shader, but is present in the geometry. Unable to infer attribute details.`);
  }
  nt(a);
}
function nt(a) {
  const { buffers: e, attributes: t } = a, r = {}, s = {};
  for (const n in e) {
    const i = e[n];
    r[i.uid] = 0, s[i.uid] = 0;
  }
  for (const n in t) {
    const i = t[n];
    r[i.buffer.uid] += K(i.format).stride;
  }
  for (const n in t) {
    const i = t[n];
    i.stride ?? (i.stride = r[i.buffer.uid]), i.start ?? (i.start = s[i.buffer.uid]), s[i.buffer.uid] += K(i.format).stride;
  }
}
const _ = [];
_[f.NONE] = void 0;
_[f.DISABLED] = {
  stencilWriteMask: 0,
  stencilReadMask: 0
};
_[f.RENDERING_MASK_ADD] = {
  stencilFront: {
    compare: "equal",
    passOp: "increment-clamp"
  },
  stencilBack: {
    compare: "equal",
    passOp: "increment-clamp"
  }
};
_[f.RENDERING_MASK_REMOVE] = {
  stencilFront: {
    compare: "equal",
    passOp: "decrement-clamp"
  },
  stencilBack: {
    compare: "equal",
    passOp: "decrement-clamp"
  }
};
_[f.MASK_ACTIVE] = {
  stencilWriteMask: 0,
  stencilFront: {
    compare: "equal",
    passOp: "keep"
  },
  stencilBack: {
    compare: "equal",
    passOp: "keep"
  }
};
_[f.INVERSE_MASK_ACTIVE] = {
  stencilWriteMask: 0,
  stencilFront: {
    compare: "not-equal",
    passOp: "keep"
  },
  stencilBack: {
    compare: "not-equal",
    passOp: "keep"
  }
};
class Gt {
  constructor(e) {
    this._syncFunctionHash = /* @__PURE__ */ Object.create(null), this._adaptor = e, this._systemCheck();
  }
  /**
   * Overridable function by `pixi.js/unsafe-eval` to silence
   * throwing an error if platform doesn't support unsafe-evals.
   * @private
   */
  _systemCheck() {
    if (!We())
      throw new Error("Current environment does not allow unsafe-eval, please use pixi.js/unsafe-eval module to enable support.");
  }
  ensureUniformGroup(e) {
    const t = this.getUniformGroupData(e);
    e.buffer || (e.buffer = new Y({
      data: new Float32Array(t.layout.size / 4),
      usage: y.UNIFORM | y.COPY_DST
    }));
  }
  getUniformGroupData(e) {
    return this._syncFunctionHash[e._signature] || this._initUniformGroup(e);
  }
  _initUniformGroup(e) {
    const t = e._signature;
    let r = this._syncFunctionHash[t];
    if (!r) {
      const s = Object.keys(e.uniformStructures).map((o) => e.uniformStructures[o]), n = this._adaptor.createUboElements(s), i = this._generateUboSync(n.uboElements);
      r = this._syncFunctionHash[t] = {
        layout: n,
        syncFunction: i
      };
    }
    return this._syncFunctionHash[t];
  }
  _generateUboSync(e) {
    return this._adaptor.generateUboSync(e);
  }
  syncUniformGroup(e, t, r) {
    const s = this.getUniformGroupData(e);
    e.buffer || (e.buffer = new Y({
      data: new Float32Array(s.layout.size / 4),
      usage: y.UNIFORM | y.COPY_DST
    }));
    let n = null;
    return t || (t = e.buffer.data, n = e.buffer.dataInt32), r || (r = 0), s.syncFunction(e.uniforms, t, n, r), !0;
  }
  updateUniformGroup(e) {
    if (e.isStatic && !e._dirtyId)
      return !1;
    e._dirtyId = 0;
    const t = this.syncUniformGroup(e);
    return e.buffer.update(), t;
  }
  destroy() {
    this._syncFunctionHash = null;
  }
}
const k = [
  // uploading pixi matrix object to mat3
  {
    type: "mat3x3<f32>",
    test: (a) => a.value.a !== void 0,
    ubo: `
            var matrix = uv[name].toArray(true);
            data[offset] = matrix[0];
            data[offset + 1] = matrix[1];
            data[offset + 2] = matrix[2];
            data[offset + 4] = matrix[3];
            data[offset + 5] = matrix[4];
            data[offset + 6] = matrix[5];
            data[offset + 8] = matrix[6];
            data[offset + 9] = matrix[7];
            data[offset + 10] = matrix[8];
        `,
    uniform: `
            gl.uniformMatrix3fv(ud[name].location, false, uv[name].toArray(true));
        `
  },
  // uploading a pixi rectangle as a vec4
  {
    type: "vec4<f32>",
    test: (a) => a.type === "vec4<f32>" && a.size === 1 && a.value.width !== void 0,
    ubo: `
            v = uv[name];
            data[offset] = v.x;
            data[offset + 1] = v.y;
            data[offset + 2] = v.width;
            data[offset + 3] = v.height;
        `,
    uniform: `
            cv = ud[name].value;
            v = uv[name];
            if (cv[0] !== v.x || cv[1] !== v.y || cv[2] !== v.width || cv[3] !== v.height) {
                cv[0] = v.x;
                cv[1] = v.y;
                cv[2] = v.width;
                cv[3] = v.height;
                gl.uniform4f(ud[name].location, v.x, v.y, v.width, v.height);
            }
        `
  },
  // uploading a pixi point as a vec2
  {
    type: "vec2<f32>",
    test: (a) => a.type === "vec2<f32>" && a.size === 1 && a.value.x !== void 0,
    ubo: `
            v = uv[name];
            data[offset] = v.x;
            data[offset + 1] = v.y;
        `,
    uniform: `
            cv = ud[name].value;
            v = uv[name];
            if (cv[0] !== v.x || cv[1] !== v.y) {
                cv[0] = v.x;
                cv[1] = v.y;
                gl.uniform2f(ud[name].location, v.x, v.y);
            }
        `
  },
  // uploading a pixi color as a vec4
  {
    type: "vec4<f32>",
    test: (a) => a.type === "vec4<f32>" && a.size === 1 && a.value.red !== void 0,
    ubo: `
            v = uv[name];
            data[offset] = v.red;
            data[offset + 1] = v.green;
            data[offset + 2] = v.blue;
            data[offset + 3] = v.alpha;
        `,
    uniform: `
            cv = ud[name].value;
            v = uv[name];
            if (cv[0] !== v.red || cv[1] !== v.green || cv[2] !== v.blue || cv[3] !== v.alpha) {
                cv[0] = v.red;
                cv[1] = v.green;
                cv[2] = v.blue;
                cv[3] = v.alpha;
                gl.uniform4f(ud[name].location, v.red, v.green, v.blue, v.alpha);
            }
        `
  },
  // uploading a pixi color as a vec3
  {
    type: "vec3<f32>",
    test: (a) => a.type === "vec3<f32>" && a.size === 1 && a.value.red !== void 0,
    ubo: `
            v = uv[name];
            data[offset] = v.red;
            data[offset + 1] = v.green;
            data[offset + 2] = v.blue;
        `,
    uniform: `
            cv = ud[name].value;
            v = uv[name];
            if (cv[0] !== v.red || cv[1] !== v.green || cv[2] !== v.blue) {
                cv[0] = v.red;
                cv[1] = v.green;
                cv[2] = v.blue;
                gl.uniform3f(ud[name].location, v.red, v.green, v.blue);
            }
        `
  }
];
function It(a, e, t, r) {
  const s = [`
        var v = null;
        var v2 = null;
        var t = 0;
        var index = 0;
        var name = null;
        var arrayOffset = null;
    `];
  let n = 0;
  for (let o = 0; o < a.length; o++) {
    const l = a[o], d = l.data.name;
    let c = !1, h = 0;
    for (let p = 0; p < k.length; p++)
      if (k[p].test(l.data)) {
        h = l.offset / 4, s.push(
          `name = "${d}";`,
          `offset += ${h - n};`,
          k[p][e] || k[p].ubo
        ), c = !0;
        break;
      }
    if (!c)
      if (l.data.size > 1)
        h = l.offset / 4, s.push(t(l, h - n));
      else {
        const p = r[l.data.type];
        h = l.offset / 4, s.push(
          /* wgsl */
          `
                    v = uv.${d};
                    offset += ${h - n};
                    ${p};
                `
        );
      }
    n = h;
  }
  const i = s.join(`
`);
  return new Function(
    "uv",
    "data",
    "dataInt32",
    "offset",
    i
  );
}
function g(a, e) {
  return `
        for (let i = 0; i < ${a * e}; i++) {
            data[offset + (((i / ${a})|0) * 4) + (i % ${a})] = v[i];
        }
    `;
}
const it = {
  f32: `
        data[offset] = v;`,
  i32: `
        dataInt32[offset] = v;`,
  "vec2<f32>": `
        data[offset] = v[0];
        data[offset + 1] = v[1];`,
  "vec3<f32>": `
        data[offset] = v[0];
        data[offset + 1] = v[1];
        data[offset + 2] = v[2];`,
  "vec4<f32>": `
        data[offset] = v[0];
        data[offset + 1] = v[1];
        data[offset + 2] = v[2];
        data[offset + 3] = v[3];`,
  "vec2<i32>": `
        dataInt32[offset] = v[0];
        dataInt32[offset + 1] = v[1];`,
  "vec3<i32>": `
        dataInt32[offset] = v[0];
        dataInt32[offset + 1] = v[1];
        dataInt32[offset + 2] = v[2];`,
  "vec4<i32>": `
        dataInt32[offset] = v[0];
        dataInt32[offset + 1] = v[1];
        dataInt32[offset + 2] = v[2];
        dataInt32[offset + 3] = v[3];`,
  "mat2x2<f32>": `
        data[offset] = v[0];
        data[offset + 1] = v[1];
        data[offset + 4] = v[2];
        data[offset + 5] = v[3];`,
  "mat3x3<f32>": `
        data[offset] = v[0];
        data[offset + 1] = v[1];
        data[offset + 2] = v[2];
        data[offset + 4] = v[3];
        data[offset + 5] = v[4];
        data[offset + 6] = v[5];
        data[offset + 8] = v[6];
        data[offset + 9] = v[7];
        data[offset + 10] = v[8];`,
  "mat4x4<f32>": `
        for (let i = 0; i < 16; i++) {
            data[offset + i] = v[i];
        }`,
  "mat3x2<f32>": g(3, 2),
  "mat4x2<f32>": g(4, 2),
  "mat2x3<f32>": g(2, 3),
  "mat4x3<f32>": g(4, 3),
  "mat2x4<f32>": g(2, 4),
  "mat3x4<f32>": g(3, 4)
}, Et = {
  ...it,
  "mat2x2<f32>": `
        data[offset] = v[0];
        data[offset + 1] = v[1];
        data[offset + 2] = v[2];
        data[offset + 3] = v[3];
    `
};
function ot(a, e, t, r, s, n) {
  const i = n ? 1 : -1;
  return a.identity(), a.a = 1 / r * 2, a.d = i * (1 / s * 2), a.tx = -1 - e * a.a, a.ty = -i - t * a.d, a;
}
const x = /* @__PURE__ */ new Map();
ze.register(x);
function ve(a, e) {
  if (!x.has(a)) {
    const t = new m({
      source: new U({
        resource: a,
        ...e
      })
    }), r = () => {
      x.get(a) === t && x.delete(a);
    };
    t.once("destroy", r), t.source.once("destroy", r), x.set(a, t);
  }
  return x.get(a);
}
function lt(a) {
  const e = a.colorTexture.source.resource;
  return globalThis.HTMLCanvasElement && e instanceof HTMLCanvasElement && document.body.contains(e);
}
const ge = class xe {
  /**
   * @param [descriptor] - Options for creating a render target.
   */
  constructor(e = {}) {
    if (this.uid = C("renderTarget"), this.colorTextures = [], this.dirtyId = 0, this.isRoot = !1, this._size = new Float32Array(2), this._managedColorTextures = !1, e = { ...xe.defaultOptions, ...e }, this.stencil = e.stencil, this.depth = e.depth, this.isRoot = e.isRoot, typeof e.colorTextures == "number") {
      this._managedColorTextures = !0;
      for (let t = 0; t < e.colorTextures; t++)
        this.colorTextures.push(
          new M({
            width: e.width,
            height: e.height,
            resolution: e.resolution,
            antialias: e.antialias
          })
        );
    } else {
      this.colorTextures = [...e.colorTextures.map((r) => r.source)];
      const t = this.colorTexture.source;
      this.resize(t.width, t.height, t._resolution);
    }
    this.colorTexture.source.on("resize", this.onSourceResize, this), (e.depthStencilTexture || this.stencil) && (e.depthStencilTexture instanceof m || e.depthStencilTexture instanceof M ? this.depthStencilTexture = e.depthStencilTexture.source : this.ensureDepthStencilTexture());
  }
  get size() {
    const e = this._size;
    return e[0] = this.pixelWidth, e[1] = this.pixelHeight, e;
  }
  get width() {
    return this.colorTexture.source.width;
  }
  get height() {
    return this.colorTexture.source.height;
  }
  get pixelWidth() {
    return this.colorTexture.source.pixelWidth;
  }
  get pixelHeight() {
    return this.colorTexture.source.pixelHeight;
  }
  get resolution() {
    return this.colorTexture.source._resolution;
  }
  get colorTexture() {
    return this.colorTextures[0];
  }
  onSourceResize(e) {
    this.resize(e.width, e.height, e._resolution, !0);
  }
  /**
   * This will ensure a depthStencil texture is created for this render target.
   * Most likely called by the mask system to make sure we have stencil buffer added.
   * @internal
   */
  ensureDepthStencilTexture() {
    this.depthStencilTexture || (this.depthStencilTexture = new M({
      width: this.width,
      height: this.height,
      resolution: this.resolution,
      format: "depth24plus-stencil8",
      autoGenerateMipmaps: !1,
      antialias: !1,
      mipLevelCount: 1
      // sampleCount: handled by the render target system..
    }));
  }
  resize(e, t, r = this.resolution, s = !1) {
    this.dirtyId++, this.colorTextures.forEach((n, i) => {
      s && i === 0 || n.source.resize(e, t, r);
    }), this.depthStencilTexture && this.depthStencilTexture.source.resize(e, t, r);
  }
  destroy() {
    this.colorTexture.source.off("resize", this.onSourceResize, this), this._managedColorTextures && this.colorTextures.forEach((e) => {
      e.destroy();
    }), this.depthStencilTexture && (this.depthStencilTexture.destroy(), delete this.depthStencilTexture);
  }
};
ge.defaultOptions = {
  /** the width of the RenderTarget */
  width: 0,
  /** the height of the RenderTarget */
  height: 0,
  /** the resolution of the RenderTarget */
  resolution: 1,
  /** an array of textures, or a number indicating how many color textures there should be */
  colorTextures: 1,
  /** should this render target have a stencil buffer? */
  stencil: !1,
  /** should this render target have a depth buffer? */
  depth: !1,
  /** should this render target be antialiased? */
  antialias: !1,
  // save on perf by default!
  /** is this a root element, true if this is gl context owners render target */
  isRoot: !1
};
let G = ge;
class Dt {
  constructor(e) {
    this.rootViewPort = new w(), this.viewport = new w(), this.onRenderTargetChange = new Ve("onRenderTargetChange"), this.projectionMatrix = new v(), this.defaultClearColor = [0, 0, 0, 0], this._renderSurfaceToRenderTargetHash = /* @__PURE__ */ new Map(), this._gpuRenderTargetHash = /* @__PURE__ */ Object.create(null), this._renderTargetStack = [], this._renderer = e, e.renderableGC.addManagedHash(this, "_gpuRenderTargetHash");
  }
  /** called when dev wants to finish a render pass */
  finishRenderPass() {
    this.adaptor.finishRenderPass(this.renderTarget);
  }
  /**
   * called when the renderer starts to render a scene.
   * @param options
   * @param options.target - the render target to render to
   * @param options.clear - the clear mode to use. Can be true or a CLEAR number 'COLOR | DEPTH | STENCIL' 0b111
   * @param options.clearColor - the color to clear to
   * @param options.frame - the frame to render to
   */
  renderStart({
    target: e,
    clear: t,
    clearColor: r,
    frame: s
  }) {
    this._renderTargetStack.length = 0, this.push(
      e,
      t,
      r,
      s
    ), this.rootViewPort.copyFrom(this.viewport), this.rootRenderTarget = this.renderTarget, this.renderingToScreen = lt(this.rootRenderTarget), this.adaptor.prerender?.(this.rootRenderTarget);
  }
  postrender() {
    this.adaptor.postrender?.(this.rootRenderTarget);
  }
  /**
   * Binding a render surface! This is the main function of the render target system.
   * It will take the RenderSurface (which can be a texture, canvas, or render target) and bind it to the renderer.
   * Once bound all draw calls will be rendered to the render surface.
   *
   * If a frame is not provide and the render surface is a texture, the frame of the texture will be used.
   * @param renderSurface - the render surface to bind
   * @param clear - the clear mode to use. Can be true or a CLEAR number 'COLOR | DEPTH | STENCIL' 0b111
   * @param clearColor - the color to clear to
   * @param frame - the frame to render to
   * @returns the render target that was bound
   */
  bind(e, t = !0, r, s) {
    const n = this.getRenderTarget(e), i = this.renderTarget !== n;
    this.renderTarget = n, this.renderSurface = e;
    const o = this.getGpuRenderTarget(n);
    (n.pixelWidth !== o.width || n.pixelHeight !== o.height) && (this.adaptor.resizeGpuRenderTarget(n), o.width = n.pixelWidth, o.height = n.pixelHeight);
    const l = n.colorTexture, d = this.viewport, c = l.pixelWidth, h = l.pixelHeight;
    if (!s && e instanceof m && (s = e.frame), s) {
      const p = l._resolution;
      d.x = s.x * p + 0.5 | 0, d.y = s.y * p + 0.5 | 0, d.width = s.width * p + 0.5 | 0, d.height = s.height * p + 0.5 | 0;
    } else
      d.x = 0, d.y = 0, d.width = c, d.height = h;
    return ot(
      this.projectionMatrix,
      0,
      0,
      d.width / l.resolution,
      d.height / l.resolution,
      !n.isRoot
    ), this.adaptor.startRenderPass(n, t, r, d), i && this.onRenderTargetChange.emit(n), n;
  }
  clear(e, t = B.ALL, r) {
    t && (e && (e = this.getRenderTarget(e)), this.adaptor.clear(
      e || this.renderTarget,
      t,
      r,
      this.viewport
    ));
  }
  contextChange() {
    this._gpuRenderTargetHash = /* @__PURE__ */ Object.create(null);
  }
  /**
   * Push a render surface to the renderer. This will bind the render surface to the renderer,
   * @param renderSurface - the render surface to push
   * @param clear - the clear mode to use. Can be true or a CLEAR number 'COLOR | DEPTH | STENCIL' 0b111
   * @param clearColor - the color to clear to
   * @param frame - the frame to use when rendering to the render surface
   */
  push(e, t = B.ALL, r, s) {
    const n = this.bind(e, t, r, s);
    return this._renderTargetStack.push({
      renderTarget: n,
      frame: s
    }), n;
  }
  /** Pops the current render target from the renderer and restores the previous render target. */
  pop() {
    this._renderTargetStack.pop();
    const e = this._renderTargetStack[this._renderTargetStack.length - 1];
    this.bind(e.renderTarget, !1, null, e.frame);
  }
  /**
   * Gets the render target from the provide render surface. Eg if its a texture,
   * it will return the render target for the texture.
   * If its a render target, it will return the same render target.
   * @param renderSurface - the render surface to get the render target for
   * @returns the render target for the render surface
   */
  getRenderTarget(e) {
    return e.isTexture && (e = e.source), this._renderSurfaceToRenderTargetHash.get(e) ?? this._initRenderTarget(e);
  }
  /**
   * Copies a render surface to another texture.
   *
   * NOTE:
   * for sourceRenderSurfaceTexture, The render target must be something that is written too by the renderer
   *
   * The following is not valid:
   * @example
   * const canvas = document.createElement('canvas')
   * canvas.width = 200;
   * canvas.height = 200;
   *
   * const ctx = canvas2.getContext('2d')!
   * ctx.fillStyle = 'red'
   * ctx.fillRect(0, 0, 200, 200);
   *
   * const texture = RenderTexture.create({
   *   width: 200,
   *   height: 200,
   * })
   * const renderTarget = renderer.renderTarget.getRenderTarget(canvas2);
   *
   * renderer.renderTarget.copyToTexture(renderTarget,texture, {x:0,y:0},{width:200,height:200},{x:0,y:0});
   *
   * The best way to copy a canvas is to create a texture from it. Then render with that.
   *
   * Parsing in a RenderTarget canvas context (with a 2d context)
   * @param sourceRenderSurfaceTexture - the render surface to copy from
   * @param destinationTexture - the texture to copy to
   * @param originSrc - the origin of the copy
   * @param originSrc.x - the x origin of the copy
   * @param originSrc.y - the y origin of the copy
   * @param size - the size of the copy
   * @param size.width - the width of the copy
   * @param size.height - the height of the copy
   * @param originDest - the destination origin (top left to paste from!)
   * @param originDest.x - the x origin of the paste
   * @param originDest.y - the y origin of the paste
   */
  copyToTexture(e, t, r, s, n) {
    r.x < 0 && (s.width += r.x, n.x -= r.x, r.x = 0), r.y < 0 && (s.height += r.y, n.y -= r.y, r.y = 0);
    const { pixelWidth: i, pixelHeight: o } = e;
    return s.width = Math.min(s.width, i - r.x), s.height = Math.min(s.height, o - r.y), this.adaptor.copyToTexture(
      e,
      t,
      r,
      s,
      n
    );
  }
  /**
   * ensures that we have a depth stencil buffer available to render to
   * This is used by the mask system to make sure we have a stencil buffer.
   */
  ensureDepthStencil() {
    this.renderTarget.stencil || (this.renderTarget.stencil = !0, this.adaptor.startRenderPass(this.renderTarget, !1, null, this.viewport));
  }
  /** nukes the render target system */
  destroy() {
    this._renderer = null, this._renderSurfaceToRenderTargetHash.forEach((e, t) => {
      e !== t && e.destroy();
    }), this._renderSurfaceToRenderTargetHash.clear(), this._gpuRenderTargetHash = /* @__PURE__ */ Object.create(null);
  }
  _initRenderTarget(e) {
    let t = null;
    return U.test(e) && (e = ve(e).source), e instanceof G ? t = e : e instanceof M && (t = new G({
      colorTextures: [e]
    }), e.source instanceof U && (t.isRoot = !0), e.once("destroy", () => {
      t.destroy(), this._renderSurfaceToRenderTargetHash.delete(e);
      const r = this._gpuRenderTargetHash[t.uid];
      r && (this._gpuRenderTargetHash[t.uid] = null, this.adaptor.destroyGpuRenderTarget(r));
    })), this._renderSurfaceToRenderTargetHash.set(e, t), t;
  }
  getGpuRenderTarget(e) {
    return this._gpuRenderTargetHash[e.uid] || (this._gpuRenderTargetHash[e.uid] = this.adaptor.initGpuRenderTarget(e));
  }
  resetState() {
    this.renderTarget = null, this.renderSurface = null;
  }
}
class Ot extends Ne {
  /**
   * Create a new Buffer Resource.
   * @param options - The options for the buffer resource
   * @param options.buffer - The underlying buffer that this resource is using
   * @param options.offset - The offset of the buffer this resource is using.
   * If not provided, then it will use the offset of the buffer.
   * @param options.size - The size of the buffer this resource is using.
   * If not provided, then it will use the size of the buffer.
   */
  constructor({ buffer: e, offset: t, size: r }) {
    super(), this.uid = C("buffer"), this._resourceType = "bufferResource", this._touched = 0, this._resourceId = C("resource"), this._bufferResource = !0, this.destroyed = !1, this.buffer = e, this.offset = t | 0, this.size = r, this.buffer.on("change", this.onBufferChange, this);
  }
  onBufferChange() {
    this._resourceId = C("resource"), this.emit("change", this);
  }
  /**
   * Destroys this resource. Make sure the underlying buffer is not used anywhere else
   * if you want to destroy it as well, or code will explode
   * @param destroyBuffer - Should the underlying buffer be destroyed as well?
   */
  destroy(e = !1) {
    this.destroyed = !0, e && this.buffer.destroy(), this.emit("change", this), this.buffer = null, this.removeAllListeners();
  }
}
class _e {
  constructor(e) {
    this._renderer = e;
  }
  updateRenderable() {
  }
  destroyRenderable() {
  }
  validateRenderable() {
    return !1;
  }
  addRenderable(e, t) {
    this._renderer.renderPipes.batch.break(t), t.add(e);
  }
  execute(e) {
    e.isRenderable && e.render(this._renderer);
  }
  destroy() {
    this._renderer = null;
  }
}
_e.extension = {
  type: [
    u.WebGLPipes,
    u.WebGPUPipes,
    u.CanvasPipes
  ],
  name: "customRender"
};
function I(a, e) {
  const t = a.instructionSet, r = t.instructions;
  for (let s = 0; s < t.instructionSize; s++) {
    const n = r[s];
    e[n.renderPipeId].execute(n);
  }
}
const ut = new v();
class be {
  constructor(e) {
    this._renderer = e;
  }
  addRenderGroup(e, t) {
    e.isCachedAsTexture ? this._addRenderableCacheAsTexture(e, t) : this._addRenderableDirect(e, t);
  }
  execute(e) {
    e.isRenderable && (e.isCachedAsTexture ? this._executeCacheAsTexture(e) : this._executeDirect(e));
  }
  destroy() {
    this._renderer = null;
  }
  _addRenderableDirect(e, t) {
    this._renderer.renderPipes.batch.break(t), e._batchableRenderGroup && (S.return(e._batchableRenderGroup), e._batchableRenderGroup = null), t.add(e);
  }
  _addRenderableCacheAsTexture(e, t) {
    const r = e._batchableRenderGroup ?? (e._batchableRenderGroup = S.get(de));
    r.renderable = e.root, r.transform = e.root.relativeGroupTransform, r.texture = e.texture, r.bounds = e._textureBounds, t.add(e), this._renderer.renderPipes.blendMode.pushBlendMode(e, e.root.groupBlendMode, t), this._renderer.renderPipes.batch.addToBatch(r, t), this._renderer.renderPipes.blendMode.popBlendMode(t);
  }
  _executeCacheAsTexture(e) {
    if (e.textureNeedsUpdate) {
      e.textureNeedsUpdate = !1;
      const t = ut.identity().translate(
        -e._textureBounds.x,
        -e._textureBounds.y
      );
      this._renderer.renderTarget.push(e.texture, !0, null, e.texture.frame), this._renderer.globalUniforms.push({
        worldTransformMatrix: t,
        worldColor: 4294967295,
        offset: { x: 0, y: 0 }
      }), I(e, this._renderer.renderPipes), this._renderer.renderTarget.finishRenderPass(), this._renderer.renderTarget.pop(), this._renderer.globalUniforms.pop();
    }
    e._batchableRenderGroup._batcher.updateElement(e._batchableRenderGroup), e._batchableRenderGroup._batcher.geometry.buffers[0].update();
  }
  _executeDirect(e) {
    this._renderer.globalUniforms.push({
      worldTransformMatrix: e.inverseParentTextureTransform,
      worldColor: e.worldColorAlpha
    }), I(e, this._renderer.renderPipes), this._renderer.globalUniforms.pop();
  }
}
be.extension = {
  type: [
    u.WebGLPipes,
    u.WebGPUPipes,
    u.CanvasPipes
  ],
  name: "renderGroup"
};
function E(a, e) {
  e || (e = 0);
  for (let t = e; t < a.length && a[t]; t++)
    a[t] = null;
}
const dt = new P(), ee = oe | le | ue;
function Te(a, e = !1) {
  ct(a);
  const t = a.childrenToUpdate, r = a.updateTick++;
  for (const s in t) {
    const n = Number(s), i = t[s], o = i.list, l = i.index;
    for (let d = 0; d < l; d++) {
      const c = o[d];
      c.parentRenderGroup === a && c.relativeRenderGroupDepth === n && ye(c, r, 0);
    }
    E(o, l), i.index = 0;
  }
  if (e)
    for (let s = 0; s < a.renderGroupChildren.length; s++)
      Te(a.renderGroupChildren[s], e);
}
function ct(a) {
  const e = a.root;
  let t;
  if (a.renderGroupParent) {
    const r = a.renderGroupParent;
    a.worldTransform.appendFrom(
      e.relativeGroupTransform,
      r.worldTransform
    ), a.worldColor = ie(
      e.groupColor,
      r.worldColor
    ), t = e.groupAlpha * r.worldAlpha;
  } else
    a.worldTransform.copyFrom(e.localTransform), a.worldColor = e.localColor, t = e.localAlpha;
  t = t < 0 ? 0 : t > 1 ? 1 : t, a.worldAlpha = t, a.worldColorAlpha = a.worldColor + ((t * 255 | 0) << 24);
}
function ye(a, e, t) {
  if (e === a.updateTick)
    return;
  a.updateTick = e, a.didChange = !1;
  const r = a.localTransform;
  a.updateLocalTransform();
  const s = a.parent;
  if (s && !s.renderGroup ? (t |= a._updateFlags, a.relativeGroupTransform.appendFrom(
    r,
    s.relativeGroupTransform
  ), t & ee && te(a, s, t)) : (t = a._updateFlags, a.relativeGroupTransform.copyFrom(r), t & ee && te(a, dt, t)), !a.renderGroup) {
    const n = a.children, i = n.length;
    for (let d = 0; d < i; d++)
      ye(n[d], e, t);
    const o = a.parentRenderGroup, l = a;
    l.renderPipeId && !o.structureDidChange && o.updateRenderable(l);
  }
}
function te(a, e, t) {
  if (t & le) {
    a.groupColor = ie(
      a.localColor,
      e.groupColor
    );
    let r = a.localAlpha * e.groupAlpha;
    r = r < 0 ? 0 : r > 1 ? 1 : r, a.groupAlpha = r, a.groupColorAlpha = a.groupColor + ((r * 255 | 0) << 24);
  }
  t & ue && (a.groupBlendMode = a.localBlendMode === "inherit" ? e.groupBlendMode : a.localBlendMode), t & oe && (a.globalDisplayStatus = a.localDisplayStatus & e.globalDisplayStatus), a._updateFlags = 0;
}
function ht(a, e) {
  const { list: t } = a.childrenRenderablesToUpdate;
  let r = !1;
  for (let s = 0; s < a.childrenRenderablesToUpdate.index; s++) {
    const n = t[s];
    if (r = e[n.renderPipeId].validateRenderable(n), r)
      break;
  }
  return a.structureDidChange = r, r;
}
const ft = new v();
class ke {
  constructor(e) {
    this._renderer = e;
  }
  render({ container: e, transform: t }) {
    const r = e.parent, s = e.renderGroup.renderGroupParent;
    e.parent = null, e.renderGroup.renderGroupParent = null;
    const n = this._renderer, i = ft;
    t && (i.copyFrom(e.renderGroup.localTransform), e.renderGroup.localTransform.copyFrom(t));
    const o = n.renderPipes;
    this._updateCachedRenderGroups(e.renderGroup, null), this._updateRenderGroups(e.renderGroup), n.globalUniforms.start({
      worldTransformMatrix: t ? e.renderGroup.localTransform : e.renderGroup.worldTransform,
      worldColor: e.renderGroup.worldColorAlpha
    }), I(e.renderGroup, o), o.uniformBatch && o.uniformBatch.renderEnd(), t && e.renderGroup.localTransform.copyFrom(i), e.parent = r, e.renderGroup.renderGroupParent = s;
  }
  destroy() {
    this._renderer = null;
  }
  _updateCachedRenderGroups(e, t) {
    if (e._parentCacheAsTextureRenderGroup = t, e.isCachedAsTexture) {
      if (!e.textureNeedsUpdate)
        return;
      t = e;
    }
    for (let r = e.renderGroupChildren.length - 1; r >= 0; r--)
      this._updateCachedRenderGroups(e.renderGroupChildren[r], t);
    if (e.invalidateMatrices(), e.isCachedAsTexture) {
      if (e.textureNeedsUpdate) {
        const r = e.root.getLocalBounds();
        r.ceil();
        const s = e.texture;
        e.texture && b.returnTexture(e.texture, !0);
        const n = this._renderer, i = e.textureOptions.resolution || n.view.resolution, o = e.textureOptions.antialias ?? n.view.antialias, l = e.textureOptions.scaleMode ?? "linear", d = b.getOptimalTexture(
          r.width,
          r.height,
          i,
          o
        );
        d._source.style = new je({ scaleMode: l }), e.texture = d, e._textureBounds || (e._textureBounds = new O()), e._textureBounds.copyFrom(r), s !== e.texture && e.renderGroupParent && (e.renderGroupParent.structureDidChange = !0);
      }
    } else e.texture && (b.returnTexture(e.texture, !0), e.texture = null);
  }
  _updateRenderGroups(e) {
    const t = this._renderer, r = t.renderPipes;
    if (e.runOnRender(t), e.instructionSet.renderPipes = r, e.structureDidChange ? E(e.childrenRenderablesToUpdate.list, 0) : ht(e, r), Te(e), e.structureDidChange ? (e.structureDidChange = !1, this._buildInstructions(e, t)) : this._updateRenderables(e), e.childrenRenderablesToUpdate.index = 0, t.renderPipes.batch.upload(e.instructionSet), !(e.isCachedAsTexture && !e.textureNeedsUpdate))
      for (let s = 0; s < e.renderGroupChildren.length; s++)
        this._updateRenderGroups(e.renderGroupChildren[s]);
  }
  _updateRenderables(e) {
    const { list: t, index: r } = e.childrenRenderablesToUpdate;
    for (let s = 0; s < r; s++) {
      const n = t[s];
      n.didViewUpdate && e.updateRenderable(n);
    }
    E(t, r);
  }
  _buildInstructions(e, t) {
    const r = e.root, s = e.instructionSet;
    s.reset();
    const n = t.renderPipes ? t : t.batch.renderer, i = n.renderPipes;
    i.batch.buildStart(s), i.blendMode.buildStart(), i.colorMask.buildStart(), r.sortableChildren && r.sortChildren(), r.collectRenderablesWithEffects(s, n, null), i.batch.buildEnd(s), i.blendMode.buildEnd(s);
  }
}
ke.extension = {
  type: [
    u.WebGLSystem,
    u.WebGPUSystem,
    u.CanvasSystem
  ],
  name: "renderGroup"
};
class Ce {
  constructor(e) {
    this._renderer = e;
  }
  addRenderable(e, t) {
    const r = this._getGpuSprite(e);
    e.didViewUpdate && this._updateBatchableSprite(e, r), this._renderer.renderPipes.batch.addToBatch(r, t);
  }
  updateRenderable(e) {
    const t = this._getGpuSprite(e);
    e.didViewUpdate && this._updateBatchableSprite(e, t), t._batcher.updateElement(t);
  }
  validateRenderable(e) {
    const t = this._getGpuSprite(e);
    return !t._batcher.checkAndUpdateTexture(
      t,
      e._texture
    );
  }
  _updateBatchableSprite(e, t) {
    t.bounds = e.visualBounds, t.texture = e._texture;
  }
  _getGpuSprite(e) {
    return e._gpuData[this._renderer.uid] || this._initGPUSprite(e);
  }
  _initGPUSprite(e) {
    const t = new de();
    return t.renderable = e, t.transform = e.groupTransform, t.texture = e._texture, t.bounds = e.visualBounds, t.roundPixels = this._renderer._roundPixels | e._roundPixels, e._gpuData[this._renderer.uid] = t, t;
  }
  destroy() {
    this._renderer = null;
  }
}
Ce.extension = {
  type: [
    u.WebGLPipes,
    u.WebGPUPipes,
    u.CanvasPipes
  ],
  name: "sprite"
};
const z = class Me {
  constructor() {
    this.clearBeforeRender = !0, this._backgroundColor = new A(0), this.color = this._backgroundColor, this.alpha = 1;
  }
  /**
   * initiates the background system
   * @param options - the options for the background colors
   */
  init(e) {
    e = { ...Me.defaultOptions, ...e }, this.clearBeforeRender = e.clearBeforeRender, this.color = e.background || e.backgroundColor || this._backgroundColor, this.alpha = e.backgroundAlpha, this._backgroundColor.setAlpha(e.backgroundAlpha);
  }
  /** The background color to fill if not transparent */
  get color() {
    return this._backgroundColor;
  }
  set color(e) {
    A.shared.setValue(e).alpha < 1 && this._backgroundColor.alpha === 1 && L(
      "Cannot set a transparent background on an opaque canvas. To enable transparency, set backgroundAlpha < 1 when initializing your Application."
    ), this._backgroundColor.setValue(e);
  }
  /** The background color alpha. Setting this to 0 will make the canvas transparent. */
  get alpha() {
    return this._backgroundColor.alpha;
  }
  set alpha(e) {
    this._backgroundColor.setAlpha(e);
  }
  /** The background color as an [R, G, B, A] array. */
  get colorRgba() {
    return this._backgroundColor.toArray();
  }
  /**
   * destroys the background system
   * @internal
   */
  destroy() {
  }
};
z.extension = {
  type: [
    u.WebGLSystem,
    u.WebGPUSystem,
    u.CanvasSystem
  ],
  name: "background",
  priority: 0
};
z.defaultOptions = {
  /**
   * {@link WebGLOptions.backgroundAlpha}
   * @default 1
   */
  backgroundAlpha: 1,
  /**
   * {@link WebGLOptions.backgroundColor}
   * @default 0x000000
   */
  backgroundColor: 0,
  /**
   * {@link WebGLOptions.clearBeforeRender}
   * @default true
   */
  clearBeforeRender: !0
};
let pt = z;
const T = {};
D.handle(u.BlendMode, (a) => {
  if (!a.name)
    throw new Error("BlendMode extension must have a name property");
  T[a.name] = a.ref;
}, (a) => {
  delete T[a.name];
});
class Se {
  constructor(e) {
    this._blendModeStack = [], this._isAdvanced = !1, this._filterHash = /* @__PURE__ */ Object.create(null), this._renderer = e, this._renderer.runners.prerender.add(this);
  }
  prerender() {
    this._activeBlendMode = "normal", this._isAdvanced = !1;
  }
  /**
   * Push a blend mode onto the internal stack and apply it to the instruction set if needed.
   * @param renderable - The renderable or {@link RenderGroup} associated with the change.
   * @param blendMode - The blend mode to activate.
   * @param instructionSet - The instruction set being built.
   */
  pushBlendMode(e, t, r) {
    this._blendModeStack.push(t), this.setBlendMode(e, t, r);
  }
  /**
   * Pop the last blend mode from the stack and apply the new top-of-stack mode.
   * @param instructionSet - The instruction set being built.
   */
  popBlendMode(e) {
    this._blendModeStack.pop();
    const t = this._blendModeStack[this._activeBlendMode.length - 1] ?? "normal";
    this.setBlendMode(null, t, e);
  }
  /**
   * Ensure a blend mode switch is added to the instruction set when the mode changes.
   * If an advanced blend mode is active, subsequent renderables will be collected so they can be
   * rendered within a single filter pass.
   * @param renderable - The renderable or {@link RenderGroup} to associate with the change, or null when unwinding.
   * @param blendMode - The target blend mode.
   * @param instructionSet - The instruction set being built.
   */
  setBlendMode(e, t, r) {
    const s = e instanceof J;
    if (this._activeBlendMode === t) {
      this._isAdvanced && e && !s && this._renderableList?.push(e);
      return;
    }
    this._isAdvanced && this._endAdvancedBlendMode(r), this._activeBlendMode = t, e && (this._isAdvanced = !!T[t], this._isAdvanced && this._beginAdvancedBlendMode(e, r));
  }
  _beginAdvancedBlendMode(e, t) {
    this._renderer.renderPipes.batch.break(t);
    const r = this._activeBlendMode;
    if (!T[r]) {
      L(`Unable to assign BlendMode: '${r}'. You may want to include: import 'pixi.js/advanced-blend-modes'`);
      return;
    }
    const s = this._ensureFilterEffect(r), n = e instanceof J, i = {
      renderPipeId: "filter",
      action: "pushFilter",
      filterEffect: s,
      renderables: n ? null : [e],
      container: n ? e.root : null,
      canBundle: !1
    };
    this._renderableList = i.renderables, t.add(i);
  }
  _ensureFilterEffect(e) {
    let t = this._filterHash[e];
    return t || (t = this._filterHash[e] = new ne(), t.filters = [new T[e]()]), t;
  }
  _endAdvancedBlendMode(e) {
    this._isAdvanced = !1, this._renderableList = null, this._renderer.renderPipes.batch.break(e), e.add({
      renderPipeId: "filter",
      action: "popFilter",
      canBundle: !1
    });
  }
  /**
   * called when the instruction build process is starting this will reset internally to the default blend mode
   * @internal
   */
  buildStart() {
    this._isAdvanced = !1;
  }
  /**
   * called when the instruction build process is finished, ensuring that if there is an advanced blend mode
   * active, we add the final render instructions added to the instruction set
   * @param instructionSet - The instruction set we are adding to
   * @internal
   */
  buildEnd(e) {
    this._isAdvanced && this._endAdvancedBlendMode(e);
  }
  /** @internal */
  destroy() {
    this._renderer = null, this._renderableList = null;
    for (const e in this._filterHash)
      this._filterHash[e].destroy();
    this._filterHash = null;
  }
}
Se.extension = {
  type: [
    u.WebGLPipes,
    u.WebGPUPipes,
    u.CanvasPipes
  ],
  name: "blendMode"
};
const R = {
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp"
}, V = class we {
  /** @param renderer - The renderer this System works for. */
  constructor(e) {
    this._renderer = e;
  }
  _normalizeOptions(e, t = {}) {
    return e instanceof P || e instanceof m ? {
      target: e,
      ...t
    } : {
      ...t,
      ...e
    };
  }
  /**
   * Creates an IImage from a display object or texture.
   * @param options - Options for creating the image, or the target to extract
   * @returns Promise that resolves with the generated IImage
   * @example
   * ```ts
   * // Basic usage with a sprite
   * const sprite = new Sprite(texture);
   * const image = await renderer.extract.image(sprite);
   * document.body.appendChild(image);
   *
   * // Advanced usage with options
   * const image = await renderer.extract.image({
   *     target: container,
   *     format: 'webp',
   *     quality: 0.8,
   *     frame: new Rectangle(0, 0, 100, 100),
   *     resolution: 2,
   *     clearColor: '#ff0000',
   *     antialias: true
   * });
   *
   * // Extract directly from a texture
   * const texture = Texture.from('myTexture.png');
   * const image = await renderer.extract.image(texture);
   * ```
   * @see {@link ExtractImageOptions} For detailed options
   * @see {@link ExtractSystem.base64} For base64 string output
   * @see {@link ExtractSystem.canvas} For canvas output
   * @see {@link ImageLike} For the image interface
   * @category rendering
   */
  async image(e) {
    const t = H.get().createImage();
    return t.src = await this.base64(e), t;
  }
  /**
   * Converts the target into a base64 encoded string.
   *
   * This method works by first creating
   * a canvas using `Extract.canvas` and then converting it to a base64 string.
   * @param options - The options for creating the base64 string, or the target to extract
   * @returns Promise that resolves with the base64 encoded string
   * @example
   * ```ts
   * // Basic usage with a sprite
   * const sprite = new Sprite(texture);
   * const base64 = await renderer.extract.base64(sprite);
   * console.log(base64); // data:image/png;base64,...
   *
   * // Advanced usage with options
   * const base64 = await renderer.extract.base64({
   *     target: container,
   *     format: 'webp',
   *     quality: 0.8,
   *     frame: new Rectangle(0, 0, 100, 100),
   *     resolution: 2
   * });
   * ```
   * @throws Will throw an error if the platform doesn't support any of:
   * - ICanvas.toDataURL
   * - ICanvas.toBlob
   * - ICanvas.convertToBlob
   * @see {@link ExtractImageOptions} For detailed options
   * @see {@link ExtractSystem.canvas} For canvas output
   * @see {@link ExtractSystem.image} For HTMLImage output
   * @category rendering
   */
  async base64(e) {
    e = this._normalizeOptions(
      e,
      we.defaultImageOptions
    );
    const { format: t, quality: r } = e, s = this.canvas(e);
    if (s.toBlob !== void 0)
      return new Promise((n, i) => {
        s.toBlob((o) => {
          if (!o) {
            i(new Error("ICanvas.toBlob failed!"));
            return;
          }
          const l = new FileReader();
          l.onload = () => n(l.result), l.onerror = i, l.readAsDataURL(o);
        }, R[t], r);
      });
    if (s.toDataURL !== void 0)
      return s.toDataURL(R[t], r);
    if (s.convertToBlob !== void 0) {
      const n = await s.convertToBlob({ type: R[t], quality: r });
      return new Promise((i, o) => {
        const l = new FileReader();
        l.onload = () => i(l.result), l.onerror = o, l.readAsDataURL(n);
      });
    }
    throw new Error("Extract.base64() requires ICanvas.toDataURL, ICanvas.toBlob, or ICanvas.convertToBlob to be implemented");
  }
  /**
   * Creates a Canvas element, renders the target to it and returns it.
   * This method is useful for creating static images or when you need direct canvas access.
   * @param options - The options for creating the canvas, or the target to extract
   * @returns A Canvas element with the texture rendered on
   * @example
   * ```ts
   * // Basic canvas extraction from a sprite
   * const sprite = new Sprite(texture);
   * const canvas = renderer.extract.canvas(sprite);
   * document.body.appendChild(canvas);
   *
   * // Extract with custom region
   * const canvas = renderer.extract.canvas({
   *     target: container,
   *     frame: new Rectangle(0, 0, 100, 100)
   * });
   *
   * // Extract with high resolution
   * const canvas = renderer.extract.canvas({
   *     target: sprite,
   *     resolution: 2,
   *     clearColor: '#ff0000'
   * });
   *
   * // Extract directly from a texture
   * const texture = Texture.from('myTexture.png');
   * const canvas = renderer.extract.canvas(texture);
   *
   * // Extract with anti-aliasing
   * const canvas = renderer.extract.canvas({
   *     target: graphics,
   *     antialias: true
   * });
   * ```
   * @see {@link ExtractOptions} For detailed options
   * @see {@link ExtractSystem.image} For HTMLImage output
   * @see {@link ExtractSystem.pixels} For raw pixel data
   * @category rendering
   */
  canvas(e) {
    e = this._normalizeOptions(e);
    const t = e.target, r = this._renderer;
    if (t instanceof m)
      return r.texture.generateCanvas(t);
    const s = r.textureGenerator.generateTexture(e), n = r.texture.generateCanvas(s);
    return s.destroy(!0), n;
  }
  /**
   * Returns a one-dimensional array containing the pixel data of the entire texture in RGBA order,
   * with integer values between 0 and 255 (inclusive).
   * > [!NOE] The returned array is a flat Uint8Array where every 4 values represent RGBA
   * @param options - The options for extracting the image, or the target to extract
   * @returns One-dimensional Uint8Array containing the pixel data in RGBA format
   * @example
   * ```ts
   * // Basic pixel extraction
   * const sprite = new Sprite(texture);
   * const pixels = renderer.extract.pixels(sprite);
   * console.log(pixels[0], pixels[1], pixels[2], pixels[3]); // R,G,B,A values
   *
   * // Extract with custom region
   * const pixels = renderer.extract.pixels({
   *     target: sprite,
   *     frame: new Rectangle(0, 0, 100, 100)
   * });
   *
   * // Extract with high resolution
   * const pixels = renderer.extract.pixels({
   *     target: sprite,
   *     resolution: 2
   * });
   * ```
   * @see {@link ExtractOptions} For detailed options
   * @see {@link ExtractSystem.canvas} For canvas output
   * @see {@link ExtractSystem.image} For image output
   * @category rendering
   */
  pixels(e) {
    e = this._normalizeOptions(e);
    const t = e.target, r = this._renderer, s = t instanceof m ? t : r.textureGenerator.generateTexture(e), n = r.texture.getPixels(s);
    return t instanceof P && s.destroy(!0), n;
  }
  /**
   * Creates a texture from a display object or existing texture.
   *
   * This is useful for creating
   * reusable textures from rendered content or making copies of existing textures.
   * > [!NOTE] The returned texture should be destroyed when no longer needed
   * @param options - The options for creating the texture, or the target to extract
   * @returns A new texture containing the extracted content
   * @example
   * ```ts
   * // Basic texture extraction from a sprite
   * const sprite = new Sprite(texture);
   * const extractedTexture = renderer.extract.texture(sprite);
   *
   * // Extract with custom region
   * const regionTexture = renderer.extract.texture({
   *     target: container,
   *     frame: new Rectangle(0, 0, 100, 100)
   * });
   *
   * // Extract with high resolution
   * const hiResTexture = renderer.extract.texture({
   *     target: sprite,
   *     resolution: 2,
   *     clearColor: '#ff0000'
   * });
   *
   * // Create a new sprite from extracted texture
   * const newSprite = new Sprite(
   *     renderer.extract.texture({
   *         target: graphics,
   *         antialias: true
   *     })
   * );
   *
   * // Clean up when done
   * extractedTexture.destroy(true);
   * ```
   * @see {@link ExtractOptions} For detailed options
   * @see {@link Texture} For texture management
   * @see {@link GenerateTextureSystem} For texture generation
   * @category rendering
   */
  texture(e) {
    return e = this._normalizeOptions(e), e.target instanceof m ? e.target : this._renderer.textureGenerator.generateTexture(e);
  }
  /**
   * Extracts and downloads content from the renderer as an image file.
   * This is a convenient way to save screenshots or export rendered content.
   * > [!NOTE] The download will use PNG format regardless of the filename extension
   * @param options - The options for downloading and extracting the image, or the target to extract
   * @example
   * ```ts
   * // Basic download with default filename
   * const sprite = new Sprite(texture);
   * renderer.extract.download(sprite); // Downloads as 'image.png'
   *
   * // Download with custom filename
   * renderer.extract.download({
   *     target: sprite,
   *     filename: 'screenshot.png'
   * });
   *
   * // Download with custom region
   * renderer.extract.download({
   *     target: container,
   *     filename: 'region.png',
   *     frame: new Rectangle(0, 0, 100, 100)
   * });
   *
   * // Download with high resolution and background
   * renderer.extract.download({
   *     target: stage,
   *     filename: 'hd-screenshot.png',
   *     resolution: 2,
   *     clearColor: '#ff0000'
   * });
   *
   * // Download with anti-aliasing
   * renderer.extract.download({
   *     target: graphics,
   *     filename: 'smooth.png',
   *     antialias: true
   * });
   * ```
   * @see {@link ExtractDownloadOptions} For detailed options
   * @see {@link ExtractSystem.image} For creating images without download
   * @see {@link ExtractSystem.canvas} For canvas output
   * @category rendering
   */
  download(e) {
    e = this._normalizeOptions(e);
    const t = this.canvas(e), r = document.createElement("a");
    r.download = e.filename ?? "image.png", r.href = t.toDataURL("image/png"), document.body.appendChild(r), r.click(), document.body.removeChild(r);
  }
  /**
   * Logs the target to the console as an image. This is a useful way to debug what's happening in the renderer.
   * The image will be displayed in the browser's console using CSS background images.
   * @param options - The options for logging the image, or the target to log
   * @param options.width - The width of the logged image preview in the console (in pixels)
   * @example
   * ```ts
   * // Basic usage
   * const sprite = new Sprite(texture);
   * renderer.extract.log(sprite);
   * ```
   * @see {@link ExtractSystem.canvas} For getting raw canvas output
   * @see {@link ExtractSystem.pixels} For raw pixel data
   * @category rendering
   * @advanced
   */
  log(e) {
    const t = e.width ?? 200;
    e = this._normalizeOptions(e);
    const r = this.canvas(e), s = r.toDataURL();
    console.log(`[Pixi Texture] ${r.width}px ${r.height}px`);
    const n = [
      "font-size: 1px;",
      `padding: ${t}px 300px;`,
      `background: url(${s}) no-repeat;`,
      "background-size: contain;"
    ].join(" ");
    console.log("%c ", n);
  }
  destroy() {
    this._renderer = null;
  }
};
V.extension = {
  type: [
    u.WebGLSystem,
    u.WebGPUSystem
  ],
  name: "extract"
};
V.defaultImageOptions = {
  format: "png",
  quality: 1
};
let mt = V;
const vt = new w(), gt = new O(), xt = [0, 0, 0, 0];
class Pe {
  constructor(e) {
    this._renderer = e;
  }
  /**
   * Creates a texture from a display object that can be used for creating sprites and other textures.
   * This is particularly useful for optimizing performance when a complex container needs to be reused.
   * @param options - Generate texture options or a container to convert to texture
   * @returns A new RenderTexture containing the rendered display object
   * @example
   * ```ts
   * // Basic usage with a container
   * const container = new Container();
   * container.addChild(
   *     new Graphics()
   *         .circle(0, 0, 50)
   *         .fill('red')
   * );
   *
   * const texture = renderer.textureGenerator.generateTexture(container);
   *
   * // Advanced usage with options
   * const texture = renderer.textureGenerator.generateTexture({
   *     target: container,
   *     frame: new Rectangle(0, 0, 100, 100), // Specific region
   *     resolution: 2,                        // High DPI
   *     clearColor: '#ff0000',               // Red background
   *     antialias: true                      // Smooth edges
   * });
   *
   * // Create a sprite from the generated texture
   * const sprite = new Sprite(texture);
   *
   * // Clean up when done
   * texture.destroy(true);
   * ```
   * @see {@link GenerateTextureOptions} For detailed texture generation options
   * @see {@link RenderTexture} For the type of texture created
   * @category rendering
   */
  generateTexture(e) {
    e instanceof P && (e = {
      target: e,
      frame: void 0,
      textureSourceOptions: {},
      resolution: void 0
    });
    const t = e.resolution || this._renderer.resolution, r = e.antialias || this._renderer.view.antialias, s = e.target;
    let n = e.clearColor;
    n ? n = Array.isArray(n) && n.length === 4 ? n : A.shared.setValue(n).toArray() : n = xt;
    const i = e.frame?.copyTo(vt) || $e(s, gt).rectangle;
    i.width = Math.max(i.width, 1 / t) | 0, i.height = Math.max(i.height, 1 / t) | 0;
    const o = qe.create({
      ...e.textureSourceOptions,
      width: i.width,
      height: i.height,
      resolution: t,
      antialias: r
    }), l = v.shared.translate(-i.x, -i.y);
    return this._renderer.render({
      container: s,
      transform: l,
      target: o,
      clearColor: n
    }), o.source.updateMipmaps(), o;
  }
  destroy() {
    this._renderer = null;
  }
}
Pe.extension = {
  type: [
    u.WebGLSystem,
    u.WebGPUSystem
  ],
  name: "textureGenerator"
};
class Re {
  constructor(e) {
    this._stackIndex = 0, this._globalUniformDataStack = [], this._uniformsPool = [], this._activeUniforms = [], this._bindGroupPool = [], this._activeBindGroups = [], this._renderer = e;
  }
  reset() {
    this._stackIndex = 0;
    for (let e = 0; e < this._activeUniforms.length; e++)
      this._uniformsPool.push(this._activeUniforms[e]);
    for (let e = 0; e < this._activeBindGroups.length; e++)
      this._bindGroupPool.push(this._activeBindGroups[e]);
    this._activeUniforms.length = 0, this._activeBindGroups.length = 0;
  }
  start(e) {
    this.reset(), this.push(e);
  }
  bind({
    size: e,
    projectionMatrix: t,
    worldTransformMatrix: r,
    worldColor: s,
    offset: n
  }) {
    const i = this._renderer.renderTarget.renderTarget, o = this._stackIndex ? this._globalUniformDataStack[this._stackIndex - 1] : {
      worldTransformMatrix: new v(),
      worldColor: 4294967295,
      offset: new Ke()
    }, l = {
      projectionMatrix: t || this._renderer.renderTarget.projectionMatrix,
      resolution: e || i.size,
      worldTransformMatrix: r || o.worldTransformMatrix,
      worldColor: s || o.worldColor,
      offset: n || o.offset,
      bindGroup: null
    }, d = this._uniformsPool.pop() || this._createUniforms();
    this._activeUniforms.push(d);
    const c = d.uniforms;
    c.uProjectionMatrix = l.projectionMatrix, c.uResolution = l.resolution, c.uWorldTransformMatrix.copyFrom(l.worldTransformMatrix), c.uWorldTransformMatrix.tx -= l.offset.x, c.uWorldTransformMatrix.ty -= l.offset.y, Ze(
      l.worldColor,
      c.uWorldColorAlpha,
      0
    ), d.update();
    let h;
    this._renderer.renderPipes.uniformBatch ? h = this._renderer.renderPipes.uniformBatch.getUniformBindGroup(d, !1) : (h = this._bindGroupPool.pop() || new Ye(), this._activeBindGroups.push(h), h.setResource(d, 0)), l.bindGroup = h, this._currentGlobalUniformData = l;
  }
  push(e) {
    this.bind(e), this._globalUniformDataStack[this._stackIndex++] = this._currentGlobalUniformData;
  }
  pop() {
    this._currentGlobalUniformData = this._globalUniformDataStack[--this._stackIndex - 1], this._renderer.type === F.WEBGL && this._currentGlobalUniformData.bindGroup.resources[0].update();
  }
  get bindGroup() {
    return this._currentGlobalUniformData.bindGroup;
  }
  get globalUniformData() {
    return this._currentGlobalUniformData;
  }
  get uniformGroup() {
    return this._currentGlobalUniformData.bindGroup.resources[0];
  }
  _createUniforms() {
    return new se({
      uProjectionMatrix: { value: new v(), type: "mat3x3<f32>" },
      uWorldTransformMatrix: { value: new v(), type: "mat3x3<f32>" },
      // TODO - someone smart - set this to be a unorm8x4 rather than a vec4<f32>
      uWorldColorAlpha: { value: new Float32Array(4), type: "vec4<f32>" },
      uResolution: { value: [0, 0], type: "vec2<f32>" }
    }, {
      isStatic: !0
    });
  }
  destroy() {
    this._renderer = null, this._globalUniformDataStack.length = 0, this._uniformsPool.length = 0, this._activeUniforms.length = 0, this._bindGroupPool.length = 0, this._activeBindGroups.length = 0, this._currentGlobalUniformData = null;
  }
}
Re.extension = {
  type: [
    u.WebGLSystem,
    u.WebGPUSystem,
    u.CanvasSystem
  ],
  name: "globalUniforms"
};
let _t = 1;
class Be {
  constructor() {
    this._tasks = [], this._offset = 0;
  }
  /** Initializes the scheduler system and starts the ticker. */
  init() {
    X.system.add(this._update, this);
  }
  /**
   * Schedules a repeating task.
   * @param func - The function to execute.
   * @param duration - The interval duration in milliseconds.
   * @param useOffset - this will spread out tasks so that they do not all run at the same time
   * @returns The unique identifier for the scheduled task.
   */
  repeat(e, t, r = !0) {
    const s = _t++;
    let n = 0;
    return r && (this._offset += 1e3, n = this._offset), this._tasks.push({
      func: e,
      duration: t,
      start: performance.now(),
      offset: n,
      last: performance.now(),
      repeat: !0,
      id: s
    }), s;
  }
  /**
   * Cancels a scheduled task.
   * @param id - The unique identifier of the task to cancel.
   */
  cancel(e) {
    for (let t = 0; t < this._tasks.length; t++)
      if (this._tasks[t].id === e) {
        this._tasks.splice(t, 1);
        return;
      }
  }
  /**
   * Updates and executes the scheduled tasks.
   * @private
   */
  _update() {
    const e = performance.now();
    for (let t = 0; t < this._tasks.length; t++) {
      const r = this._tasks[t];
      if (e - r.offset - r.last >= r.duration) {
        const s = e - r.start;
        r.func(s), r.last = e;
      }
    }
  }
  /**
   * Destroys the scheduler system and removes all tasks.
   * @internal
   */
  destroy() {
    X.system.remove(this._update, this), this._tasks.length = 0;
  }
}
Be.extension = {
  type: [
    u.WebGLSystem,
    u.WebGPUSystem,
    u.CanvasSystem
  ],
  name: "scheduler",
  priority: 0
};
let re = !1;
function bt(a) {
  if (!re) {
    if (H.get().getNavigator().userAgent.toLowerCase().indexOf("chrome") > -1) {
      const e = [
        `%c  %c  %c  %c  %c PixiJS %c v${Q} (${a}) http://www.pixijs.com/

`,
        "background: #E72264; padding:5px 0;",
        "background: #6CA2EA; padding:5px 0;",
        "background: #B5D33D; padding:5px 0;",
        "background: #FED23F; padding:5px 0;",
        "color: #FFFFFF; background: #E72264; padding:5px 0;",
        "color: #E72264; background: #FFFFFF; padding:5px 0;"
      ];
      globalThis.console.log(...e);
    } else globalThis.console && globalThis.console.log(`PixiJS ${Q} - ${a} - http://www.pixijs.com/`);
    re = !0;
  }
}
class N {
  constructor(e) {
    this._renderer = e;
  }
  /**
   * It all starts here! This initiates every system, passing in the options for any system by name.
   * @param options - the config for the renderer and all its systems
   */
  init(e) {
    if (e.hello) {
      let t = this._renderer.name;
      this._renderer.type === F.WEBGL && (t += ` ${this._renderer.context.webGLVersion}`), bt(t);
    }
  }
}
N.extension = {
  type: [
    u.WebGLSystem,
    u.WebGPUSystem,
    u.CanvasSystem
  ],
  name: "hello",
  priority: -2
};
N.defaultOptions = {
  /** {@link WebGLOptions.hello} */
  hello: !1
};
function Tt(a) {
  let e = !1;
  for (const r in a)
    if (a[r] == null) {
      e = !0;
      break;
    }
  if (!e)
    return a;
  const t = /* @__PURE__ */ Object.create(null);
  for (const r in a) {
    const s = a[r];
    s && (t[r] = s);
  }
  return t;
}
function yt(a) {
  let e = 0;
  for (let t = 0; t < a.length; t++)
    a[t] == null ? e++ : a[t - e] = a[t];
  return a.length -= e, a;
}
let kt = 0;
const j = class Ue {
  /**
   * Creates a new RenderableGCSystem instance.
   * @param renderer - The renderer this garbage collection system works for
   */
  constructor(e) {
    this._managedRenderables = [], this._managedHashes = [], this._managedArrays = [], this._renderer = e;
  }
  /**
   * Initializes the garbage collection system with the provided options.
   * @param options - Configuration options for the renderer
   */
  init(e) {
    e = { ...Ue.defaultOptions, ...e }, this.maxUnusedTime = e.renderableGCMaxUnusedTime, this._frequency = e.renderableGCFrequency, this.enabled = e.renderableGCActive;
  }
  /**
   * Gets whether the garbage collection system is currently enabled.
   * @returns True if GC is enabled, false otherwise
   */
  get enabled() {
    return !!this._handler;
  }
  /**
   * Enables or disables the garbage collection system.
   * When enabled, schedules periodic cleanup of resources.
   * When disabled, cancels all scheduled cleanups.
   */
  set enabled(e) {
    this.enabled !== e && (e ? (this._handler = this._renderer.scheduler.repeat(
      () => this.run(),
      this._frequency,
      !1
    ), this._hashHandler = this._renderer.scheduler.repeat(
      () => {
        for (const t of this._managedHashes)
          t.context[t.hash] = Tt(t.context[t.hash]);
      },
      this._frequency
    ), this._arrayHandler = this._renderer.scheduler.repeat(
      () => {
        for (const t of this._managedArrays)
          yt(t.context[t.hash]);
      },
      this._frequency
    )) : (this._renderer.scheduler.cancel(this._handler), this._renderer.scheduler.cancel(this._hashHandler), this._renderer.scheduler.cancel(this._arrayHandler)));
  }
  /**
   * Adds a hash table to be managed by the garbage collector.
   * @param context - The object containing the hash table
   * @param hash - The property name of the hash table
   */
  addManagedHash(e, t) {
    this._managedHashes.push({ context: e, hash: t });
  }
  /**
   * Adds an array to be managed by the garbage collector.
   * @param context - The object containing the array
   * @param hash - The property name of the array
   */
  addManagedArray(e, t) {
    this._managedArrays.push({ context: e, hash: t });
  }
  /**
   * Updates the GC timestamp and tracking before rendering.
   * @param options - The render options
   * @param options.container - The container to render
   */
  prerender({
    container: e
  }) {
    this._now = performance.now(), e.renderGroup.gcTick = kt++, this._updateInstructionGCTick(e.renderGroup, e.renderGroup.gcTick);
  }
  /**
   * Starts tracking a renderable for garbage collection.
   * @param renderable - The renderable to track
   */
  addRenderable(e) {
    this.enabled && (e._lastUsed === -1 && (this._managedRenderables.push(e), e.once("destroyed", this._removeRenderable, this)), e._lastUsed = this._now);
  }
  /**
   * Performs garbage collection by cleaning up unused renderables.
   * Removes renderables that haven't been used for longer than maxUnusedTime.
   */
  run() {
    const e = this._now, t = this._managedRenderables, r = this._renderer.renderPipes;
    let s = 0;
    for (let n = 0; n < t.length; n++) {
      const i = t[n];
      if (i === null) {
        s++;
        continue;
      }
      const o = i.renderGroup ?? i.parentRenderGroup, l = o?.instructionSet?.gcTick ?? -1;
      if ((o?.gcTick ?? 0) === l && (i._lastUsed = e), e - i._lastUsed > this.maxUnusedTime) {
        if (!i.destroyed) {
          const d = r;
          o && (o.structureDidChange = !0), d[i.renderPipeId].destroyRenderable(i);
        }
        i._lastUsed = -1, s++, i.off("destroyed", this._removeRenderable, this);
      } else
        t[n - s] = i;
    }
    t.length -= s;
  }
  /** Cleans up the garbage collection system. Disables GC and removes all tracked resources. */
  destroy() {
    this.enabled = !1, this._renderer = null, this._managedRenderables.length = 0, this._managedHashes.length = 0, this._managedArrays.length = 0;
  }
  /**
   * Removes a renderable from being tracked when it's destroyed.
   * @param renderable - The renderable to stop tracking
   */
  _removeRenderable(e) {
    const t = this._managedRenderables.indexOf(e);
    t >= 0 && (e.off("destroyed", this._removeRenderable, this), this._managedRenderables[t] = null);
  }
  /**
   * Updates the GC tick counter for a render group and its children.
   * @param renderGroup - The render group to update
   * @param gcTick - The new tick value
   */
  _updateInstructionGCTick(e, t) {
    e.instructionSet.gcTick = t;
    for (const r of e.renderGroupChildren)
      this._updateInstructionGCTick(r, t);
  }
};
j.extension = {
  type: [
    u.WebGLSystem,
    u.WebGPUSystem
  ],
  name: "renderableGC",
  priority: 0
};
j.defaultOptions = {
  /** Enable/disable the garbage collector */
  renderableGCActive: !0,
  /** Time in ms before an unused resource is collected (default 1 minute) */
  renderableGCMaxUnusedTime: 6e4,
  /** How often to run garbage collection in ms (default 30 seconds) */
  renderableGCFrequency: 3e4
};
let Ct = j;
const $ = class Ae {
  /** @param renderer - The renderer this System works for. */
  constructor(e) {
    this._renderer = e, this.count = 0, this.checkCount = 0;
  }
  init(e) {
    e = { ...Ae.defaultOptions, ...e }, this.checkCountMax = e.textureGCCheckCountMax, this.maxIdle = e.textureGCAMaxIdle ?? e.textureGCMaxIdle, this.active = e.textureGCActive;
  }
  /**
   * Checks to see when the last time a texture was used.
   * If the texture has not been used for a specified amount of time, it will be removed from the GPU.
   */
  postrender() {
    this._renderer.renderingToScreen && (this.count++, this.active && (this.checkCount++, this.checkCount > this.checkCountMax && (this.checkCount = 0, this.run())));
  }
  /**
   * Checks to see when the last time a texture was used.
   * If the texture has not been used for a specified amount of time, it will be removed from the GPU.
   */
  run() {
    const e = this._renderer.texture.managedTextures;
    for (let t = 0; t < e.length; t++) {
      const r = e[t];
      r.autoGarbageCollect && r.resource && r._touched > -1 && this.count - r._touched > this.maxIdle && (r._touched = -1, r.unload());
    }
  }
  destroy() {
    this._renderer = null;
  }
};
$.extension = {
  type: [
    u.WebGLSystem,
    u.WebGPUSystem
  ],
  name: "textureGC"
};
$.defaultOptions = {
  /**
   * If set to true, this will enable the garbage collector on the GPU.
   * @default true
   */
  textureGCActive: !0,
  /**
   * @deprecated since 8.3.0
   * @see {@link TextureGCSystemOptions.textureGCMaxIdle}
   */
  textureGCAMaxIdle: null,
  /**
   * The maximum idle frames before a texture is destroyed by garbage collection.
   * @default 60 * 60
   */
  textureGCMaxIdle: 3600,
  /**
   * Frames between two garbage collections.
   * @default 600
   */
  textureGCCheckCountMax: 600
};
let Mt = $;
const q = class Ge {
  /**
   * Whether CSS dimensions of canvas view should be resized to screen dimensions automatically.
   * This is only supported for HTMLCanvasElement and will be ignored if the canvas is an OffscreenCanvas.
   * @type {boolean}
   */
  get autoDensity() {
    return this.texture.source.autoDensity;
  }
  set autoDensity(e) {
    this.texture.source.autoDensity = e;
  }
  /** The resolution / device pixel ratio of the renderer. */
  get resolution() {
    return this.texture.source._resolution;
  }
  set resolution(e) {
    this.texture.source.resize(
      this.texture.source.width,
      this.texture.source.height,
      e
    );
  }
  /**
   * initiates the view system
   * @param options - the options for the view
   */
  init(e) {
    e = {
      ...Ge.defaultOptions,
      ...e
    }, e.view && (Je(Xe, "ViewSystem.view has been renamed to ViewSystem.canvas"), e.canvas = e.view), this.screen = new w(0, 0, e.width, e.height), this.canvas = e.canvas || H.get().createCanvas(), this.antialias = !!e.antialias, this.texture = ve(this.canvas, e), this.renderTarget = new G({
      colorTextures: [this.texture],
      depth: !!e.depth,
      isRoot: !0
    }), this.texture.source.transparent = e.backgroundAlpha < 1, this.resolution = e.resolution;
  }
  /**
   * Resizes the screen and canvas to the specified dimensions.
   * @param desiredScreenWidth - The new width of the screen.
   * @param desiredScreenHeight - The new height of the screen.
   * @param resolution
   */
  resize(e, t, r) {
    this.texture.source.resize(e, t, r), this.screen.width = this.texture.frame.width, this.screen.height = this.texture.frame.height;
  }
  /**
   * Destroys this System and optionally removes the canvas from the dom.
   * @param {options | false} options - The options for destroying the view, or "false".
   * @example
   * viewSystem.destroy();
   * viewSystem.destroy(true);
   * viewSystem.destroy({ removeView: true });
   */
  destroy(e = !1) {
    (typeof e == "boolean" ? e : !!e?.removeView) && this.canvas.parentNode && this.canvas.parentNode.removeChild(this.canvas), this.texture.destroy();
  }
};
q.extension = {
  type: [
    u.WebGLSystem,
    u.WebGPUSystem,
    u.CanvasSystem
  ],
  name: "view",
  priority: 0
};
q.defaultOptions = {
  /**
   * {@link WebGLOptions.width}
   * @default 800
   */
  width: 800,
  /**
   * {@link WebGLOptions.height}
   * @default 600
   */
  height: 600,
  /**
   * {@link WebGLOptions.autoDensity}
   * @default false
   */
  autoDensity: !1,
  /**
   * {@link WebGLOptions.antialias}
   * @default false
   */
  antialias: !1
};
let St = q;
const Ft = [
  pt,
  Re,
  N,
  St,
  ke,
  Mt,
  Pe,
  mt,
  Qe,
  Ct,
  Be
], Lt = [
  Se,
  he,
  Ce,
  be,
  fe,
  me,
  pe,
  _e
];
export {
  Ot as B,
  _ as G,
  Dt as R,
  Ft as S,
  Gt as U,
  Lt as a,
  it as b,
  It as c,
  k as d,
  At as e,
  Ut as f,
  Bt as t,
  Et as u
};
