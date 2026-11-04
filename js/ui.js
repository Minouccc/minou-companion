// ui.js — 面板接线、气泡、光标、加载遮罩
import * as THREE from 'three';
import { MOODS, REACTIONS, MOOD_THEMES } from './animations.js';
import { LLMDriver } from './llm.js';

import { bus, EVENTS } from './events.js';

export class UI {
  constructor() {
    this.bubble = document.getElementById('speechBubble');
    this.bubbleText = document.getElementById('speechText');
    this.bubbleTimer = null;
    this.bubbleAnchor = new THREE.Vector3();

    this.userBubble = document.getElementById('userBubble');
    this.userText = document.getElementById('userText');
    this.userBubbleTimer = null;

    this.loader = document.getElementById('loader');
    this.loaderFill = document.getElementById('loaderFill');
    this.loaderText = document.getElementById('loaderText');

    this.statusText = document.getElementById('statusText');

    this.llm = new LLMDriver();
    this.history = [];

    this._initTabs();
    this._initCursor();
    this._initPanelToggle();
    this._initChatPanel();
    this._initMusic();
    this._initEventListeners();
  }

  _initMusic() {
    this.musicToggle = document.getElementById('musicToggle');
    this.audio = document.getElementById('bgMusic');
    
    if (!this.musicToggle || !this.audio) return;

    const toggleMusic = () => {
      if (this.audio.paused) {
        this.audio.play().then(() => {
          this.musicToggle.classList.add('is-playing');
        }).catch(err => {
          console.warn('[UI] Autoplay blocked or error:', err);
        });
      } else {
        this.audio.pause();
        this.musicToggle.classList.remove('is-playing');
      }
    };

    this.musicToggle.addEventListener('click', (e) => {
      toggleMusic();
      e.stopPropagation();
    });

    // 尝试在页面首次点击时启动（应对浏览器自动播放限制）
    const startOnFirstInteraction = () => {
      if (this.audio.paused) {
        this.audio.play().then(() => {
          this.musicToggle.classList.add('is-playing');
          window.removeEventListener('pointerdown', startOnFirstInteraction);
        }).catch(() => {});
      }
    };
    window.addEventListener('pointerdown', startOnFirstInteraction);
  }

  _initEventListeners() {
    bus.on(EVENTS.MOOD_CHANGED, ({ emotion, theme }) => {
      this.syncStatusUI(emotion, theme);
      if (this.statusText) {
        this.statusText.textContent = `STATUS: ${emotion.toUpperCase()}`;
      }
    });

    bus.on(EVENTS.CHAT_LOGGED, ({ role, text }) => {
      this._logChat(role, text);
    });
  }

