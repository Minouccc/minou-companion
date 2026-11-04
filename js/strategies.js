/**
 * strategies.js — 互动响应策略 (Strategy Pattern)
 */
import { REACTIONS } from './animations.js';
import { bus, EVENTS } from './events.js';

export class InteractionStrategy {
  execute(ui, reactionPlayer) {
    throw new Error('Strategy must implement execute()');
  }
}

class ReactionStrategy extends InteractionStrategy {
  constructor(reactionData, label, emotion = null) {
    super();
    this.reaction = reactionData;
    this.label = label;
    this.emotion = emotion;
  }

  execute(ui, reactionPlayer) {
    reactionPlayer.play(this.reaction);
    const line = this.reaction.lines[Math.floor(Math.random() * this.reaction.lines.length)];
    ui.showBubble(line);
    
    bus.emit(EVENTS.CHAT_LOGGED, { role: 'avatar', text: line });
    if (this.label) {
      bus.emit(EVENTS.CHAT_LOGGED, { role: 'user', text: `[点击了: ${this.label}]` });
    }

    if (this.emotion) {
      bus.emit(EVENTS.MOOD_CHANGED, { emotion: this.emotion, intensity: 2 });
    }
  }
}

export const INTERACTION_STRATEGIES = {
  head: new ReactionStrategy(REACTIONS.head, '头部', 'shy'),
  body: new ReactionStrategy(REACTIONS.praise, '身体', 'happy'),
  arm: new ReactionStrategy(REACTIONS.hand, '手臂', 'idle'),
  default: new ReactionStrategy(REACTIONS.head, '未知区域'),
};
