export interface PrepositionQuizItem {
  q: string;
  options: [string, string, string, string];
  a: number; // correct option index
  explanation: string;
}

// 予備を含めて60問、表示時にランダムで50問抜き出す
export const PREPOSITION_QUIZ: PrepositionQuizItem[] = [
  { q: "He is interested ___ science fiction.", options: ["in", "on", "at", "for"], a: 0, explanation: "`interested in ~` で「〜に興味がある」" },
  { q: "She arrived ___ the airport at 9.", options: ["in", "to", "at", "on"], a: 2, explanation: "「地点」到着は arrive at＋場所（大きい都市なら in）" },
  { q: "This train departs ___ Tokyo at noon.", options: ["from", "for", "in", "on"], a: 0, explanation: "出発地点は depart from" },
  { q: "I'll call you ___ Monday.", options: ["on", "at", "in", "for"], a: 0, explanation: "曜日は on" },
  { q: "We usually have lunch ___ noon.", options: ["on", "at", "in", "for"], a: 1, explanation: "時刻は at" },
  { q: "My birthday is ___ June.", options: ["on", "at", "in", "by"], a: 2, explanation: "月・年・季節は in" },
  { q: "He walked ___ the bridge.", options: ["over", "on", "across", "through"], a: 2, explanation: "一方から他方へ渡る=across" },
  { q: "Let's meet ___ the station gate.", options: ["in", "on", "at", "to"], a: 2, explanation: "地点での待ち合わせは at" },
  { q: "She put the keys ___ her pocket.", options: ["on", "in", "into", "onto"], a: 2, explanation: "動きを伴う「〜の中へ」は into" },
  { q: "There is a picture ___ the wall.", options: ["in", "on", "at", "over"], a: 1, explanation: "平面に接している=on the wall" },
  { q: "I walked ___ the park and went home.", options: ["through", "over", "across", "along"], a: 0, explanation: "内部を通り抜ける=through" },
  { q: "The cat jumped ___ the table.", options: ["in", "on", "onto", "into"], a: 2, explanation: "上へ移動して乗る=onto" },
  { q: "The plane is flying ___ the clouds.", options: ["over", "on", "across", "above"], a: 0, explanation: "広く上空を越えて=over" },
  { q: "She lives ___ a small village.", options: ["on", "at", "in", "to"], a: 2, explanation: "街・村などの中=live in" },
  { q: "He is good ___ math.", options: ["at", "in", "for", "on"], a: 0, explanation: "得意は be good at" },
  { q: "I'm looking forward ___ seeing you.", options: ["to", "for", "at", "on"], a: 0, explanation: "forward to ~ing で「〜を楽しみにする」" },
  { q: "She is famous ___ her songs.", options: ["of", "for", "about", "with"], a: 1, explanation: "理由・対象で有名=famous for" },
  { q: "He apologized ___ being late.", options: ["for", "about", "to", "with"], a: 0, explanation: "apologize for + 行為" },
  { q: "I agree ___ you on that point.", options: ["to", "with", "on", "for"], a: 1, explanation: "人に同意する=agree with 人" },
  { q: "The shop is open ___ 9 a.m. to 7 p.m.", options: ["for", "between", "from", "since"], a: 2, explanation: "開始〜終了は from ... to ..." },
  { q: "He has lived here ___ 2010.", options: ["for", "since", "from", "during"], a: 1, explanation: "起点を示す since" },
  { q: "I'll finish the work ___ an hour.", options: ["for", "during", "within", "by"], a: 2, explanation: "〜以内に=within" },
  { q: "She stayed there ___ three days.", options: ["for", "since", "during", "in"], a: 0, explanation: "期間の長さは for" },
  { q: "No one was there ___ me.", options: ["besides", "except", "but", "except for"], a: 3, explanation: "例外=except for / except / but; ここでは except for が自然" },
  { q: "He succeeded ___ business.", options: ["on", "at", "in", "for"], a: 2, explanation: "分野・活動で成功する=succeed in" },
  { q: "Don't rely ___ luck.", options: ["in", "on", "to", "for"], a: 1, explanation: "依存する= rely on" },
  { q: "She insisted ___ paying the bill.", options: ["to", "on", "for", "about"], a: 1, explanation: "insist on ~ing" },
  { q: "He is proud ___ his son.", options: ["of", "for", "with", "about"], a: 0, explanation: "be proud of" },
  { q: "This book was written ___ English.", options: ["by", "in", "with", "on"], a: 1, explanation: "言語は in" },
  { q: "I paid ___ the coffee.", options: ["of", "for", "to", "with"], a: 1, explanation: "お金を払う対象=pay for" },
  { q: "She complained ___ the noise.", options: ["for", "about", "of", "to"], a: 1, explanation: "complain about 〜" },
  { q: "He apologized ___ her.", options: ["to", "for", "about", "with"], a: 0, explanation: "人に謝る=apologize to 人" },
  { q: "The room was full ___ people.", options: ["of", "with", "by", "from"], a: 0, explanation: "full of 〜で満たされている" },
  { q: "We are short ___ time.", options: ["for", "of", "on", "in"], a: 1, explanation: "不足している=short of" },
  { q: "He is similar ___ his father.", options: ["with", "to", "for", "at"], a: 1, explanation: "似ている=similar to" },
  { q: "She divided the cake ___ six pieces.", options: ["into", "in", "for", "to"], a: 0, explanation: "分割は divide A into B" },
  { q: "He translated the novel ___ Japanese.", options: ["into", "to", "in", "for"], a: 0, explanation: "〜に翻訳する translate into" },
  { q: "He is afraid ___ spiders.", options: ["of", "for", "about", "with"], a: 0, explanation: "afraid of" },
  { q: "She suffers ___ hay fever.", options: ["from", "of", "by", "with"], a: 0, explanation: "suffer from" },
  { q: "We were stuck ___ traffic.", options: ["on", "at", "in", "into"], a: 2, explanation: "渋滞にハマる=stuck in traffic" },
  { q: "He congratulated me ___ my promotion.", options: ["about", "for", "on", "to"], a: 2, explanation: "congratulate 人 on 事" },
  { q: "She is capable ___ solving the problem.", options: ["to", "for", "with", "of"], a: 3, explanation: "be capable of ~ing" },
  { q: "He is responsible ___ the project.", options: ["of", "for", "to", "with"], a: 1, explanation: "担当=responsible for" },
  { q: "This key doesn't fit ___ the door.", options: ["to", "in", "into", "for"], a: 1, explanation: "合う=fit in/into。ここは in the door." },
  { q: "She graduated ___ college last year.", options: ["from", "of", "at", "on"], a: 0, explanation: "graduate from 学校" },
  { q: "I was surprised ___ the news.", options: ["at", "with", "of", "about"], a: 0, explanation: "surprised at/by" },
  { q: "They divided the money ___ them.", options: ["between", "among", "for", "with"], a: 1, explanation: "3人以上で分ける=among" },
  { q: "Please turn ___ the lights.", options: ["up", "off", "down", "out"], a: 1, explanation: "消す=turn off" },
  { q: "He looked ___ the word in a dictionary.", options: ["up", "for", "after", "into"], a: 0, explanation: "調べる=look up" },
  { q: "She is good ___ dealing with people.", options: ["in", "for", "at", "with"], a: 2, explanation: "be good at ~ing" },
  { q: "Keep ___ the grass.", options: ["on", "off", "out", "up"], a: 1, explanation: "立入禁止=keep off" },
  { q: "He went ___ a difficult time.", options: ["through", "over", "across", "into"], a: 0, explanation: "経験する=go through" },
  { q: "I ran ___ an old friend yesterday.", options: ["over", "across", "into", "after"], a: 2, explanation: "偶然出会う=run into" }
];

