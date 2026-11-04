# MINOU · 心动玩偶

纯网页版 3D 互动伴侣 —— 集成 LLM 智能对话、3D 实时渲染、全身姿势调节与表情混缩。零构建、零后端，浏览器打开即用。

**🎮 在线试玩（无需安装，点开即玩）：[https://your-deploy-url.com](https://your-deploy-url.com)**

[![Live Demo](https://img.shields.io/badge/🎮_在线试玩-Live_Demo-e8527a?style=for-the-badge)](https://your-deploy-url.com)

![tech](https://img.shields.io/badge/Three.js-0.170-e8a0b4) ![tech](https://img.shields.io/badge/three--vrm-3.x-d8b78a) ![tech](https://img.shields.io/badge/LLM-DashScope-9fb8e8)

## ✨ 功能

| 功能 | 说明 |
|---|---|
| 🤖 LLM 智能对话 | 集成大语言模型，支持实时聊天，伴侣会根据对话内容自动切换表情与动作 |
| 👁️ 视线感知 | 眼球 + 头 / 颈 / 胸三层联动追随鼠标，带平滑阻尼效果 |
| 👆 点击互动 | 头 / 脸 / 胸 / 腹 / 手 / 臂 / 腿 / 脚等多个区域独立反应：触发表情 + 动作 + 台词气泡 |
| 🦴 姿势工坊 | 姿势模式下直接拖拽身上发光关节点（Shift 拖拽可扭转），或使用滑杆微调 20 个关节 |
| 🧘 姿势预设 | 提供自然站立 / 挥手致意 / 乖巧 / T-Pose 等预设，支持平滑缓动过渡 |
| 🎭 表情调音台 | 自动读取模型全部表情基（开心 / 生气 / 难过 / 口型等），支持自由比例混合 |
| 🌬️ 生命感 | 程序化呼吸、重心摇摆、随机眨眼、头发裙摆物理模拟（VRM SpringBone） |
| 🎨 氛围主题 | 暮夜玫瑰 / 午夜蓝调 / 晨光暖橘 / 赛博脉冲，灯光 + 背景 + 粒子效果整体切换 |
| 🎵 音乐陪伴 | 内置背景音乐播放器，营造沉浸式陪伴氛围 |

## 🚀 运行

### 1. 本地运行
由于 ES Module 和模型加载有跨域限制，需要通过本地服务器打开：

```bash
# 进入项目目录
cd minou-3d-companion-main

# 使用 Python 启动
python -m http.server 8080

# 或使用 Node.js npx serve
npx serve
```
访问 `http://localhost:8080` 即可。

### 2. 配置 AI 对话
项目默认使用 DashScope (通义千问) API。
- **方式一**：在项目根目录创建 `.env` 文件，写入 `DASHSCOPE_API_KEY=你的Key`
- **方式二**：直接在浏览器控制台输入 `localStorage.setItem('DASHSCOPE_API_KEY', '你的Key')` 并刷新

## 🕹️ 操作

- **移动鼠标** — 她的视线与头部会跟随你的光标
- **左键点击身体** — 触发对应部位的互动反应
- **右键拖动** — 旋转相机视角；**滚轮** — 缩放远近
- **姿势模式** — 在右侧面板开启，直接在 3D 场景中拖拽关节点
- **聊天输入** — 在左侧聊天框输入文字，按回车发送

## 📁 项目结构

```
minou-3d-companion-main/
├── index.html          # 页面骨架与资源引入
├── css/style.css       # 核心样式与主题定义
├── js/
│   ├── main.js         # 入口文件与主循环逻辑
│   ├── scene.js        # 3D 场景、灯光与环境初始化
│   ├── avatar.js       # 模型加载与驱动核心
│   ├── llm.js          # LLM 对话驱动引擎
│   ├── gaze.js         # 视线追踪控制
│   ├── animations.js   # 动作、反应与情绪定义
│   ├── interaction.js  # 点击判定与关节拖拽交互
│   ├── pose.js         # 姿势面板逻辑
│   └── ui.js           # UI 交互、气泡对话与状态管理
└── assets/              # 静态资源（模型、音乐等）
```

## 🔧 技术栈

- **渲染引擎**：Three.js + @pixiv/three-vrm
- **动画方案**：GSAP (用于平滑姿势切换)
- **对话能力**：OpenAI 兼容接口 (DashScope)
- **事件系统**：基于发布订阅模式的自定义事件总线

## 📝 开发复盘

### 1. AI 工具使用与效率
- **使用工具**：TRAE 国际版 (Auto 模式)
- **实际耗时**：约 3 小时
- **交付总结**：通过 TRAE 的全自动模式，快速完成了从 3D 场景搭建到 LLM 接入的骨架，大幅缩短了原型开发周期。

### 2. AI 局限性与手动调优
在开发过程中，AI 原生生成的代码在以下两个核心细节上表现欠佳，经过手动深度干预才达到交付标准：

- **代码架构与解耦**：
  AI 最初生成的逻辑高度耦合（具体细节见 [REFACTOR.md](file:///Users/minouccc/Downloads/minou-3d-companion-main/REFACTOR.md)），缺乏扩展性。例如模型驱动逻辑混合、状态维护混乱。我手动介入并强制要求 AI 引入**适配器模式**、**状态模式**和**观察者模式**，将代码结构从“过程式脚本”重构为“模块化架构”，确保了后续增加新模型或新功能的灵活性。

- **玩偶姿势精确度控制**：
  最初尝试利用 **Claude 5.5 Sonnet** 配合截图与 Few-shot 提示词编写姿势参数，但生成的骨骼旋转数据（Rotation）经常出现错乱或反关节的“畸形”动作。
  **修正方案**：改用 **TRAE 浏览器模式**。通过让 TRAE 自动操控浏览器实时预览，手动配合它在调试面板中调整参数，并通过 TRAE 的自动截图功能进行视觉验证。最终在多次“尝试-反馈-修正”的闭环中拿到了精准的姿势参数并写入 [animations.js](file:///Users/minouccc/Downloads/minou-3d-companion-main/js/animations.js)。


