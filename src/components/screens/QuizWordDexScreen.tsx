import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, BookMarked, Star, Plus, MoreHorizontal, BookOpen, FlaskConical, Home, Globe, Gamepad2, HelpCircle, LockKeyhole, BookText } from 'lucide-react';
import { useGameStore } from '@/store/useGameStore';
import { vibrateLight } from '@/lib/haptics';

interface QuizWordDexScreenProps {
  onBack: () => void;
}

const WORDS_PER_VOL = 50;
const WORDS_PER_PAGE = 10;
const LEVEL_STEP = 30;
type ThemeKey = 'indigo' | 'emerald' | 'amber' | 'rose' | 'slate';

const formatDate = (value: string): string => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('ja-JP');
};

const ICON_KEY_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  book:  BookOpen,
  flask: FlaskConical,
  home:  Home,
  globe: Globe,
  game:  Gamepad2,
  other: HelpCircle,
};

const getDictionaryLucideIcon = (name: string, iconKey?: string) => {
  if (iconKey && ICON_KEY_MAP[iconKey]) return ICON_KEY_MAP[iconKey];
  if (name.includes('化学') || name.includes('科目')) return FlaskConical;
  if (name.includes('宅建') || name.includes('資格')) return Home;
  if (name.includes('英語') || name.includes('語学')) return Globe;
  if (name.includes('趣味') || name.includes('ゲーム') || name.includes('アニメ')) return Gamepad2;
  if (name.includes('その他')) return HelpCircle;
  return BookOpen;
};

type ExtendedThemeKey = ThemeKey | 'forest' | 'neon' | 'brown';

// 高級感のある深い青で全テーマを統一
const LUXURY_BLUE = {
  card: 'from-[#0d1b2e] via-[#0f2040] to-[#0a1628] border-blue-400/30 shadow-blue-950/80',
  cta:  'from-blue-600/90 to-cyan-600/85',
  gauge:'from-blue-300/90 to-cyan-300/90',
  glow: 'ring-blue-400/60',
};

const THEME_MAP: Record<ExtendedThemeKey, { card: string; cta: string; gauge: string; glow: string }> = {
  forest:  LUXURY_BLUE,
  neon:    LUXURY_BLUE,
  brown:   LUXURY_BLUE,
  indigo:  LUXURY_BLUE,
  emerald: LUXURY_BLUE,
  amber:   LUXURY_BLUE,
  rose:    LUXURY_BLUE,
  slate:   LUXURY_BLUE,
};

