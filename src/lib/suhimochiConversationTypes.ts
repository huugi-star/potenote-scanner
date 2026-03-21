import type { PotatoEmotion } from '@/components/ui/PotatoAvatar';

export type SuhimochiIntent =
  | 'greeting'
  | 'gratitude'
  | 'teaching_word'
  | 'ask_dictionary'
  | 'edit_word'
  | 'question'
  | 'smalltalk'
  | 'unknown';

export type SuhimochiTopic =
  | 'friendship'
  | 'physics'
  | 'promise'
  | 'study'
  | 'daily_life'
  | 'dictionary'
  | 'language'
  | 'unknown';

export interface SuhimochiReplyResult {
  reply: string;
  emotion: PotatoEmotion;
  topic: SuhimochiTopic;
  intent: SuhimochiIntent;
  reason: string;
}

export interface ConversationChatMessage {
  id: string;
  role: 'user' | 'suhimochi';
  text: string;
  analysis?: Omit<SuhimochiReplyResult, 'reply'>;
}

