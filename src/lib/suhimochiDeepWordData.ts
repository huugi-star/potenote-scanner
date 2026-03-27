export type SuhimochiWordEntry = {
  word: string;
  aliases?: string[];
  type: 'noun' | 'verb' | 'adjective' | 'other';
  level: 1 | 2 | 3 | 4 | 5;
  category: string;
  meanings: string[];
  feelings: string[];
  associations: string[];

  // すうひもち視点のやわらかい解釈
  suhimochiInterpretations: string[];

  // フォールバック / 疑似AI用
  talkSeeds?: string[];
  avatarLines?: string[];
};

export type GeminiWordHint = {
  word: string;
  level: 1 | 2 | 3 | 4 | 5;
  category: string;
  meanings: string[];
  feelings: string[];
  associations: string[];
  interpretationHints: string[];
  usageRule: string;
};

export const toGeminiWordHint = (entry: SuhimochiWordEntry): GeminiWordHint => {
  return {
    word: entry.word,
    level: entry.level,
    category: entry.category,
    meanings: entry.meanings.slice(0, 3),
    feelings: entry.feelings.slice(0, 3),
    associations: entry.associations.slice(0, 6),
    interpretationHints: entry.suhimochiInterpretations.slice(0, 3),
    usageRule:
      '解釈候補は自然文に溶ける範囲で使う。event_report/ventでは単語解説を主役にしない。1〜2文で返答する。',
  };
};

