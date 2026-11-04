import { bus, EVENTS } from './events.js';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { STATE_FACTORY } from './states.js';

// 可控关节定义：name = VRM 人形骨骼名，label = 中文名，group = 面板分组
export const BONE_DEFS = [
  { name: 'head',          label: '头部',   group: '头颈' },
  { name: 'neck',          label: '颈部',   group: '头颈' },
  { name: 'upperChest',    label: '上胸',   group: '躯干' },
  { name: 'chest',         label: '胸腔',   group: '躯干' },
  { name: 'spine',         label: '腰脊',   group: '躯干' },
  { name: 'hips',          label: '髋部',   group: '躯干' },
  { name: 'leftShoulder',  label: '左肩',   group: '左臂' },
  { name: 'leftUpperArm',  label: '左大臂', group: '左臂', range: 2.8 },
  { name: 'leftLowerArm',  label: '左小臂', group: '左臂', range: 2.6 },
  { name: 'leftHand',      label: '左手腕', group: '左臂' },
  { name: 'rightShoulder', label: '右肩',   group: '右臂' },
  { name: 'rightUpperArm', label: '右大臂', group: '右臂', range: 2.8 },
  { name: 'rightLowerArm', label: '右小臂', group: '右臂', range: 2.6 },
  { name: 'rightHand',     label: '右手腕', group: '右臂' },
  { name: 'leftUpperLeg',  label: '左大腿', group: '左腿', range: 2.2 },
  { name: 'leftLowerLeg',  label: '左小腿', group: '左腿', range: 2.2 },
  { name: 'leftFoot',      label: '左脚踝', group: '左腿' },
  { name: 'rightUpperLeg', label: '右大腿', group: '右腿', range: 2.2 },
  { name: 'rightLowerLeg', label: '右小腿', group: '右腿', range: 2.2 },
  { name: 'rightFoot',     label: '右脚踝', group: '右腿' },
];

// GLB 模式逐帧应用顺序（必须父骨在前，保证世界矩阵级联正确）
const BONE_ORDER = [
  'hips', 'spine', 'chest', 'upperChest', 'neck', 'head',
  'leftShoulder', 'leftUpperArm', 'leftLowerArm', 'leftHand',
  'rightShoulder', 'rightUpperArm', 'rightLowerArm', 'rightHand',
  'leftUpperLeg', 'leftLowerLeg', 'leftFoot',
  'rightUpperLeg', 'rightLowerLeg', 'rightFoot',
];

// 通用 GLB 骨骼名解析：规范名 → 各家命名（统一小写、去 mixamorig 前缀后匹配）
const GLB_BONE_ALIASES = {
  hips: ['hips'], spine: ['spine'], chest: ['spine1'], upperChest: ['spine2'],
  neck: ['neck'], head: ['head'],
  leftShoulder: ['leftshoulder'], leftUpperArm: ['leftarm'], leftLowerArm: ['leftforearm'], leftHand: ['lefthand'],
  rightShoulder: ['rightshoulder'], rightUpperArm: ['rightarm'], rightLowerArm: ['rightforearm'], rightHand: ['righthand'],
  leftUpperLeg: ['leftupleg'], leftLowerLeg: ['leftleg'], leftFoot: ['leftfoot'],
  rightUpperLeg: ['rightupleg'], rightLowerLeg: ['rightleg'], rightFoot: ['rightfoot'],
  leftEye: ['lefteye'], rightEye: ['righteye'],
};

