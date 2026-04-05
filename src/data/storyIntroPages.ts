/**
 * ことばの図書館「はじまりの物語」
 * データ定義のみ（JSXなし）。
 * 読了状態は localStorage（STORY_INTRO_READ_KEY）で管理する。
 */

/** ストーリー改稿時はキーを変えて NEW を再表示できる */
export const STORY_INTRO_READ_KEY = 'potenote_library_story_intro_v2';

export interface StoryIntroPage {
  label?: string;
  title: string;
  titleImageKey?: string;
  body: StoryLine[];
}

export type StoryLine =
  | { type: 'narration'; text: string }
  | { type: 'dialogue'; speaker: string; speakerImageKey?: string; lines: string[] }
  | { type: 'emphasis'; prefix?: string; word: string; suffix?: string }
  | { type: 'climax'; text: string }
  | { type: 'spacer' };

export const storyIntroPages: StoryIntroPage[] = [
  {
    label: 'Prologue',
    title: 'ことばが失われた世界',
    titleImageKey: 'library2',
    body: [
      {
        type: 'narration',
        text: 'かつてこの世界には、\n無数のことばが積み重なっていました。',
      },
      { type: 'spacer' },
      {
        type: 'narration',
        text: '国も時代、世界をこえて、\nあらゆることばが、この本棚に眠っていました。',
      },
      {
        type: 'emphasis',
        prefix: 'しかしある日、',
        word: '"崩れたことば"',
        suffix: 'が現れます。',
      },
      { type: 'spacer' },
      {
        type: 'narration',
        text: 'それは触れたことばを侵し、\n意味を失わせ、形を崩していきました。',
      },
      {
        type: 'narration',
        text: 'やがて世界から、\nほとんどのことばが消えてしまいます。',
      },
      { type: 'spacer' },
      {
        type: 'dialogue',
        speaker: 'すうひもちの王',
        speakerImageKey: 'suuhiou',
        lines: [
          '「マスターを見つけよ。\nそして、ことばを集めるのだ」',
          '「集めたことばの数だけ、\nマスターと共に高みへと至る」',
          '「すべてのことばを取り戻したとき、\n次の王となる者を選ぼう」',
        ],
      },
      { type: 'spacer' },
      {
        type: 'narration',
        text: 'その言葉に応え、すうひもちは動き出します。',
      },
      {
        type: 'climax',
        text: 'マスターである、あなたとともに。',
      },
      { type: 'spacer' },
      {
        type: 'narration',
        text: '失われた世界に、\n再びことの葉を満たすために。',
      },
    ],
  },
];