  _initChatPanel() {
    const input = document.getElementById('chatInput');
    const send = document.getElementById('chatSend');
    
    const handleSend = async () => {
      const text = input.value.trim();
      if (!text) return;

      this.showBubble(text, 'user');
      bus.emit(EVENTS.CHAT_LOGGED, { role: 'user', text });
      input.value = '';
      input.disabled = true;
      send.disabled = true;

      // 显示思考状态
      this.showBubble('', 'avatar', true);
      this.bubbleText.classList.add('is-thinking');

      try {
        const response = await this.llm.chat(text);
        this.bubbleText.classList.remove('is-thinking');
        if (response && response.text) {
          this.showBubble(response.text, 'avatar', false);
          bus.emit(EVENTS.CHAT_LOGGED, { role: 'avatar', text: response.text });
          
          if (response.emotion) {
            bus.emit(EVENTS.MOOD_CHANGED, { 
              emotion: response.emotion, 
              intensity: response.intensity || 1,
              theme: response.theme 
            });
          }
        }
      } catch (err) {
        this.showBubble('唔…网络好像断了，或者 Key 没配对？');
        console.error('[UI] LLM Error:', err);
      } finally {
        input.disabled = false;
        send.disabled = false;
        input.focus();
      }
    };

    send.addEventListener('click', handleSend);
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleSend();
    });
  }

  _logChat(role, text) {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    this.history.push({ role, text, time });

    const list = document.getElementById('chatHistoryList');
    if (!list) return;

    const item = document.createElement('div');
    item.className = `history-item history-item--${role}`;
    item.innerHTML = `
      <span class="history-item__time">${time}</span>
      <span class="history-item__role">${role === 'user' ? '你' : 'MINOU'}</span>
      <div class="history-item__text">${text}</div>
    `;
    list.prepend(item);
  }

  _initTabs() {
    const tabs = document.querySelectorAll('.tab');
    const pages = document.querySelectorAll('.tab-page');
    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        tabs.forEach((t) => t.classList.toggle('is-active', t === tab));
        pages.forEach((p) => p.classList.toggle('is-active', p.dataset.page === tab.dataset.tab));
      });
    });
  }

  _initPanelToggle() {
    const panel = document.getElementById('panel');
    document.getElementById('panelToggle').addEventListener('click', () => {
      panel.classList.toggle('is-collapsed');
    });
  }

  _initCursor() {
    const dot = document.getElementById('cursorDot');
    const ring = document.getElementById('cursorRing');
    let rx = innerWidth / 2, ry = innerHeight / 2;
    let tx = rx, ty = ry;
    window.addEventListener('pointermove', (e) => {
      tx = e.clientX; ty = e.clientY;
      dot.style.left = `${tx}px`;
      dot.style.top = `${ty}px`;
      const overUi = e.target.closest && e.target.closest('.panel, .joint-marker, .hint-bar');
      ring.classList.toggle('is-hover', !!overUi);
    });
    window.addEventListener('pointerdown', () => ring.classList.add('is-down'));
    window.addEventListener('pointerup', () => ring.classList.remove('is-down'));
    const loop = () => {
      rx += (tx - rx) * 0.18;
      ry += (ty - ry) * 0.18;
      ring.style.left = `${rx}px`;
      ring.style.top = `${ry}px`;
      requestAnimationFrame(loop);
    };
    loop();
  }

  // ----- 气泡 -----
  /**
   * 显示气泡
   * @param {string} text 文字内容
   * @param {'avatar' | 'user'} target 目标位置：玩偶头上或用户工具栏上方
   * @param {boolean} sticky 是否持久显示（不自动消失）
   */
  showBubble(text, target = 'avatar', sticky = false) {
    const isUser = target === 'user';
    const bubbleEl = isUser ? this.userBubble : this.bubble;
    const textEl = isUser ? this.userText : this.bubbleText;

    textEl.textContent = text;
    bubbleEl.classList.add('is-visible');

    if (isUser) {
      clearTimeout(this.userBubbleTimer);
      if (!sticky) {
        const duration = Math.min(8000, 2000 + text.length * 200);
        this.userBubbleTimer = setTimeout(() => bubbleEl.classList.remove('is-visible'), duration);
      }
    } else {
      clearTimeout(this.bubbleTimer);
      if (!sticky) {
        const duration = Math.min(8000, 2000 + text.length * 200);
        this.bubbleTimer = setTimeout(() => bubbleEl.classList.remove('is-visible'), duration);
      }
    }
  }

  updateBubblePosition(avatar, camera) {
    if (!this.bubble.classList.contains('is-visible')) return;
    const head = avatar.getWorldPosOf('head', 0.22);
    if (!head) return;
    this.bubbleAnchor.copy(head).project(camera);
    this.bubble.style.left = `${(this.bubbleAnchor.x * 0.5 + 0.5) * innerWidth}px`;
    this.bubble.style.top = `${(-this.bubbleAnchor.y * 0.5 + 0.5) * innerHeight}px`;
  }

  // ----- 加载遮罩 -----
  setProgress(ratio, text) {
    this.loaderFill.style.width = `${Math.round(ratio * 100)}%`;
    this.loaderText.style.color = '';
    if (text) this.loaderText.textContent = text;
  }

  hideLoader() {
    this.loader.classList.add('is-done');
  }

  showError(msg) {
    this.loaderText.textContent = msg;
    this.loaderText.style.color = '#e87a7a';
  }

  // ----- 控件接线 -----
  wire({ avatar, gaze, idle, sceneCtl, interaction, posePanel, reactionPlayer }) {
    // 聊天面板互动按钮
    document.querySelectorAll('.chip--action').forEach((chip) => {
      chip.addEventListener('click', () => {
        const action = chip.dataset.action;
        let reaction = null;
        if (action === 'pet') reaction = REACTIONS.head;
        else if (action === 'praise') reaction = REACTIONS.praise;
        else if (action === 'sleep') reaction = REACTIONS.sleep;

        if (reaction) {
          reactionPlayer.play(reaction);
          const lines = reaction.lines;
          const line = lines[Math.floor(Math.random() * lines.length)];
          this.showBubble(line);
          
          // 记录动作历史
          const actionLabels = { pet: '摸摸头', praise: '夸夸她', sleep: '哄她睡觉' };
          bus.emit(EVENTS.CHAT_LOGGED, { role: 'user', text: `[执行动作: ${actionLabels[action] || action}]` });
          bus.emit(EVENTS.CHAT_LOGGED, { role: 'avatar', text: line });
        }
      });
    });

    // 心情
    document.querySelectorAll('#moodRow .chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        const emotion = chip.dataset.mood;
        bus.emit(EVENTS.MOOD_CHANGED, { 
          emotion, 
          intensity: 1, 
          theme: MOOD_THEMES[emotion] 
        });
      });
    });

    // 开关
    document.getElementById('optGaze').addEventListener('change', (e) => { gaze.enabled = e.target.checked; });
    document.getElementById('optBlink').addEventListener('change', (e) => { idle.blinkEnabled = e.target.checked; });
    document.getElementById('optBreath').addEventListener('change', (e) => { idle.breathEnabled = e.target.checked; });

    // 姿势模式
    document.getElementById('optPoseMode').addEventListener('change', (e) => {
      interaction.setPoseMode(e.target.checked);
      if (e.target.checked) this.showBubble('要给我摆什么姿势呢？');
    });

    // 姿势预设
    document.querySelectorAll('[data-preset]').forEach((chip) => {
      chip.addEventListener('click', () => avatar.applyPreset(chip.dataset.preset));
    });
    document.getElementById('btnResetPose').addEventListener('click', () => avatar.resetPose());

    // 主题
    document.querySelectorAll('[data-theme-btn]').forEach((chip) => {
      chip.addEventListener('click', () => {
        bus.emit(EVENTS.MOOD_CHANGED, { theme: chip.dataset.themeBtn });
      });
    });

    // 表情重置
    document.getElementById('btnResetExpr').addEventListener('click', () => {
      bus.emit(EVENTS.MOOD_CHANGED, { emotion: 'idle', theme: 'dusk' });
    });

    this._initDraggable();
  }

  // 面板拖拽初始化
  _initDraggable() {
    const panel = document.getElementById('panel');
    const handle = document.getElementById('panelDragHandle');
    let isDragging = false;
    let startX, startY, startLeft, startTop;

    handle.addEventListener('mousedown', (e) => {
      isDragging = true;
      panel.classList.add('is-dragging');
      
      const rect = panel.getBoundingClientRect();
      startX = e.clientX;
      startY = e.clientY;
      startLeft = rect.left;
      startTop = rect.top;

      // 切换为绝对定位，保持位置不变
      panel.style.right = 'auto';
      panel.style.bottom = 'auto';
      panel.style.left = startLeft + 'px';
      panel.style.top = startTop + 'px';
      panel.style.transform = 'none';
      
      e.preventDefault();
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      
      let newLeft = startLeft + dx;
      let newTop = startTop + dy;
      
      // 简单的边界限制
      newLeft = Math.max(10, Math.min(window.innerWidth - 320, newLeft));
      newTop = Math.max(10, Math.min(window.innerHeight - 400, newTop));
      
      panel.style.left = newLeft + 'px';
      panel.style.top = newTop + 'px';
    });

    window.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        panel.classList.remove('is-dragging');
      }
    });
  }

  // 根据模型实际表情列表生成滑杆
  buildExpressionSliders(avatar) {
    const container = document.getElementById('expressionSliders');
    container.innerHTML = '';
    const skip = new Set(['lookUp', 'lookDown', 'lookLeft', 'lookRight']);
    const labels = {
      happy: '开心', angry: '生气', sad: '难过', relaxed: '温柔', surprised: '惊讶',
      aa: '张嘴-啊', ih: '张嘴-咿', ou: '张嘴-呜', ee: '张嘴-诶', oh: '张嘴-哦',
      blink: '闭眼', blinkLeft: '眨左眼', blinkRight: '眨右眼', neutral: '默认',
    };
    this.exprInputs = new Map();
    for (const name of avatar.expressionNames) {
      if (skip.has(name)) continue;
      const row = document.createElement('div');
      row.className = 'slider-row';
      const label = document.createElement('label');
      label.textContent = labels[name] || name;
      const input = document.createElement('input');
      input.type = 'range';
      input.min = 0; input.max = 1; input.step = 0.01; input.value = 0;
      const output = document.createElement('output');
      output.textContent = '0';
      input.addEventListener('input', () => {
        avatar.setExpressionBase(name, parseFloat(input.value));
        output.textContent = input.value;
      });
      row.append(label, input, output);
      container.appendChild(row);
      this.exprInputs.set(name, { input, output });
    }
  }

  _syncExpressionSliders(avatar) {
    if (!this.exprInputs) return;
    for (const [name, { input, output }] of this.exprInputs) {
      const v = avatar.exprBaseTarget[name] || 0;
      input.value = v;
      output.textContent = v.toFixed(2);
    }
  }

  /**
   * 同步 UI 状态：心情与主题按钮的高亮状态
   * @param {string} moodKey 情绪标识符
   * @param {string} themeKey 主题标识符
   */
  syncStatusUI(moodKey, themeKey) {
    if (moodKey) {
      const moodChips = document.querySelectorAll('#moodRow .chip');
      moodChips.forEach(chip => {
        chip.classList.toggle('is-active', chip.dataset.mood === moodKey);
      });
    }

    if (themeKey) {
      const themeChips = document.querySelectorAll('[data-theme-btn]');
      themeChips.forEach(chip => {
        chip.classList.toggle('is-active', chip.dataset.themeBtn === themeKey);
      });
    }
  }
}
