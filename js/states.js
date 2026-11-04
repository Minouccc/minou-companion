/**
 * states.js — 角色情绪状态 (State Pattern)
 */
import { MOODS } from './animations.js';

export class AvatarState {
  constructor(name) {
    this.name = name;
    this.expressionData = MOODS[name] || {};
  }

  // 进入该状态时的行为
  enter(avatar) {
    avatar.setMood(this.expressionData);
  }

  // 每帧更新时的特定行为 (例如：Sleepy 状态下呼吸更慢)
  update(avatar, delta, clockTime) {
    // 默认行为：通用的呼吸微动
  }

  // 视线追踪权重 (例如：Sleepy 时不怎么看人)
  getGazeWeight() {
    return 1.0;
  }
}

class SleepyState extends AvatarState {
  update(avatar, delta, clockTime) {
    // 犯困时，呼吸更深更慢
    const breath = Math.sin(clockTime * 0.5) * 0.05;
    avatar.applyFrame({ spine: { x: breath, y: 0, z: 0 } });
  }
  
  getGazeWeight() {
    return 0.2; // 没精打采，几乎不看鼠标
  }
}

class HappyState extends AvatarState {
  update(avatar, delta, clockTime) {
    // 开心时，身体有轻微的左右晃动
    const sway = Math.sin(clockTime * 2.0) * 0.02;
    avatar.applyFrame({ chest: { x: 0, y: sway, z: 0 } });
  }
}

class AngryState extends AvatarState {
  update(avatar, delta, clockTime) {
    // 生气时，身体微微颤抖
    const shake = Math.sin(clockTime * 25.0) * 0.005;
    avatar.applyFrame({ chest: { x: shake, y: 0, z: 0 } });
  }
  getGazeWeight() { return 1.2; } // 盯着你看
}

class SadState extends AvatarState {
  update(avatar, delta, clockTime) {
    // 难过时，垂头丧气
    avatar.applyFrame({ neck: { x: 0.15, y: 0, z: 0 } });
  }
  getGazeWeight() { return 0.1; } // 不敢看人
}

export const STATE_FACTORY = {
  create(name) {
    switch (name.toLowerCase()) {
      case 'sleepy':   return new SleepyState(name);
      case 'happy':    return new HappyState(name);
      case 'angry':    return new AngryState(name);
      case 'sad':      return new SadState(name);
      default:         return new AvatarState(name);
    }
  }
};
