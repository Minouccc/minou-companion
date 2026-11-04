// animations.js — 待机微动（呼吸/摇摆/眨眼）与点击反应播放器

// ----- 待机动画 -----
export class IdleAnimator {
  constructor() {
    this.breathEnabled = true;
    this.blinkEnabled = true;
    this.nextBlink = 2 + Math.random() * 3;
    this.blinkT = -1; // <0 表示未在眨眼
    this.doubleBlink = false;
  }

  update(t, delta) {
    const bones = {};
    const exprs = {};

    if (this.breathEnabled) {
      const breath = Math.sin(t * 1.55);
      const sway = Math.sin(t * 0.42);
      const sway2 = Math.sin(t * 0.27 + 1.3);
      bones.chest      = { x: breath * 0.02, y: 0, z: 0 };
      bones.upperChest = { x: breath * 0.012, y: sway2 * 0.012, z: 0 };
      bones.spine      = { x: breath * 0.006, y: sway * 0.022, z: sway2 * 0.008 };
      bones.hips       = { x: 0, y: sway * 0.018, z: sway2 * 0.01 };
      bones.head       = { x: Math.sin(t * 0.85) * 0.012, y: Math.sin(t * 0.6) * 0.018, z: Math.sin(t * 0.5) * 0.008 };
      bones.leftShoulder  = { x: 0, y: 0, z: -breath * 0.014 };
      bones.rightShoulder = { x: 0, y: 0, z: breath * 0.014 };
      bones.leftUpperArm  = { x: 0, y: 0, z: Math.sin(t * 0.42 + 0.5) * 0.018 };
      bones.rightUpperArm = { x: 0, y: 0, z: -Math.sin(t * 0.42 + 0.9) * 0.018 };
    }

    if (this.blinkEnabled) {
      if (this.blinkT < 0 && t > this.nextBlink) {
        this.blinkT = 0;
        this.doubleBlink = Math.random() < 0.18;
      }
      if (this.blinkT >= 0) {
        this.blinkT += delta;
        const dur = 0.16;
        if (this.blinkT < dur) {
          exprs.blink = Math.sin(Math.PI * (this.blinkT / dur));
        } else if (this.doubleBlink && this.blinkT < dur * 2.4) {
          const t2 = this.blinkT - dur * 1.4;
          exprs.blink = t2 > 0 ? Math.sin(Math.PI * (t2 / dur)) : 0;
        } else {
          this.blinkT = -1;
          this.nextBlink = t + 1.8 + Math.random() * 4.2;
        }
      }
    }

    return { bones, exprs };
  }
}

// ----- 反应播放器 -----
// reaction: { duration, exprs: {name: weight}, bones: {bone: {axis,x,y,z, wave?:freq}} }
export class ReactionPlayer {
  constructor() {
    this.current = null;
    this.t = 0;
  }

  play(reaction) {
    this.current = reaction;
    this.t = 0;
  }

  update(delta) {
    if (!this.current) return { bones: {}, exprs: {} };
    this.t += delta;
    const r = this.current;
    const p = this.t / r.duration;
    if (p >= 1) {
      this.current = null;
      return { bones: {}, exprs: {} };
    }
    const env = Math.sin(Math.PI * Math.min(p, 1)); // 平滑进出包络

    const exprs = {};
    if (r.exprs) for (const [k, v] of Object.entries(r.exprs)) exprs[k] = v * env;

    const bones = {};
    if (r.bones) {
      for (const [bone, def] of Object.entries(r.bones)) {
        const wave = def.wave ? Math.sin(this.t * def.wave) : 1;
        bones[bone] = {
          x: (def.x || 0) * env * (def.waveAxis === 'x' ? wave : 1),
          y: (def.y || 0) * env * (def.waveAxis === 'y' ? wave : 1),
          z: (def.z || 0) * env * (def.waveAxis === 'z' ? wave : 1),
        };
      }
    }
    return { bones, exprs };
  }
}