// 规范表情 → ARKit 52 BlendShape 组合（RPM / Avaturn 照片模型）
const ARKIT_EXPRESSIONS = {
  blink:      [['eyeBlinkLeft', 1], ['eyeBlinkRight', 1]],
  blinkLeft:  [['eyeBlinkLeft', 1]],
  blinkRight: [['eyeBlinkRight', 1]],
  happy:      [['mouthSmileLeft', 0.85], ['mouthSmileRight', 0.85], ['cheekSquintLeft', 0.4], ['cheekSquintRight', 0.4], ['eyeSquintLeft', 0.3], ['eyeSquintRight', 0.3]],
  relaxed:    [['eyeBlinkLeft', 0.35], ['eyeBlinkRight', 0.35], ['mouthSmileLeft', 0.4], ['mouthSmileRight', 0.4]],
  angry:      [['browDownLeft', 1], ['browDownRight', 1], ['noseSneerLeft', 0.4], ['noseSneerRight', 0.4], ['mouthFrownLeft', 0.35], ['mouthFrownRight', 0.35]],
  sad:        [['browInnerUp', 0.9], ['mouthFrownLeft', 0.7], ['mouthFrownRight', 0.7], ['eyeSquintLeft', 0.2], ['eyeSquintRight', 0.2]],
  surprised:  [['browInnerUp', 0.8], ['browOuterUpLeft', 0.7], ['browOuterUpRight', 0.7], ['eyeWideLeft', 0.9], ['eyeWideRight', 0.9], ['jawOpen', 0.3]],
  aa:         [['jawOpen', 0.6]],
  ih:         [['jawOpen', 0.25], ['mouthStretchLeft', 0.4], ['mouthStretchRight', 0.4]],
  ou:         [['mouthPucker', 0.9], ['jawOpen', 0.2]],
  ee:         [['mouthStretchLeft', 0.6], ['mouthStretchRight', 0.6], ['mouthSmileLeft', 0.2], ['mouthSmileRight', 0.2]],
  oh:         [['mouthFunnel', 0.8], ['jawOpen', 0.35]],
};

// 自然站立姿势（世界轴约定，T-Pose 为零位；左臂下垂 = -Z，右臂下垂 = +Z，+X = 低头）
export const DEFAULT_POSE = {
  leftUpperArm:  { x: 0,     y: 0,     z: -1.15 },
  rightUpperArm: { x: 0,     y: 0,     z: 1.15 },
  leftLowerArm:  { x: 0,     y: -0.25, z: -0.06 },
  rightLowerArm: { x: 0,     y: 0.25,  z: 0.06 },
  leftHand:      { x: 0,     y: 0,     z: -0.1 },
  rightHand:     { x: 0,     y: 0,     z: 0.1 },
  leftShoulder:  { x: 0,     y: 0,     z: -0.06 },
  rightShoulder: { x: 0,     y: 0,     z: 0.06 },
};

const mirror = ({ x, y, z }) => ({ x, y: -y, z: -z });

const symmetricArms = (upper, lower, hand) => ({
  leftUpperArm: upper,        leftLowerArm: lower,        leftHand: hand,
  rightUpperArm: mirror(upper), rightLowerArm: mirror(lower), rightHand: mirror(hand),
});

// 手指自然弯曲（拇指不动）。amount 越大握得越紧
const curl = (side, amount = 1) => {
  const s = side === 'left' ? -1 : 1;
  const out = {};
  for (const f of ['Index', 'Middle', 'Ring', 'Little']) {
    out[`${side}${f}Proximal`]     = { x: 0, y: 0, z: s * 0.25 * amount };
    out[`${side}${f}Intermediate`] = { x: 0, y: 0, z: s * 0.35 * amount };
    out[`${side}${f}Distal`]       = { x: 0, y: 0, z: s * 0.20 * amount };
  }
  return out;
};

const NATURAL = {
  ...DEFAULT_POSE,
  ...symmetricArms(
    { x: -0.08, y: 0,    z: -1.3 },   // 上臂：略外展、略前摆
    { x: 0,     y: -0.2, z: 0 },      // 前臂：肘部微弯
    { x: 0,     y: 0,    z: 0 },
  ),
  ...curl('left', 1), ...curl('right', 1),
};

