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
    title: 'すうひもち図書館',
    titleImageKey: 'library2',
    body: [
     
      { type: 'spacer' },
      {
        type: 'dialogue',
        speaker: 'すうひもち',
        speakerImageKey: 'suuhiou',
        lines: ['「……きこえる？」', '「やっと……つながった」'],
      },
      { type: 'spacer' },
      {
        type: 'narration',
        text: '■ 状況',
      },
      {
        type: 'dialogue',
        speaker: 'すうひもち',
        speakerImageKey: 'suuhiou',
        lines: ['「ここは、“すうひもち図書館”」', '「ことばが集められていた場所」'],
      },
      { type: 'spacer' },
      {
        type: 'narration',
        text: '■ ことばが消えた世界',
      },
      {
        type: 'dialogue',
        speaker: 'すうひもち',
        speakerImageKey: 'suuhiou',
        lines: ['「でも今——」', '「ことばが、消えてしまってる」'],
      },
      { type: 'spacer' },
      {
        type: 'narration',
        text: '■ 使命',
      },
      {
        type: 'dialogue',
        speaker: 'すうひもち',
        speakerImageKey: 'suuhiou',
        lines: ['「……わたしは、命令を受けてきたの」', '「“ことばを集められる人”を探してって」'],
      },
      { type: 'spacer' },
      {
        type: 'narration',
        text: '■ 選定',
      },
      {
        type: 'dialogue',
        speaker: 'すうひもち',
        speakerImageKey: 'suuhiou',
        lines: [
          '「ずっと探してた」',
          '「でも——」',
          '「反応があったのは、あなただけ」',
          '「ひとりじゃ、全部は無理だった」',
          '「だから——」',
          '「一緒に、ことばを取り戻してほしい」',
          '「まずは、みんなの問題から\nことばを解いてきて」',
          '「取り戻したことばは、\nこの図書館に記録されていくよ」',
          '「……いこう」',
        ],
      },
    ],
  },
];