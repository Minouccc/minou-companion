// gaze.js — 视线与头部跟随鼠标
import * as THREE from 'three';

export class GazeController {
  constructor(scene, camera) {
    this.camera = camera;
    this.enabled = true;
    this.mouse = new THREE.Vector2(0, 0);
    this.raycaster = new THREE.Raycaster();
    this.target = new THREE.Object3D();
    scene.add(this.target);
    this.yaw = 0;
    this.pitch = 0;
  }

  attach(vrm) {
    if (vrm.lookAt) vrm.lookAt.target = this.target;
  }

  onPointerMove(ndcX, ndcY) {
    this.mouse.set(ndcX, ndcY);
  }

  // 返回头/颈/胸的旋转偏移量
  update(delta) {
    // 眼球目标：沿相机-鼠标射线放一个点
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const pt = this.raycaster.ray.at(2.2, new THREE.Vector3());
    this.target.position.copy(pt);

    // 头部目标角（模型面向 +Z，鼠标右移 = 世界 +X = 头部 +Y 偏航）
    const maxYaw = 0.62, maxPitch = 0.38;
    const targetYaw = this.enabled ? this.mouse.x * maxYaw : 0;
    const targetPitch = this.enabled ? -this.mouse.y * maxPitch : 0;
    const k = Math.min(1, delta * 4.5);
    this.yaw += (targetYaw - this.yaw) * k;
    this.pitch += (targetPitch - this.pitch) * k;

    return {
      head:       { x: this.pitch * 0.55, y: this.yaw * 0.55, z: 0 },
      neck:       { x: this.pitch * 0.28, y: this.yaw * 0.28, z: 0 },
      upperChest: { x: this.pitch * 0.1,  y: this.yaw * 0.17, z: 0 },
    };
  }
}