export const QuizWordDexScreen = ({ onBack }: QuizWordDexScreenProps) => {
  const dictionaries = useGameStore((s) => s.wordDexDictionaries);
  const words = useGameStore((s) => s.wordDexWords);
  const addWordDexDictionary = useGameStore((s) => s.addWordDexDictionary);
  const renameWordDexDictionary = useGameStore((s) => s.renameWordDexDictionary);
  const moveWordDexBatch = useGameStore((s) => s.moveWordDexBatch);

  const [selectedDictionaryId, setSelectedDictionaryId] = useState<string | null>(null);
  const [selectedVol, setSelectedVol] = useState<number | null>(null);
  const [selectedPage, setSelectedPage] = useState(1);
  const [selectedWordId, setSelectedWordId] = useState<string | null>(null);
  const [moveTargetDictionaryId, setMoveTargetDictionaryId] = useState<string>('');
  const [flashDictionaryId, setFlashDictionaryId] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newDictionaryName, setNewDictionaryName] = useState('');
  const [newDictionaryIcon, setNewDictionaryIcon] = useState('book');
  const [newDictionaryTheme, setNewDictionaryTheme] = useState<ExtendedThemeKey>('forest');

  const currentDictionary = useMemo(
    () => dictionaries.find((d) => d.id === selectedDictionaryId) ?? null,
    [dictionaries, selectedDictionaryId]
  );

  const dictionaryWordsSorted = useMemo(() => {
    if (!selectedDictionaryId) return [];
    const filtered = words.filter((w) => w.dictionaryId === selectedDictionaryId);
    return [...filtered].sort((a, b) => a.name.localeCompare(b.name, 'ja'));
  }, [words, selectedDictionaryId]);

  const withDisplayNo = useMemo(
    () => dictionaryWordsSorted.map((w, idx) => ({ ...w, displayNo: idx + 1 })),
    [dictionaryWordsSorted]
  );

  const volCount = useMemo(() => {
    const count = Math.ceil(withDisplayNo.length / WORDS_PER_VOL);
    return Math.max(1, count);
  }, [withDisplayNo.length]);

  const currentVolWords = useMemo(() => {
    if (selectedVol === null) return [];
    const start = selectedVol * WORDS_PER_VOL;
    return withDisplayNo.slice(start, start + WORDS_PER_VOL);
  }, [selectedVol, withDisplayNo]);

  const currentPageWords = useMemo(() => {
    const start = (selectedPage - 1) * WORDS_PER_PAGE;
    return currentVolWords.slice(start, start + WORDS_PER_PAGE);
  }, [currentVolWords, selectedPage]);

  const selectedWord = useMemo(
    () => withDisplayNo.find((w) => w.id === selectedWordId) ?? null,
    [withDisplayNo, selectedWordId]
  );

  const goBack = () => {
    vibrateLight();
    if (selectedWordId) {
      setSelectedWordId(null);
      return;
    }
    if (selectedVol !== null) {
      setSelectedVol(null);
      setSelectedPage(1);
      return;
    }
    if (selectedDictionaryId) {
      setSelectedDictionaryId(null);
      return;
    }
    onBack();
  };

  const handleOpenDictionary = (dictionaryId: string) => {
    vibrateLight();
    setFlashDictionaryId(dictionaryId);
    setTimeout(() => {
      setFlashDictionaryId((prev) => (prev === dictionaryId ? null : prev));
    }, 180);
    setSelectedDictionaryId(dictionaryId);
    setSelectedVol(null);
    setSelectedPage(1);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#060d1a] via-[#091326] to-[#060d1a] p-4 text-white">
      <div className="max-w-md mx-auto pt-4 pb-4">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={goBack}
            className="flex items-center gap-1 text-blue-300/80 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
            <span className="font-bold text-sm">戻る</span>
          </button>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <BookMarked className="w-5 h-5 text-blue-400" />
            {currentDictionary ? currentDictionary.name : 'ことば図鑑'}
          </h1>
          {!selectedDictionaryId ? (
            <button
              onClick={() => {
                vibrateLight();
                setShowCreateModal(true);
              }}
              className="p-2 rounded-full bg-blue-900/40 border border-blue-700/50 hover:bg-blue-800/60 text-blue-300 transition-colors shadow-lg"
            >
              <Plus className="w-5 h-5" />
            </button>
          ) : (
            <div className="w-16" />
          )}
        </div>

        {/* --- 図鑑TOP（辞書一覧） --- */}
        {!selectedDictionaryId && (
          <>
            <div className="dex-grid grid grid-cols-2 gap-3">
              {dictionaries.map((d) => {
                const registeredCount = words.filter((w) => w.dictionaryId === d.id && w.correctCount > 0).length;
                const level = Math.floor(registeredCount / LEVEL_STEP) + 1;
                const current = registeredCount % LEVEL_STEP;
                const progressRatio = LEVEL_STEP > 0 ? current / LEVEL_STEP : 0;
                const DexIcon = getDictionaryLucideIcon(d.name, d.icon);
                const theme = THEME_MAP[(d.theme as ExtendedThemeKey) || 'forest'] || THEME_MAP.forest;
                return (
                  <motion.div
                    key={d.id}
                    onClick={() => handleOpenDictionary(d.id)}
                    whileTap={{ scale: 0.98, boxShadow: '0 8px 30px rgba(0,0,0,0.6)' }}
                    className={`relative min-h-[140px] rounded-2xl overflow-hidden shadow-xl bg-gradient-to-br border cursor-pointer transition-all ${theme.card} ${
                      flashDictionaryId === d.id ? `ring-2 ${theme.glow} brightness-110` : 'hover:border-blue-400/50 hover:brightness-105'
                    }`}
                  >
                    <div className="px-4 pt-4 pb-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-bold text-white text-[15px] flex items-center gap-2 tracking-wide">
                            <DexIcon className="w-5 h-5 text-blue-300 shrink-0" strokeWidth={1.5} />
                            {d.name}
                          </p>
                          <p className="text-xs text-blue-200/60 font-mono mt-1 font-semibold">Lv.{level}</p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuOpenId((prev) => (prev === d.id ? null : d.id));
                          }}
                          className="p-1 rounded-md text-blue-300/50 hover:text-white hover:bg-white/10"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex items-center justify-between mt-3">
                        <p className="text-[13px] text-yellow-400 font-bold flex items-center gap-1">
                          <Star className="w-3.5 h-3.5 fill-yellow-500" />
                          {registeredCount}
                        </p>
                        <p className="text-[11px] font-mono text-blue-200/60">{current} / {LEVEL_STEP}</p>
                      </div>
                      <div className="mt-1.5">
                        <div className="w-full h-1.5 bg-[#050b14] rounded-full overflow-hidden border border-blue-900/30">
                          <div
                            className={`h-full bg-gradient-to-r ${theme.gauge}`}
                            style={{ width: `${Math.round(progressRatio * 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {menuOpenId === d.id && (
                      <div
                        className="absolute right-2 top-10 z-10 rounded-xl border border-blue-800/60 bg-[#0a1628] p-1.5 shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => {
                            vibrateLight();
                            const next = window.prompt('図鑑名を変更', d.name);
                            if (next && next.trim()) renameWordDexDictionary(d.id, next.trim());
                            setMenuOpenId(null);
                          }}
                          className="w-full text-left text-xs text-blue-100 hover:bg-blue-900/50 px-3 py-2 rounded-lg"
                        >
                          名称変更
                        </button>
                      {d.id !== 'dex_other' && (
                        <button
                          onClick={() => {
                            setMenuOpenId(null);
                            setTimeout(() => {
                              const ok = window.confirm(`図鑑「${d.name}」を削除しますか？\n（含まれる用語は「その他図鑑」へ移動されます）`);
                              if (ok) {
                                vibrateLight();
                                useGameStore.getState().deleteWordDexDictionary(d.id);
                              }
                            }, 10);
                          }}
                          className="w-full text-left text-xs text-rose-400 hover:bg-blue-900/50 px-3 py-2 rounded-lg"
                        >
                          削除
                        </button>
                      )}
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
            <style jsx>{`
              .dex-grid {
                display: grid;
                grid-template-columns: repeat(2, minmax(0, 1fr));
                gap: 0.75rem;
              }
              @media (max-width: 360px) {
                .dex-grid {
                  grid-template-columns: 1fr;
                }
              }
            `}</style>
          </>
        )}

        {/* --- VOL一覧 --- */}
        {selectedDictionaryId && selectedVol === null && (
          <div className="space-y-3">
            {Array.from({ length: volCount + 1 }, (_, i) => {
              const start = i * WORDS_PER_VOL + 1;
              const end = Math.min((i + 1) * WORDS_PER_VOL, withDisplayNo.length);
              const volWords = withDisplayNo.slice(i * WORDS_PER_VOL, (i + 1) * WORDS_PER_VOL);
              const captured = volWords.filter((w) => w.correctCount > 0).length;
              const prevVolWords = i > 0 ? withDisplayNo.slice((i - 1) * WORDS_PER_VOL, i * WORDS_PER_VOL) : [];
              const prevCaptured = i > 0 ? prevVolWords.filter((w) => w.correctCount > 0).length : 0;
              const prevComplete = i === 0 ? true : prevCaptured >= WORDS_PER_VOL;
              const isUnlocked = i === 0 ? true : prevComplete;

              return (
                <button
                  key={i}
                  onClick={() => {
                    if (!isUnlocked) return;
                    vibrateLight();
                    setSelectedVol(i);
                    setSelectedPage(1);
                  }}
                  className={`w-full rounded-2xl border px-4 py-4 flex items-center justify-between transition-all ${
                    isUnlocked
                      ? 'bg-gradient-to-r from-[#0d1b2e] to-[#0a1628] border-blue-500/30 hover:border-blue-400/60 shadow-lg shadow-blue-950/40'
                      : 'bg-[#050b14]/80 border-blue-900/30 opacity-50 cursor-not-allowed'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`shrink-0 w-12 h-12 rounded-xl flex items-center justify-center border ${
                      isUnlocked
                        ? 'bg-blue-900/40 border-blue-500/40 shadow-inner'
                        : 'bg-gray-900/60 border-gray-700/40'
                    }`}>
                      {isUnlocked
                        ? <BookText className="w-6 h-6 text-blue-300" strokeWidth={1.5} />
                        : <LockKeyhole className="w-5 h-5 text-gray-500" strokeWidth={1.5} />
                      }
                    </div>
                    <div className="text-left">
                      <p className={`font-bold tracking-wide text-[16px] mb-0.5 ${isUnlocked ? 'text-white' : 'text-gray-500'}`}>
                        {currentDictionary ? `${currentDictionary.name} VOL ${i + 1}` : `図鑑 VOL ${i + 1}`}
                      </p>
                      <p className="text-xs text-blue-200/60 font-mono">
                        {isUnlocked ? (volWords.length > 0 ? `No.${String(start).padStart(3,'0')} 〜 ${String(end).padStart(3,'0')}` : 'データなし') : '未解放'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className={`font-mono text-sm font-bold ${isUnlocked ? 'text-blue-300' : 'text-gray-600'}`}>{captured}<span className="text-[10px] text-blue-200/40 ml-0.5">/{volWords.length}</span></p>
                    {isUnlocked && <ChevronRight className="w-5 h-5 text-blue-400/60" />}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* --- 単語一覧（RPGアイテム欄風・横長カード） --- */}
        {selectedDictionaryId && selectedVol !== null && (
          <div className="animate-in fade-in duration-300">
            {/* ページネーション */}
            <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2 hide-scrollbar">
              {Array.from({ length: 5 }, (_, idx) => idx + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => {
                    vibrateLight();
                    setSelectedPage(p);
                  }}
                  className={`shrink-0 w-11 h-11 rounded-xl text-sm font-bold transition-all ${
                    selectedPage === p
                      ? 'bg-blue-600 border border-blue-400 text-white shadow-[0_0_12px_rgba(59,130,246,0.4)]'
                      : 'bg-[#0a1628] border border-blue-900/50 text-blue-300/60 hover:bg-[#0d1b2e]'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>

            {currentPageWords.length === 0 ? (
              <div className="rounded-2xl border border-blue-900/40 bg-[#0a1628] p-8 text-center text-blue-300/50">
                このページに用語はありません
              </div>
            ) : (
              // ▼ ここが修正のポイント：grid-cols-2を廃止し、縦積みのリスト(space-y-3)に変更 ▼
              <div className="space-y-3">
                {currentPageWords.map((w) => {
                  const registered = w.correctCount > 0;
                  return (
                    <button
                      key={w.id}
                      onClick={() => {
                        vibrateLight();
                        setSelectedWordId(w.id);
                        setMoveTargetDictionaryId(w.dictionaryId);
                      }}
                      className={`w-full text-left rounded-2xl border px-4 py-3.5 flex items-center justify-between transition-all ${
                        registered
                          ? 'bg-gradient-to-r from-[#0d1b2e] to-[#0a1628] border-blue-500/40 shadow-md shadow-blue-950/50 hover:border-blue-400/60'
                          : 'bg-[#050b14]/60 border-blue-900/20 opacity-60 cursor-default'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        {/* 左側のアイコンスロット */}
                        <div className={`shrink-0 w-[48px] h-[48px] rounded-[14px] flex items-center justify-center border shadow-inner ${
                          registered
                            ? 'bg-blue-900/40 border-blue-400/40 text-blue-300'
                            : 'bg-gray-900/50 border-gray-800/80 text-gray-600'
                        }`}>
                          {registered
                            ? <BookOpen className="w-6 h-6" strokeWidth={1.5} />
                            : <LockKeyhole className="w-5 h-5" strokeWidth={1.5} />
                          }
                        </div>

                        {/* テキスト情報 */}
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`inline-block text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                              registered ? 'bg-[#0a1628] text-blue-300 border-blue-800/50' : 'bg-gray-900 text-gray-600 border-gray-800'
                            }`}>
                              No.{String(w.displayNo).padStart(3, '0')}
                            </span>
                            {registered && <Star className="w-3.5 h-3.5 fill-yellow-500 text-yellow-500 drop-shadow-[0_0_4px_rgba(234,179,8,0.5)]" />}
                          </div>
                          <p className={`font-bold text-[16px] tracking-wide ${registered ? 'text-white' : 'text-gray-500'}`}>
                            {w.name}
                          </p>
                        </div>
                      </div>

                      {/* 登録済みのみ右端に矢印 */}
                      {registered && (
                        <ChevronRight className="w-5 h-5 text-blue-400/60 shrink-0 ml-2" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* --- 単語詳細モーダル --- */}
      {selectedWord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-[#030712]/80 backdrop-blur-sm"
            onClick={() => setSelectedWordId(null)}
          />
          <div className="relative w-full max-w-md rounded-3xl border border-blue-500/30 bg-gradient-to-b from-[#0d1b2e] to-[#0a1628] p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-mono text-blue-300/70">No.{selectedWord.displayNo}</p>
              {selectedWord.correctCount > 0 && (
                <span className="text-yellow-400 flex items-center gap-1.5 text-xs font-bold bg-yellow-900/30 px-2.5 py-1 rounded-full border border-yellow-700/50">
                  <Star className="w-3.5 h-3.5 fill-yellow-500" />
                  登録済
                </span>
              )}
            </div>
            <h3 className="text-2xl font-bold mb-4 tracking-wide text-white">{selectedWord.name}</h3>
            <div className="space-y-2 text-sm text-blue-100/80 mb-6 bg-[#060d1a]/50 p-4 rounded-2xl border border-blue-900/40">
              <p className="flex justify-between"><span>発見日</span> <span className="font-mono text-white">{formatDate(selectedWord.firstEncounterDate)}</span></p>
              <p className="flex justify-between"><span>挑戦回数</span> <span className="font-mono text-white">{selectedWord.totalAttempts} 回</span></p>
              <p className="flex justify-between">
                <span>正答率</span>
                <span className="font-mono text-white">
                  {selectedWord.totalAttempts > 0
                    ? `${Math.round((selectedWord.correctCount / selectedWord.totalAttempts) * 100)}%`
                    : '—'}
                </span>
              </p>
              <p className="flex justify-between"><span>連続正解</span> <span className="font-mono text-white">{selectedWord.consecutiveCorrect} 回</span></p>
              <p className="flex justify-between"><span>最終挑戦日</span> <span className="font-mono text-white">{formatDate(selectedWord.lastAttemptDate)}</span></p>
              <div className="pt-3 mt-3 border-t border-blue-900/50 text-blue-200/60 leading-relaxed">
                説明: {selectedWord.description || '—'}
              </div>
            </div>

            <div className="border-t border-blue-900/50 pt-5">
              <p className="text-sm text-blue-300/70 mb-2 font-bold">📂 図鑑を変更（5問セット単位）</p>
              <select
                value={moveTargetDictionaryId}
                onChange={(e) => setMoveTargetDictionaryId(e.target.value)}
                className="w-full mb-4 rounded-xl border border-blue-800/60 bg-[#0a1628] px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-white appearance-none"
              >
                {dictionaries.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              <button
                onClick={() => {
                  vibrateLight();
                  moveWordDexBatch(selectedWord.batchId, moveTargetDictionaryId);
                  setSelectedWordId(null);
                }}
                className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition-colors shadow-lg"
              >
                5問セットを移動
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- 新規図鑑作成モーダル --- */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#030712]/80 backdrop-blur-sm" onClick={() => setShowCreateModal(false)} />
          <div className="relative w-full max-w-md rounded-3xl border border-blue-500/30 bg-gradient-to-b from-[#0d1b2e] to-[#0a1628] p-6 shadow-2xl">
            <h3 className="text-xl font-bold mb-5 tracking-wide text-white">新しい図鑑を作成</h3>

            <label className="block text-sm text-blue-200 mb-1.5 ml-1 font-bold">図鑑名（必須）</label>
            <input
              value={newDictionaryName}
              onChange={(e) => setNewDictionaryName(e.target.value)}
              className="w-full mb-5 rounded-xl border border-blue-800/60 bg-[#060d1a] px-4 py-3 text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none placeholder-blue-900"
              placeholder="例: 生物図鑑"
            />

            <label className="block text-sm text-blue-200 mb-1.5 ml-1 font-bold">アイコン（任意）</label>
            <div className="grid grid-cols-6 gap-2 mb-6">
              {([
                { key: 'book',    Icon: BookOpen },
                { key: 'flask',   Icon: FlaskConical },
                { key: 'home',    Icon: Home },
                { key: 'globe',   Icon: Globe },
                { key: 'game',    Icon: Gamepad2 },
                { key: 'other',   Icon: HelpCircle },
              ] as const).map(({ key, Icon }) => (
                <button
                  key={key}
                  onClick={() => setNewDictionaryIcon(key)}
                  className={`h-11 rounded-xl border flex items-center justify-center transition-all ${
                    newDictionaryIcon === key 
                      ? 'border-blue-400 bg-blue-500/20 text-blue-300 scale-105' 
                      : 'border-blue-900/50 bg-[#0a1628] text-blue-400/40 hover:bg-blue-900/20'
                  }`}
                >
                  <Icon className="w-5 h-5" strokeWidth={1.5} />
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 py-3.5 rounded-xl border border-blue-800/60 text-blue-300/80 hover:bg-[#060d1a] transition-colors font-bold"
              >
                キャンセル
              </button>
              <button
                onClick={() => {
                  const name = newDictionaryName.trim();
                  if (!name) return;
                  vibrateLight();
                  addWordDexDictionary({
                    name,
                    icon: newDictionaryIcon,
                    theme: newDictionaryTheme,
                  });
                  setShowCreateModal(false);
                  setNewDictionaryName('');
                  setNewDictionaryIcon('book');
                  setNewDictionaryTheme('forest');
                }}
                className="flex-1 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition-colors shadow-lg"
              >
                作成
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuizWordDexScreen;