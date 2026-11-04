// pose.js — 关节滑杆面板
import { BONE_DEFS } from './avatar.js';

const AXIS_LABELS = { x: '俯仰', y: '偏转', z: '侧倾' };

export class PosePanel {
  constructor(avatar) {
    this.avatar = avatar;
    this.container = document.getElementById('jointSliders');
    this.inputs = new Map(); // `${bone}.${axis}` -> {input, output}
    this._build();
    avatar.onPoseChanged = () => this.syncFromAvatar();
  }

  _build() {
    const groups = new Map();
    for (const def of BONE_DEFS) {
      if (!groups.has(def.group)) groups.set(def.group, []);
      groups.get(def.group).push(def);
    }
    for (const [groupName, defs] of groups) {
      const details = document.createElement('details');
      details.className = 'slider-group';
      const summary = document.createElement('summary');
      summary.textContent = groupName;
      details.appendChild(summary);
      const body = document.createElement('div');
      body.className = 'group-body';

      for (const def of defs) {
        const lim = def.range || 1.9;
        for (const axis of ['x', 'y', 'z']) {
          const row = document.createElement('div');
          row.className = 'slider-row';
          const label = document.createElement('label');
          label.textContent = `${def.label}·${AXIS_LABELS[axis]}`;
          const input = document.createElement('input');
          input.type = 'range';
          input.min = -lim;
          input.max = lim;
          input.step = 0.01;
          input.value = 0;
          const output = document.createElement('output');
          output.textContent = '0°';
          input.addEventListener('input', () => {
            const v = parseFloat(input.value);
            this.avatar.setJoint(def.name, axis, v);
            output.textContent = `${Math.round(v * 57.3)}°`;
          });
          row.append(label, input, output);
          body.appendChild(row);
          this.inputs.set(`${def.name}.${axis}`, { input, output });
        }
      }
      details.appendChild(body);
      this.container.appendChild(details);
    }
  }

  syncFromAvatar() {
    for (const def of BONE_DEFS) {
      const pose = this.avatar.basePose[def.name];
      if (!pose) continue;
      for (const axis of ['x', 'y', 'z']) {
        const entry = this.inputs.get(`${def.name}.${axis}`);
        if (!entry) continue;
        entry.input.value = pose[axis];
        entry.output.textContent = `${Math.round(pose[axis] * 57.3)}°`;
      }
    }
  }
}