export const POSE_PRESETS = {
  natural: NATURAL,

  greet: {
    ...NATURAL,
    rightUpperArm: { x: 0.3, y: 0.4, z: 0.1 },    // 肘部在肩高附近，略向前
    rightLowerArm: { x: 0,   y: 0,   z: -1.75 },  // 前臂竖起
    rightHand:     { x: -1.1, y: 0,  z: 0 },      // 手心朝向镜头
    ...curl('right', 0.15),                       // 五指张开
    head: { x: 0, y: 0, z: 0.08 },
  },

  demure: {
    ...NATURAL,
    ...symmetricArms(
      { x: 0.4, y: -0.2, z: -1.15 },  // 上臂外展并略向后，肘部顶出去
      { x: 0,   y: -1.5, z: -0.2 },   // 前臂向前向内收，手落在腹部前方
      { x: -0.2, y: 0,   z: 0 },      // 手心贴向腹部
    ),
    head: { x: -0.06, y: 0, z: 0.05 },            // 微微抬头、歪头，显得很乖巧
  },

  tpose: {},
};

const zero = () => ({ x: 0, y: 0, z: 0 });
const _q1 = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();

// ---------- Adapter Pattern: Model Adapters ----------

class ModelAdapter {
  constructor(gltf) {
    this.gltf = gltf;
  }
  get root() { throw new Error('Not implemented'); }
  get bones() { throw new Error('Not implemented'); }
  update(delta) {}
  getBone(name) { throw new Error('Not implemented'); }
  applyBoneRotation(name, rotation, signX, signZ) { throw new Error('Not implemented'); }
  applyExpressions(delta, exprCurrent, baseTarget, overrideMaps, exprNameMap) { throw new Error('Not implemented'); }
  dispose() {
    try { VRMUtils.deepDispose(this.root); } catch (e) {}
  }
}

class VRMAdapter extends ModelAdapter {
  constructor(gltf, vrm) {
    super(gltf);
    this.vrm = vrm;
    try { VRMUtils.removeUnnecessaryVertices(gltf.scene); } catch (e) {}
    try { VRMUtils.combineSkeletons(gltf.scene); } catch (e) {}
    VRMUtils.rotateVRM0(vrm);
    vrm.scene.traverse((obj) => {
      if (obj.isMesh) { obj.castShadow = true; obj.frustumCulled = false; }
    });
  }
  get root() { return this.vrm.scene; }
  get bones() { return this.vrm.humanoid; }
  update(delta) { this.vrm.update(delta); }
  getBone(name) { return this.vrm.humanoid?.getNormalizedBoneNode(name) || null; }
  applyBoneRotation(name, rotation, signX, signZ) {
    const node = this.getBone(name);
    if (node) {
      node.rotation.set(rotation.x * signX, rotation.y, rotation.z * signZ);
    }
  }
  applyExpressions(delta, exprCurrent, baseTarget, overrideMaps, exprNameMap) {
    const em = this.vrm.expressionManager;
    if (!em) return;
    const k = Math.min(1, delta * 7);
    for (const name in exprCurrent) {
      const actual = exprNameMap[name.toLowerCase()];
      if (!actual) continue;
      const target = baseTarget[name] || 0;
      let v = exprCurrent[name] + (target - exprCurrent[name]) * k;
      exprCurrent[name] = v;
      for (const map of overrideMaps) {
        if (map && map[name] !== undefined) v += map[name];
      }
      em.setValue(actual, THREE.MathUtils.clamp(v, 0, 1));
    }
  }
}