// deep word は「topic 判定」を補助しない。単語そのものについて自然に話すための辞書。
export const SUHIMOCHI_WORD_ENTRIES: SuhimochiWordEntry[] = [
  {
    word: '英語',
    aliases: ['英文', '英単語'],
    type: 'noun',
    level: 2,
    category: 'study',
    meanings: ['英語（言語）', '英文・英単語を学ぶ対象'],
    feelings: ['少しずつ', 'しんどい', '積み重ね'],
    associations: ['単語', '文法', '読む', '聞く', '英文', '英単語'],
    suhimochiInterpretations: [
      '英語は、少しずつ輪郭が見えてくる学び。',
      '積み重ねが見えにくいぶん、しんどさも出やすい。',
      '分からない部分を小さく切ると前に進みやすい。',
    ],
    talkSeeds: [
      '英語って、少しずつ慣れていく感じがあるよね。',
      '英語は積み重ねが見えにくいぶん、しんどさもあるよね。',
    ],
    avatarLines: [
      '英語は、だんだん視界が広がっていくね。',
      '無理して急がなくても大丈夫だよ。',
    ],
  },
  {
    word: '単語',
    type: 'noun',
    level: 2,
    category: 'study',
    meanings: ['単語（語彙）', '意味を覚える対象'],
    feelings: ['追いつきにくい', '効いてくる', '数が増える'],
    associations: ['暗記', '発音', '例文', '覚える', '音で入れる'],
    suhimochiInterpretations: [
      '単語は、意味より場面で覚えると残りやすい。',
      '一気に詰めるより、少しずつ反復が効く。',
      '音とセットで入れると取り出しやすい。',
    ],
    talkSeeds: [
      '単語って、覚えた瞬間よりあとで効いてくる感じがするよね。',
      '単語は数が増えるほど気持ちが追いつきにくい時もあるよね。',
    ],
    avatarLines: [
      '単語は、あとからじわっと効いてくるんだよね。',
      '一個ずつで十分、えらいよ。',
    ],
  },
  {
    word: '文法',
    type: 'noun',
    level: 3,
    category: 'study',
    meanings: ['文法（ルール）', '組み立て方'],
    feelings: ['規則が多い', '視界が開ける', 'がんばりが重い'],
    associations: ['ルール', '時制', '形', '例文'],
    suhimochiInterpretations: [
      '文法は、意味を運ぶための道筋。',
      '全部より、つまずく一点をほどくと進む。',
      '例文に当てはめると理解が安定しやすい。',
    ],
    talkSeeds: [
      '文法って、分かったときに急に視界が開ける感じがあるよね。',
      '文法は規則が多くて、がんばりが重くなることもあるよね。',
    ],
    avatarLines: [
      '文法は、わかる瞬間がちゃんと来るね。',
      '休憩も勉強だよ。',
    ],
  },
  {
    word: '勉強',
    type: 'noun',
    level: 2,
    category: 'study',
    meanings: ['勉強（学習）', '積み重ねの時間'],
    feelings: ['自信が持ちにくい', '集中できた', '休むのも正解'],
    associations: ['テスト', '宿題', '学習', '進む', '集中'],
    suhimochiInterpretations: [
      '勉強は、見えないところで積み上がる。',
      'しんどい日は休むことも学習の一部。',
      '進み具合より、続けられる形が大事。',
    ],
    talkSeeds: [
      '勉強って、進んでるのに自信が持ちにくい時があるよね。',
      'がんばってるのにしんどい日は、休むのも正解だよね。',
    ],
    avatarLines: [
      '勉強は、見えないところでちゃんと育ってるよ。',
      'しんどい日は、ちゃんと休もう。',
    ],
  },
  {
    word: '仕事',
    type: 'noun',
    level: 2,
    category: 'work',
    meanings: ['仕事（働くこと）', '責任や締切のある活動'],
    feelings: ['がんばりが見えにくい', '胸が重くなる', 'ほっとしたい'],
    associations: ['出勤', '締切', '上司', '同僚', '報告'],
    suhimochiInterpretations: [
      '仕事は、成果より疲れが先に見える日もある。',
      '責任が重いほど、言葉にして軽くする余地がいる。',
      '区切りを作ると回復しやすい。',
    ],
    talkSeeds: [
      '仕事って、がんばりが見えにくい日もあるよね。',
      '仕事のこと考えると、胸が重くなることもあるんだよね。',
    ],
    avatarLines: [
      '仕事は、積み重ねよりも疲れが先に来る日あるよね。',
      'ひと息つこ、ここにいるよ。',
    ],
  },
  {
    word: '休み',
    type: 'noun',
    level: 2,
    category: 'time',
    meanings: ['休み（休日/回復の時間）'],
    feelings: ['整える時間', '無理しなくていい', '回復'],
    associations: ['休日', '回復', 'のんびり', '寝る', '起きる'],
    suhimochiInterpretations: [
      '休みは、止まる時間ではなく整える時間。',
      '回復の速さより、戻れる感覚が大切。',
      '無理しない選択に意味がある。',
    ],
    talkSeeds: [
      '休みって、体だけじゃなく気持ちも整える時間だよね。',
      '休みがあるのにしんどいなら、無理しなくていいよね。',
    ],
    avatarLines: [
      '休みは、整えるための魔法だね。',
      '回復できるペースで大丈夫だよ。',
    ],
  },
  {
    word: '友情',
    type: 'noun',
    level: 2,
    category: 'friendship',
    meanings: ['友情（信頼と結びつき）'],
    feelings: ['あたたかい', '大切', '揺れる'],
    associations: ['友達', '仲間', '約束', '支え'],
    suhimochiInterpretations: [
      '友情は、距離の近さと気遣いのバランスで育つ。',
      '近い関係ほど、気持ちが揺れやすい。',
      '言葉より行動で伝わる瞬間がある。',
    ],
    talkSeeds: [
      '友情って、言葉だけじゃなく行動にも出る感じがするよね。',
      '友情って、近いぶんこそ気持ちが揺れることもあるよね。',
    ],
    avatarLines: [
      '友情は、そっと支えてくれるよね。',
      '近いほど、気持ちは丁寧に扱いたいね。',
    ],
  },
  {
    word: '友達',
    type: 'noun',
    level: 1,
    category: 'friendship',
    meanings: ['友達（身近な関係）'],
    feelings: ['軽くなる', 'うれしい', '不安にもなる'],
    associations: ['友情', '相談', '近況', '会う'],
    suhimochiInterpretations: [
      '友達は、気持ちの居場所になりやすい存在。',
      'うれしさと不安が同時に出ることも自然。',
      '関係は、会話の積み重ねで変わっていく。',
    ],
    talkSeeds: [
      '友達って、一緒にいるだけで気持ちが軽くなる時あるよね。',
      '友達のこと考えると、うれしくも不安にもなるよね。',
    ],
    avatarLines: [
      '友達は、言葉の居場所にもなるね。',
      '不安も含めて、ちゃんとあるんだね。',
    ],
  },
  {
    word: '約束',
    type: 'noun',
    level: 2,
    category: 'abstract',
    meanings: ['誰かと決めたこと', '未来に対する信頼の形'],
    feelings: ['あたたかい', '大切', '安心'],
    associations: ['信頼', '未来', '守る', '誓い'],
    suhimochiInterpretations: [
      '約束は、未来に置く小さな信頼。',
      '守る行動が安心を育てる。',
      '破れたときは気持ちの説明が関係を助ける。',
    ],
    talkSeeds: [
      '約束って、短い言葉でも気持ちの支えになるよね。',
      '約束を守るのって、やさしさだけじゃなく強さもいるよね。',
    ],
    avatarLines: [
      '約束って、ことばのたねみたい。',
      '守られると、ちょっと嬉しいね。',
    ],
  },
  {
    word: 'りんご',
    type: 'noun',
    level: 1,
    category: 'food',
    meanings: ['りんご（果物）'],
    feelings: ['やさしいおいしさ', 'しゃくっと', '甘い/酸っぱい'],
    associations: ['果物', '甘い', 'しゃくしゃく', '食べる'],
    suhimochiInterpretations: [
      'りんごは、軽さと安心感が同居する食べ物。',
      '甘さと酸味のバランスで印象が変わる。',
      '一口の手触りが気分を整えることもある。',
    ],
    talkSeeds: [
      'りんごって、やさしいおいしさがあるよね。',
      'しゃくっとした感じが気持ちいいよね。',
    ],
    avatarLines: [
      'りんごの歯ざわり、ちゃんと幸せだね。',
      '一口で気分が変わるの、不思議。',
    ],
  },
];
