// main.js — 启动入口与主循环
import * as THREE from 'three';
import { createScene } from './scene.js';
import { Avatar } from './avatar.js';
import { GazeController } from './gaze.js';
import { IdleAnimator, ReactionPlayer } from './animations.js';
import { InteractionController } from './interaction.js';
import { PosePanel } from './pose.js';
import { UI } from './ui.js';

const params = new URLSearchParams(location.search);
// 默认模型：本地优先，缺失时自动回退 CDN（仓库不含模型文件时仍可直接运行）
const MODEL_CDN = 'https://cdn.jsdelivr.net/gh/madjin/vrm-samples@master/vroid/stable/AvatarSample_B.vrm';
const DEFAULT_CANDIDATES = params.get('model') ? [params.get('model')] : ['assets/my-avatar.vrm', 'assets/AvatarSample_B.vrm', MODEL_CDN];
const GREETINGS = ['你来啦，我等你好久了～', '今天也想我了吗？', '嗨～要一直看着我哦'];

import { bus, EVENTS } from './events.js';
import { MOODS, MOOD_THEMES } from './animations.js';

const canvas = document.getElementById('stage');
const ui = new UI();
const sceneCtl = createScene(canvas);
const { renderer, scene, camera, controls } = sceneCtl;

const avatar = new Avatar(scene);
const gaze = new GazeController(scene, camera);
const idle = new IdleAnimator();
const reactionPlayer = new ReactionPlayer();
const interaction = new InteractionController({ canvas, camera, avatar, reactionPlayer, ui });
let posePanel = null;

// ----- 事件响应 (Observer Pattern) -----
bus.on(EVENTS.JOINT_EDITED, () => {
  if (posePanel) posePanel.syncFromAvatar();
});

// ----- 模型加载 -----
async function loadModel(url, { revoke = false, greeting = null } = {}) {
  document.getElementById('loader').classList.remove('is-done');
  ui.setProgress(0.02, '正在唤醒她…');
  try {
    const model = await avatar.load(url, (r) => ui.setProgress(0.02 + r * 0.9, '正在唤醒她…'));
    gaze.attach(model);
    ui.setProgress(1, '她醒来了 ♥');
    if (!posePanel) posePanel = new PosePanel(avatar);
    else posePanel.syncFromAvatar();
    ui.buildExpressionSliders(avatar);
    setTimeout(() => {
      ui.hideLoader();
      ui.showBubble(greeting || GREETINGS[Math.floor(Math.random() * GREETINGS.length)]);
    }, 350);
    return true;
  } catch (err) {
    console.error(err);
    ui.showError('模型加载失败：' + (err.message || '请用本地服务器打开页面'));
    // 已有模型在场时，稍后自动恢复画面
    if (avatar.mode) {
      setTimeout(() => {
        ui.hideLoader();
        ui.showBubble('呜…换装失败了，再试一次？');
      }, 2600);
    }
    return false;
  } finally {
    if (revoke) URL.revokeObjectURL(url);
  }
}

// ----- 鼠标感知 -----
window.addEventListener('pointermove', (e) => {
  gaze.onPointerMove(
    (e.clientX / window.innerWidth) * 2 - 1,
    -(e.clientY / window.innerHeight) * 2 + 1
  );
});

// ----- 缓慢环绕 -----
document.getElementById('optOrbit').addEventListener('change', (e) => {
  controls.autoRotate = e.target.checked;
  controls.autoRotateSpeed = 0.6;
});

// ----- UI 接线 -----
ui.wire({ avatar, gaze, idle, sceneCtl, interaction, posePanel, reactionPlayer });
interaction.onJointEdited = () => bus.emit(EVENTS.JOINT_EDITED);

// 调试/自动化测试钩子
window.__minou = { avatar, gaze, idle, interaction, camera };

// ----- 主循环 -----
const clock = new THREE.Clock();

function mergeOffsets(...maps) {
  const out = {};
  for (const map of maps) {
    if (!map) continue;
    for (const [bone, off] of Object.entries(map)) {
      if (!out[bone]) out[bone] = { x: 0, y: 0, z: 0 };
      out[bone].x += off.x || 0;
      out[bone].y += off.y || 0;
      out[bone].z += off.z || 0;
    }
  }
  return out;
}

function tick() {
  requestAnimationFrame(tick);
  const delta = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  controls.update();
  sceneCtl.updateParticles(t);

  if (avatar.mode) {
    avatar.updatePoseTween(delta);
    const idleOut = idle.update(t, delta);
    const reactOut = reactionPlayer.update(delta);
    const gazeWeight = avatar.currentState?.getGazeWeight() ?? 1.0;
    const gazeOut = gaze.update(delta);
    if (gazeWeight !== 1.0) {
      for (const k in gazeOut) {
        gazeOut[k].x *= gazeWeight;
        gazeOut[k].y *= gazeWeight;
        gazeOut[k].z *= gazeWeight;
      }
    }
    avatar.setEyeGaze(gaze.yaw * 0.55, gaze.pitch * 0.55); // GLB 模式眼骨追踪（VRM 由 lookAt 处理）

    avatar.applyFrame(mergeOffsets(idleOut.bones, reactOut.bones, gazeOut));
    avatar.applyExpressions(delta, idleOut.exprs, reactOut.exprs);
    avatar.update(delta, t);

    ui.updateBubblePosition(avatar, camera);
    interaction.updateMarkers();
  }

  renderer.render(scene, camera);
}

// 依次尝试候选地址（本地缺失时回退 CDN）
async function loadDefault() {
  for (let i = 0; i < DEFAULT_CANDIDATES.length; i++) {
    const url = DEFAULT_CANDIDATES[i];
    if (i < DEFAULT_CANDIDATES.length - 1) {
      try {
        const res = await fetch(url);
        if (!res.ok) continue;
      } catch { continue; }
    }
    if (await loadModel(url)) return;
  }
}

loadDefault();
tick();
