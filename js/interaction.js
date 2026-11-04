// interaction.js — 点击身体互动 + 姿势模式关节拖拽
import * as THREE from 'three';
import { BONE_DEFS } from './avatar.js';
import { INTERACTION_STRATEGIES } from './strategies.js';

// 用于点击区域判定的关节 → 区域映射
const REGION_JOINTS = [
  { bone: 'head', region: 'head' },
  { bone: 'neck', region: 'face' },
  { bone: 'upperChest', region: 'chest' },
  { bone: 'chest', region: 'chest' },
  { bone: 'spine', region: 'belly' },
  { bone: 'hips', region: 'belly' },
  { bone: 'leftHand', region: 'hand' },
  { bone: 'rightHand', region: 'hand' },
  { bone: 'leftLowerArm', region: 'arm' },
  { bone: 'rightLowerArm', region: 'arm' },
  { bone: 'leftUpperArm', region: 'arm' },
  { bone: 'rightUpperArm', region: 'arm' },
  { bone: 'leftUpperLeg', region: 'leg' },
  { bone: 'rightUpperLeg', region: 'leg' },
  { bone: 'leftLowerLeg', region: 'leg' },
  { bone: 'rightLowerLeg', region: 'leg' },
  { bone: 'leftFoot', region: 'foot' },
  { bone: 'rightFoot', region: 'foot' },
];

export class InteractionController {
  constructor({ canvas, camera, avatar, reactionPlayer, ui }) {
    this.canvas = canvas;
    this.camera = camera;
    this.avatar = avatar;
    this.reactionPlayer = reactionPlayer;
    this.ui = ui;
    this.raycaster = new THREE.Raycaster();
    this.poseMode = false;
    this.dragging = null; // { boneName }
    this.lastX = 0;
    this.lastY = 0;
    this.onJointEdited = null;

    this.markersRoot = document.getElementById('jointMarkers');
    this.markers = new Map(); // boneName -> element
    this._buildMarkers();
    this._bindEvents();
  }

  _buildMarkers() {
    for (const def of BONE_DEFS) {
      const el = document.createElement('div');
      el.className = 'joint-marker';
      el.style.display = 'none';
      el.dataset.bone = def.name;
      const tip = document.createElement('span');
      tip.className = 'joint-tip';
      tip.textContent = def.label;
      el.appendChild(tip);
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this._startDrag(def.name, e);
      });
      this.markersRoot.appendChild(el);
      this.markers.set(def.name, el);
    }
  }

  _bindEvents() {
    this.canvas.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || this.poseMode) return;
      this._handleTouch(e);
    });
    window.addEventListener('pointermove', (e) => {
      if (!this.dragging) return;
      const dx = e.clientX - this.lastX;
      const dy = e.clientY - this.lastY;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      const bone = this.dragging;
      const pose = this.avatar.basePose[bone] || { x: 0, y: 0, z: 0 };
      const def = BONE_DEFS.find((d) => d.name === bone);
      const lim = def?.range || 1.9;
      if (e.shiftKey) {
        pose.z = THREE.MathUtils.clamp(pose.z + dx * 0.008, -lim, lim);
      } else {
        pose.y = THREE.MathUtils.clamp(pose.y + dx * 0.008, -lim, lim);
        pose.x = THREE.MathUtils.clamp(pose.x + dy * 0.008, -lim, lim);
      }
      this.avatar.setJoint(bone, 'x', pose.x);
      this.avatar.setJoint(bone, 'y', pose.y);
      this.avatar.setJoint(bone, 'z', pose.z);
      this.onJointEdited && this.onJointEdited(bone);
    });
    window.addEventListener('pointerup', () => {
      if (this.dragging) {
        const el = this.markers.get(this.dragging);
        el && el.classList.remove('is-active');
        this.dragging = null;
      }
    });
  }

  _startDrag(boneName, e) {
    this.dragging = boneName;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    const el = this.markers.get(boneName);
    el && el.classList.add('is-active');
  }

  _handleTouch(e) {
    if (!this.avatar.modelRoot) return;
    const ndc = new THREE.Vector2(
      (e.clientX / window.innerWidth) * 2 - 1,
      -(e.clientY / window.innerHeight) * 2 + 1
    );
    this.raycaster.setFromCamera(ndc, this.camera);
    const hits = this.raycaster.intersectObject(this.avatar.modelRoot, true);
    if (!hits.length) return;
    const point = hits[0].point;

    // 找最近关节 → 区域
    let best = null;
    let bestDist = Infinity;
    const v = new THREE.Vector3();
    for (const { bone, region } of REGION_JOINTS) {
      const node = this.avatar.getBone(bone);
      if (!node) continue;
      node.getWorldPosition(v);
      const d = v.distanceToSquared(point);
      if (d < bestDist) { bestDist = d; best = region; }
    }
    if (!best) return;

    // 使用策略模式执行互动响应
    const strategy = INTERACTION_STRATEGIES[best] || INTERACTION_STRATEGIES.default;
    strategy.execute(this.ui, this.reactionPlayer);
  }

  setPoseMode(on) {
    this.poseMode = on;
    if (!on) {
      for (const el of this.markers.values()) el.style.display = 'none';
    }
  }

  // 每帧投影关节点到屏幕
  updateMarkers() {
    if (!this.poseMode || !this.avatar.modelRoot) return;
    const v = new THREE.Vector3();
    for (const def of BONE_DEFS) {
      const el = this.markers.get(def.name);
      const node = this.avatar.getBone(def.name);
      if (!node) { el.style.display = 'none'; continue; }
      node.getWorldPosition(v);
      v.project(this.camera);
      if (v.z > 1) { el.style.display = 'none'; continue; }
      el.style.display = 'block';
      el.style.left = `${(v.x * 0.5 + 0.5) * window.innerWidth}px`;
      el.style.top = `${(-v.y * 0.5 + 0.5) * window.innerHeight}px`;
    }
  }
}
