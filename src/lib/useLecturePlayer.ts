import { useState, useRef, useCallback, useEffect } from 'react';
import type { LectureItem, CharacterTone } from '@/types';

/**
 * 音声設定マップ
 */
const VOICE_SETTINGS: Record<CharacterTone | 'student', { pitch: number; rate: number }> = {
  normal: { pitch: 1.0, rate: 1.0 },
  lazy: { pitch: 0.8, rate: 0.9 },
  kyoto: { pitch: 1.2, rate: 0.85 },
  ojousama: { pitch: 1.3, rate: 1.2 },
  gal: { pitch: 1.1, rate: 1.3 },
  sage: { pitch: 0.5, rate: 0.7 },
  student: { pitch: 1.0, rate: 1.0 },
};

/**
 * 高品質な日本語音声を優先順位で検索
 */
function findBestJapaneseVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (!voices || voices.length === 0) return null;

  const priorityPatterns = [
    /Google.*日本語/i,
    /Kyoko/i,
    /Otoya/i,
    /Microsoft.*(Ichiro|Ayumi)/i,
  ];

  for (const pattern of priorityPatterns) {
    const voice = voices.find(v => pattern.test(v.name) && v.lang.startsWith('ja'));
    if (voice) {
      return voice;
    }
  }

  const japaneseVoice = voices.find(v => v.lang.startsWith('ja'));
  return japaneseVoice || null;
}

/**
 * 発話をawaitできる関数（順番再生のため）
 */
function speakAsync(
  text: string, 
  opts?: { 
    rate?: number; 
    pitch?: number; 
    lang?: string;
    voice?: SpeechSynthesisVoice | null;
  }
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (!("speechSynthesis" in window)) {
      return reject(new Error("speechSynthesis not supported"));
    }

    const t = (text ?? "").trim();
    if (!t) return resolve();

    const utterance = new SpeechSynthesisUtterance(t);
    utterance.lang = opts?.lang ?? "ja-JP";
    if (opts?.rate) utterance.rate = opts.rate;
    if (opts?.pitch) utterance.pitch = opts.pitch;
    if (opts?.voice) utterance.voice = opts.voice;

    utterance.onend = () => {
      resolve();
    };

    utterance.onerror = (event) => {
      const errorCode = (event as SpeechSynthesisErrorEvent)?.error || 'unknown';
      console.warn('[speakAsync] Speech error:', errorCode, event);
      resolve();
    };

    window.speechSynthesis.speak(utterance);
    console.log('[speakAsync] speak() called for:', t.substring(0, 50));
  });
}

/**
 * スリープ関数
 */
function sleep(ms: number): Promise<void> {
  return new Promise<void>((r) => setTimeout(r, ms));
}

interface UseLecturePlayerOptions {
  items: LectureItem[];
  tone: CharacterTone;
  playbackRate?: number;
  repeat?: boolean;
  onItemComplete?: (itemId: number) => void;
  onComplete?: () => void;
}

