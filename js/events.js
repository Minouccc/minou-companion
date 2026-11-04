/**
 * events.js — 全局事件总线 (Observer Pattern)
 */
class EventBus extends EventTarget {
  emit(type, detail) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }

  on(type, callback) {
    this.addEventListener(type, (e) => callback(e.detail));
  }
}

// 定义标准事件名
const EVENTS = {
  MOOD_CHANGED: 'mood_changed',      // { emotion, intensity, theme }
  CHAT_LOGGED: 'chat_logged',        // { role, text }
  MODEL_LOADED: 'model_loaded',      // { avatar }
  JOINT_EDITED: 'joint_edited',      // { boneName }
  CAMERA_RESET: 'camera_reset',
};

const bus = new EventBus();

// 导出
export { bus, EVENTS };

// 全局挂载便于调试
window.bus = bus;
window.EVENTS = EVENTS;