// ----- 点击反应定义 -----
export const REACTIONS = {
  head: {
    duration: 2.2,
    exprs: { relaxed: 0.85, happy: 0.5 },
    bones: { head: { z: 0.16, x: 0.1 }, neck: { z: 0.06 } },
    lines: ['嘿嘿～最喜欢摸头了', '好舒服呀…再摸一下嘛', '你的手好温柔', '唔…头发要乱啦'],
  },
  face: {
    duration: 1.8,
    exprs: { happy: 0.7, blink: 0.4 },
    bones: { head: { z: -0.12, y: 0.08 } },
    lines: ['脸、脸不可以随便戳啦！', '哎呀，好痒～', '我脸红了没有？'],
  },
  chest: {
    duration: 1.6,
    exprs: { surprised: 0.9, angry: 0.35 },
    bones: { upperChest: { x: -0.14 }, spine: { x: -0.08 }, head: { x: 0.1 } },
    lines: ['呀！不可以碰那里啦！', '讨、讨厌～！', '再这样我要生气了哦！'],
  },
  belly: {
    duration: 1.8,
    exprs: { happy: 0.9 },
    bones: { spine: { x: 0.1, z: 0.06 }, head: { x: 0.12, z: 0.08 } },
    lines: ['哈哈哈好痒！', '别挠啦～肚子要笑疼了', '噗…你真调皮'],
  },
  hand: {
    duration: 2.4,
    exprs: { happy: 0.8 },
    bones: {
      rightUpperArm: { z: -1.9, y: -0.2 },
      rightLowerArm: { z: -0.45, waveAxis: 'z', wave: 9 },
      head: { z: -0.08 },
    },
    lines: ['要牵手吗？', '嗨～你好呀！', '我们击个掌吧✋', '你的手比我大耶'],
  },
  arm: {
    duration: 1.8,
    exprs: { relaxed: 0.7, happy: 0.3 },
    bones: { spine: { y: 0.06 }, head: { z: 0.1 } },
    lines: ['想挽着我的手臂吗？', '嗯？怎么啦', '靠近一点也没关系哦'],
  },
  leg: {
    duration: 1.5,
    exprs: { surprised: 0.7 },
    bones: { hips: { y: 0.08 }, head: { x: 0.18 } },
    lines: ['别闹啦～', '腿是用来走路的！', '呀，吓我一跳'],
  },
  foot: {
    duration: 1.5,
    exprs: { surprised: 0.5, happy: 0.4 },
    bones: { head: { x: 0.22 } },
    lines: ['脚趾会害羞的啦', '鞋子好看吗？', '痒痒痒！'],
  },
  praise: {
    duration: 2.5,
    exprs: { happy: 0.95, relaxed: 0.4 },
    bones: { head: { z: -0.1, y: 0.1 }, upperChest: { x: 0.05 } },
    lines: ['真的吗？太开心了！', '你这么夸我，我会害羞的…', '嘿嘿，我也觉得你很棒！'],
  },
  sleep: {
    duration: 3.5,
    exprs: { blink: 0.9, relaxed: 0.8 },
    bones: { head: { x: 0.15 }, neck: { x: 0.1 }, spine: { x: 0.05 } },
    lines: ['好困哦…晚安…', '那我就先眯一会啦', '梦里也要见到你哦'],
  },
};

// 心情预设 → 表情基础值
export const MOODS = {
  idle:      {}, // 平静待机
  happy:     { happy: 0.85 },
  relaxed:   { relaxed: 0.9, happy: 0.25 },
  surprised: { surprised: 0.85 },
  sad:       { sad: 0.85 },
  angry:     { angry: 0.8 },
  shy:       { relaxed: 0.4, happy: 0.3, surprised: 0.2 }, // 害羞
  sleepy:    { blink: 0.85, relaxed: 0.6 }, // 犯困
  ocean:     { relaxed: 0.8, surprised: 0.2 }, // 冷静/深海
  shocked:   { surprised: 1.0 } // 震惊/空白
};

// 情绪与场景主题的映射关系
export const MOOD_THEMES = {
  idle:      'dusk',      // 平静 -> 玫瑰
  happy:     'dawn',      // 开心 -> 晨光
  sad:       'midnight',  // 委屈 -> 深夜
  shy:       'dusk',      // 害羞 -> 玫瑰
  sleepy:    'midnight',  // 睡觉 -> 深夜
  relaxed:   'dawn',      // 放松 -> 晨光
  surprised: 'cyber',     // 惊讶 -> 赛博
  angry:     'cyber',     // 生气 -> 赛博
  ocean:     'midnight',  // 冷静 -> 深海
  shocked:   'midnight'   // 震惊 -> 深夜
};