class GLBAdapter extends ModelAdapter {
  constructor(gltf) {
    super(gltf);
    this._root = gltf.scene;
    this._root.traverse((obj) => {
      if (obj.isMesh) { obj.castShadow = true; obj.frustumCulled = false; }
    });
    
    // 骨骼解析
    const norm = (n) => n.toLowerCase().replace(/^.*?mixamorig:?/i, '').replace(/[_\s:.]/g, '');
    const byName = {};
    this._root.traverse((obj) => {
      if (obj.isBone || obj.type === 'Bone') byName[norm(obj.name)] = obj;
    });
    
    this._bones = {};
    for (const [canonical, aliases] of Object.entries(GLB_BONE_ALIASES)) {
      for (const a of aliases) {
        if (byName[a]) { this._bones[canonical] = byName[a]; break; }
      }
    }
    
    if (!this._bones.hips || !this._bones.head) {
      throw new Error('未找到人形骨骼');
    }

    // 朝向探测
    if (this._bones.leftUpperArm && this._bones.rightUpperArm) {
      const lv = new THREE.Vector3(), rv = new THREE.Vector3();
      this._bones.leftUpperArm.getWorldPosition(lv);
      this._bones.rightUpperArm.getWorldPosition(rv);
      if (lv.x < rv.x) this._root.rotation.y += Math.PI;
    }

    this.rest = {};
    for (const [name, node] of Object.entries(this._bones)) {
      this.rest[name] = node.quaternion.clone();
    }

    this.armDroop = 0;
    if (this._bones.leftUpperArm && this._bones.leftLowerArm) {
      const a = new THREE.Vector3(), b = new THREE.Vector3();
      this._bones.leftUpperArm.getWorldPosition(a);
      this._bones.leftLowerArm.getWorldPosition(b);
      this.armDroop = Math.atan2(-b.sub(a).y, Math.abs(b.x) + 1e-6);
    }

    this.morphMeshes = [];
    this._root.traverse((obj) => {
      if (obj.isMesh && obj.morphTargetDictionary) this.morphMeshes.push(obj);
    });

    this.eyes = { left: this._bones.leftEye || null, right: this._bones.rightEye || null };
    this.eyeRest = {
      left: this.eyes.left ? this.eyes.left.quaternion.clone() : null,
      right: this.eyes.right ? this.eyes.right.quaternion.clone() : null,
    };
  }

  get root() { return this._root; }
  get bones() { return this._bones; }
  getBone(name) { return this._bones[name] || null; }

  applyBoneRotation(name, rotation, signX, signZ, composeFunc, eyeGaze) {
    // GLB 特有的世界轴旋转逻辑
    for (const bName of BONE_ORDER) {
      const node = this._bones[bName];
      if (!node) continue;
      const r = composeFunc(bName);
      if (bName === 'leftUpperArm') r.z += this.armDroop;
      else if (bName === 'rightUpperArm') r.z -= this.armDroop;
      
      node.parent.updateWorldMatrix(true, false);
      node.parent.getWorldQuaternion(_q1);
      _e.set(r.x, r.y, r.z, 'XYZ');
      _q2.setFromEuler(_e);
      node.quaternion.copy(_q1).invert().multiply(_q2).multiply(_q1).multiply(this.rest[bName]);
    }

    // 眼球
    const yaw = THREE.MathUtils.clamp(eyeGaze.yaw, -0.35, 0.35);
    const pitch = THREE.MathUtils.clamp(eyeGaze.pitch, -0.25, 0.25);
    for (const side of ['left', 'right']) {
      const eye = this.eyes[side];
      if (!eye) continue;
      eye.parent.updateWorldMatrix(true, false);
      eye.parent.getWorldQuaternion(_q1);
      _e.set(pitch, yaw, 0, 'XYZ');
      _q2.setFromEuler(_e);
      eye.quaternion.copy(_q1).invert().multiply(_q2).multiply(_q1).multiply(this.eyeRest[side]);
    }
  }

  applyExpressions(delta, exprCurrent, baseTarget, overrideMaps, exprNameMap) {
    const k = Math.min(1, delta * 7);
    const morphWeights = {};
    for (const name in exprCurrent) {
      const combos = ARKIT_EXPRESSIONS[name];
      if (!combos) continue;
      const target = baseTarget[name] || 0;
      let v = exprCurrent[name] + (target - exprCurrent[name]) * k;
      exprCurrent[name] = v;
      for (const map of overrideMaps) {
        if (map && map[name] !== undefined) v += map[name];
      }
      for (const [mn, scale] of combos) {
        morphWeights[mn] = (morphWeights[mn] || 0) + v * scale;
      }
    }
    for (const mesh of this.morphMeshes) {
      for (const [mn, w] of Object.entries(morphWeights)) {
        const idx = mesh.morphTargetDictionary[mn];
        if (idx !== undefined) mesh.morphTargetInfluences[idx] = THREE.MathUtils.clamp(w, 0, 1);
      }
    }
  }
}