export function useLecturePlayer({ 
  items, 
  tone, 
  playbackRate = 1.0, 
  repeat = false, 
  onItemComplete, 
  onComplete 
}: UseLecturePlayerOptions) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentItemId, setCurrentItemId] = useState<number | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const synthesisRef = useRef<SpeechSynthesis | null>(null);
  const bestVoiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const currentIndexRef = useRef(0);
  const isPlayingRef = useRef(false);
  const playLectureRef = useRef<((startIndex?: number) => Promise<void>) | null>(null);
  const voiceRetryCountRef = useRef(0);
  const voiceRetryTimerRef = useRef<number | null>(null);
  const playbackRateRef = useRef(playbackRate);

  // playbackRateの変更を追跡（次のアイテムから適用されるようにrefを更新）
  useEffect(() => {
    playbackRateRef.current = playbackRate;
    // 再生中でも再開せず、次のアイテムから新しい速度が適用される
  }, [playbackRate]);

  // SpeechSynthesisの初期化
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }

    synthesisRef.current = window.speechSynthesis;

    const loadVoices = () => {
      const voices = synthesisRef.current?.getVoices() || [];
      if (voices.length > 0) {
        voiceRetryCountRef.current = 0;
        if (voiceRetryTimerRef.current) {
          clearTimeout(voiceRetryTimerRef.current);
          voiceRetryTimerRef.current = null;
        }
        bestVoiceRef.current = findBestJapaneseVoice(voices) || voices[0];
        return;
      }

      if (voiceRetryCountRef.current < 5) {
        voiceRetryCountRef.current += 1;
        voiceRetryTimerRef.current = window.setTimeout(loadVoices, 400) as unknown as number;
        return;
      }

      console.warn('[useLecturePlayer] Voice list empty after retries; falling back to default voice');
      bestVoiceRef.current = null;
    };

    loadVoices();

    if (synthesisRef.current) {
      synthesisRef.current.onvoiceschanged = loadVoices;
    }

    return () => {
      if (voiceRetryTimerRef.current) {
        clearTimeout(voiceRetryTimerRef.current);
        voiceRetryTimerRef.current = null;
      }
      if (synthesisRef.current) {
        synthesisRef.current.onvoiceschanged = null;
      }
    };
  }, []);

  // 講義を順番再生する関数（for...ofで必ずawait）
  const playLecture = useCallback(async (startIndex: number = 0) => {
    if (!synthesisRef.current || !items || items.length === 0) {
      setIsPlaying(false);
      isPlayingRef.current = false;
      return;
    }

    console.log('[useLecturePlayer] Starting playLecture from index:', startIndex, 'total items:', items.length);

    // 開始インデックスから最後まで順番に再生
    for (let i = startIndex; i < items.length; i++) {
      // 再生が停止された場合は中断
      if (!isPlayingRef.current) {
        console.log('[useLecturePlayer] Playback stopped, breaking loop at index:', i);
        break;
      }

      const item = items[i];
      if (!item) {
        console.warn('[useLecturePlayer] Item at index', i, 'is null or undefined');
        continue;
      }

      // 状態を先に更新（黒板に表示されるように）
      currentIndexRef.current = i;
      setCurrentIndex(i);
      setCurrentItemId(item.id);

      console.log('[useLecturePlayer] Playing item:', item.id, item.type, 'text:', item.text, 'speechText:', item.speechText, 'displayBoard:', item.displayBoard);

      // silenceタイプの場合は待機
      if (item.type === 'silence') {
        const duration = (item.silenceSeconds ?? 2) * 1000;
        console.log('[useLecturePlayer] Silence for', duration, 'ms');
        onItemComplete?.(item.id);
        await sleep(duration);
        continue;
      }

      // テキストを取得（answer, explanationなども含む）
      const speechText = item.speechText || item.text;
      if (!speechText || speechText.trim() === '') {
        console.warn('[useLecturePlayer] No text for item:', item.id, item.type);
        onItemComplete?.(item.id);
        await sleep(150);
        continue;
      }

      // 話者タイプと設定を取得
      const speakerType: CharacterTone | 'student' = item.speaker === 'teacher' ? tone : 'student';
      const settings = VOICE_SETTINGS[speakerType];

      // speakAsyncで順番再生
      try {
        console.log('[useLecturePlayer] Calling speakAsync for item:', item.id, 'text:', speechText.substring(0, 50));
        await speakAsync(speechText, {
          rate: settings.rate * playbackRateRef.current,
          pitch: settings.pitch,
          lang: 'ja-JP',
          voice: bestVoiceRef.current,
        });
        console.log('[useLecturePlayer] Speech completed for item:', item.id);
        onItemComplete?.(item.id);
        // 行間が詰まるなら少し空ける
        await sleep(200);
      } catch (error) {
        console.error('[useLecturePlayer] Speech error for item:', item.id, error);
        onItemComplete?.(item.id);
        await sleep(200);
      }
    }

    // 全て再生完了
    if (isPlayingRef.current) {
      console.log('[useLecturePlayer] All items completed, repeat:', repeat);
      if (repeat) {
        currentIndexRef.current = 0;
        setCurrentIndex(0);
        await sleep(500);
        if (playLectureRef.current) {
          playLectureRef.current(0);
        }
      } else {
        setIsPlaying(false);
        isPlayingRef.current = false;
        setCurrentItemId(null);
        setCurrentIndex(0);
        onComplete?.();
      }
    }
  }, [items, tone, playbackRate, repeat, onItemComplete, onComplete]);

  // playLectureをrefに保存（再帰呼び出し用）
  useEffect(() => {
    playLectureRef.current = playLecture;
  }, [playLecture]);

  // 停止関数（先に定義）
  const stop = useCallback(() => {
    if (synthesisRef.current) {
      synthesisRef.current.cancel();
    }
    setIsPlaying(false);
    isPlayingRef.current = false;
    setIsPaused(false);
    setCurrentItemId(null);
    setCurrentIndex(0);
    currentIndexRef.current = 0;
  }, []);

  // 再生開始
  const play = useCallback(() => {
    console.log('[useLecturePlayer] play() called');
    
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      console.error('[useLecturePlayer] SpeechSynthesis is not available');
      return;
    }

    if (!synthesisRef.current) {
      synthesisRef.current = window.speechSynthesis;
    }

    if (!items || items.length === 0) {
      console.warn('[useLecturePlayer] No items to play');
      return;
    }

    // 既に再生中の場合は停止して再開
    if (isPlayingRef.current) {
      console.log('[useLecturePlayer] Already playing, restarting...');
      stop();
      // 状態をリセットしてから再開
      setIsPlaying(true);
      isPlayingRef.current = true;
      setIsPaused(false);
      // 直接呼び出し（ユーザーインタラクションから呼ばれているので問題ない）
      playLecture(0);
      return;
    }

    console.log('[useLecturePlayer] Starting playback, items count:', items.length);
    console.log('[useLecturePlayer] First item:', items[0]);
    
    // 音声を確実に開始するために少し遅延を入れる
    setIsPlaying(true);
    isPlayingRef.current = true;
    setIsPaused(false);
    
    // 直接呼び出し（ユーザーインタラクションから直接呼ばれているので問題ない）
    playLecture(0);
  }, [items, playLecture, stop]);


  // 一時停止
  const pause = useCallback(() => {
    if (synthesisRef.current && isPlayingRef.current) {
      synthesisRef.current.pause();
      setIsPaused(true);
    }
  }, []);

  // 再開
  const resume = useCallback(() => {
    if (synthesisRef.current && isPaused) {
      synthesisRef.current.resume();
      setIsPaused(false);
    }
  }, [isPaused]);


  return {
    isPlaying,
    isPaused,
    currentItemId,
    currentIndex,
    play,
    pause,
    resume,
    stop,
  };
}