// ---------- Factory Pattern: Model Factory ----------

const MODEL_FACTORY = {
  create(gltf) {
    const vrm = gltf.userData.vrm;
    if (vrm) return new VRMAdapter(gltf, vrm);
    return new GLBAdapter(gltf);
  }
};

export class Avatar {
  constructor(scene) {
    this.scene = scene;
    this.adapter = null; // Adapter Pattern
    this.basePose = {};
    this.poseTween = null;
    this.exprCurrent = {};
    this.expressionNames = [];
    this.onPoseChanged = null;
    this.eyeGaze = { yaw: 0, pitch: 0 };
    this.currentState = null; // State Pattern

    this.loader = new GLTFLoader();
    this.loader.register((parser) => new VRMLoaderPlugin(parser));

    this._initEventListeners();
  }

  _initEventListeners() {
    bus.on(EVENTS.MOOD_CHANGED, ({ emotion, intensity = 1 }) => {
      if (emotion) {
        this.setMood(emotion, intensity);
      }
    });
  }

  get mode() { 
    if (this.adapter instanceof VRMAdapter) return 'vrm';
    if (this.adapter instanceof GLBAdapter) return 'glb';
    return null;
  }

  get modelRoot() { return this.adapter?.root || null; }

  async load(url, onProgress) {
    const gltf = await new Promise((resolve, reject) => {
      this.loader.load(url, resolve, (ev) => {
        if (ev.total && onProgress) onProgress(ev.loaded / ev.total);
      }, reject);
    });

    if (this.adapter) {
      this.scene.remove(this.adapter.root);
      this.adapter.dispose();
    }

    this.adapter = MODEL_FACTORY.create(gltf);
    this.scene.add(this.adapter.root);

    // 探测坐标系
    this.signX = 1;
    this.signZ = 1;
    if (this.adapter instanceof VRMAdapter) {
      this.adapter.root.updateMatrixWorld(true);
      const hipsNode = this.getBone('hips');
      if (hipsNode) {
        hipsNode.getWorldQuaternion(_q1);
        this.signX = _v.set(1, 0, 0).applyQuaternion(_q1).x >= 0 ? 1 : -1;
        this.signZ = _v.set(0, 0, 1).applyQuaternion(_q1).z >= 0 ? 1 : -1;
      }
    }

    // 收集表情
    this.expressionNames = [];
    this.exprNameMap = {};
    if (this.adapter instanceof VRMAdapter) {
      const em = this.adapter.vrm.expressionManager;
      if (em) {
        for (const expr of em.expressions) {
          this.expressionNames.push(expr.expressionName);
          this.exprNameMap[expr.expressionName.toLowerCase()] = expr.expressionName;
        }
      }
    } else {
      const hasMorph = (n) => this.adapter.morphMeshes.some((m) => m.morphTargetDictionary[n] !== undefined);
      for (const [canonical, combos] of Object.entries(ARKIT_EXPRESSIONS)) {
        if (combos.some(([mn]) => hasMorph(mn))) {
          this.expressionNames.push(canonical);
          this.exprNameMap[canonical.toLowerCase()] = canonical;
        }
      }
    }

    this.exprCurrent = {};
    for (const name of this.expressionNames) this.exprCurrent[name] = 0;
    this.exprBaseTarget = {};
    this.resetPose(true);
    return this.adapter;
  }

  // ----- 姿势 -----
  resetPose(instant = false) {
    const target = {};
    for (const def of BONE_DEFS) target[def.name] = zero();
    for (const [k, v] of Object.entries(DEFAULT_POSE)) target[k] = { ...zero(), ...v };
    if (instant) {
      this.basePose = target;
      this.poseTween = null;
      this.onPoseChanged && this.onPoseChanged();
    } else {
      this.tweenTo(target);
    }
  }

  applyPreset(name) {
    const preset = POSE_PRESETS[name];
    if (!preset) return;
    const target = {};
    for (const def of BONE_DEFS) target[def.name] = { ...zero(), ...(preset[def.name] || {}) };
    this.tweenTo(target);
  }

  tweenTo(target, duration = 0.65) {
    const from = {};
    for (const def of BONE_DEFS) {
      const cur = this.basePose[def.name] || zero();
      from[def.name] = { ...cur };
    }
    this.poseTween = { from, to: target, t: 0, duration };
  }

  updatePoseTween(delta) {
    if (!this.poseTween) return;
    const tw = this.poseTween;
    tw.t = Math.min(tw.t + delta / tw.duration, 1);
    const e = 1 - Math.pow(1 - tw.t, 3); // easeOutCubic
    for (const def of BONE_DEFS) {
      const a = tw.from[def.name], b = tw.to[def.name];
      this.basePose[def.name] = {
        x: a.x + (b.x - a.x) * e,
        y: a.y + (b.y - a.y) * e,
        z: a.z + (b.z - a.z) * e,
      };
    }
    this.onPoseChanged && this.onPoseChanged();
    if (tw.t >= 1) this.poseTween = null;
  }

  setJoint(name, axis, value) {
    if (!this.basePose[name]) this.basePose[name] = zero();
    this.basePose[name][axis] = value;
    this.poseTween = null;
  }

  getBone(name) {
    return this.adapter?.getBone(name) || null;
  }

  setEyeGaze(yaw, pitch) {
    this.eyeGaze.yaw = yaw;
    this.eyeGaze.pitch = pitch;
  }

  // 每帧合成：基础姿势 + 各动画系统偏移量
  applyFrame(...offsetMaps) {
    if (!this.adapter) return;
    const compose = (name) => {
      const base = this.basePose[name] || zero();
      let x = base.x, y = base.y, z = base.z;
      for (const map of offsetMaps) {
        const off = map && map[name];
        if (off) { x += off.x || 0; y += off.y || 0; z += off.z || 0; }
      }
      return { x, y, z };
    };

    if (this.adapter instanceof VRMAdapter) {
      for (const def of BONE_DEFS) {
        const rotation = compose(def.name);
        this.adapter.applyBoneRotation(def.name, rotation, this.signX, this.signZ);
      }
    } else if (this.adapter instanceof GLBAdapter) {
      this.adapter.applyBoneRotation(null, null, null, null, compose, this.eyeGaze);
    }
  }

  // ----- 表情与状态 (State Pattern) -----
  setMood(nameOrValues, intensity = 1) {
    if (typeof nameOrValues === 'string') {
      this.currentState = STATE_FACTORY.create(nameOrValues);
      
      // 处理强度：缩放表情数据
      if (intensity !== 1) {
        const scaledMood = {};
        const scale = intensity === 2 ? 0.85 : (intensity >= 3 ? 1.0 : 0.6);
        for (const [k, v] of Object.entries(this.currentState.expressionData)) {
          scaledMood[k] = v * scale;
        }
        this.currentState.expressionData = scaledMood;
      }
      
      this.currentState.enter(this);
    } else {
      this.exprBaseTarget = { ...nameOrValues };
    }
  }

  setExpressionBase(name, value) {
    if (!this.exprBaseTarget) this.exprBaseTarget = {};
    this.exprBaseTarget[name] = value;
  }

  applyExpressions(delta, ...overrideMaps) {
    if (!this.adapter) return;
    
    const baseTarget = this.exprBaseTarget || (this.currentState ? this.currentState.expressionData : {});
    this.adapter.applyExpressions(delta, this.exprCurrent, baseTarget, overrideMaps, this.exprNameMap);
  }

  getWorldPosOf(boneName, yOffset = 0) {
    const node = this.getBone(boneName);
    if (!node) return null;
    const v = new THREE.Vector3();
    node.getWorldPosition(v);
    v.y += yOffset;
    return v;
  }

  update(delta, clockTime) {
    this.adapter?.update(delta);
    if (this.currentState) {
      this.currentState.update(this, delta, clockTime);
    }
  }
}
