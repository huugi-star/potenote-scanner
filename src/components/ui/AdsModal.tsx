import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, ExternalLink, Timer, ArrowRight, MessageCircle } from 'lucide-react';
import { ASP_ADS } from '@/data/aspAds';
import type { AdType } from '@/types';

interface AdsModalProps {
  isOpen: boolean;
  onClose: () => void;
  adType: AdType;
  onRewardClaimed: (adType: AdType) => void;
  adRecommendation?: { 
    ad_id: string;
    reason: string;
  };
}

export function AdsModal({ isOpen, onClose, adType, onRewardClaimed, adRecommendation }: AdsModalProps) {
  const [canClose, setCanClose] = useState(false);
  const [countdown, setCountdown] = useState(5);

  const targetAd = ASP_ADS.find(ad => ad.id === adRecommendation?.ad_id) || ASP_ADS[0];
  const salesCopy = adRecommendation?.reason 
    || targetAd.stockMessages?.[Math.floor(Math.random() * (targetAd.stockMessages?.length || 0))] 
    || targetAd.descriptionForAI;

  useEffect(() => {
    if (isOpen) {
      setCanClose(false);
      setCountdown(5);
    }
  }, [isOpen]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isOpen && countdown > 0) {
      timer = setTimeout(() => setCountdown(c => c - 1), 1000);
    } else if (countdown === 0) {
      setCanClose(true);
    }
    return () => clearTimeout(timer);
  }, [isOpen, countdown]);

  const handleClickAd = () => {
    onRewardClaimed(adType);
    onClose();
  };

  const handleSkip = () => {
    if (!canClose) return;
    onRewardClaimed(adType);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-md bg-slate-900 border border-indigo-500/30 rounded-2xl overflow-hidden shadow-2xl relative"
      >
        <div className="bg-gradient-to-r from-indigo-900 to-slate-900 p-4 flex items-center gap-3 border-b border-indigo-500/20">
          <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center border border-indigo-400/50 relative">
            <Sparkles className="w-5 h-5 text-indigo-300" />
            <div className="absolute -bottom-1 -right-1 bg-emerald-500 rounded-full p-0.5 border-2 border-slate-900">
              <MessageCircle className="w-3 h-3 text-white" />
            </div>
          </div>
          <div>
            <div className="text-[10px] font-bold text-indigo-300 tracking-wider uppercase">AI Learning Advisor</div>
            <div className="text-white font-bold text-sm">学習アドバイス</div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="relative bg-slate-800/50 p-4 rounded-xl border border-slate-700">
            <p className="text-base text-white font-medium leading-relaxed">
              「{salesCopy}」
            </p>
            <div className="absolute -bottom-2 left-6 w-4 h-4 bg-slate-800 border-b border-r border-slate-700 transform rotate-45"></div>
      </div>

          <a
            href={targetAd.url || targetAd.affiliateUrl || '#'}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleClickAd}
            className="block group relative overflow-hidden rounded-xl border border-slate-600 hover:border-indigo-400 transition-all shadow-lg"
          >
            {/* ★修正ポイント: どんなサイズの画像でも綺麗に見せるレイアウト
              aspect-video (16:9) の枠の中に、object-contain で画像を収め、
              背景にはその画像をぼかして敷き詰める。
            */}
            <div className="aspect-video w-full bg-slate-800 relative overflow-hidden">
              {targetAd.imageUrl ? (
                <>
                  {/* 背景（ぼかし） */}
                  <div 
                    className="absolute inset-0 bg-cover bg-center opacity-50 blur-xl scale-110"
                    style={{ backgroundImage: `url(${targetAd.imageUrl})` }}
                  />
                  {/* メイン画像（全体表示） */}
                  <img 
                    src={targetAd.imageUrl} 
                    alt={targetAd.name} 
                    className="relative w-full h-full object-contain z-10 transition-transform duration-500 group-hover:scale-105" 
                  />
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-500">No Image</div>
              )}
              
              <div className="absolute inset-0 flex items-center justify-center bg-black/10 group-hover:bg-black/30 transition-colors z-20">
                <span className="bg-white/90 text-indigo-900 px-6 py-2 rounded-full font-bold text-sm flex items-center gap-2 shadow-lg transform translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                  詳細を見る <ExternalLink className="w-4 h-4" />
                </span>
              </div>
            </div>

            <div className="bg-slate-800 p-3 flex justify-between items-center relative z-20">
              <span className="text-xs text-slate-400">Sponsored</span>
              <span className="text-xs font-bold text-white truncate max-w-[200px]">{targetAd.name}</span>
            </div>
          </a>

          <div className="space-y-3 pt-2">
                <button
              onClick={handleSkip}
              disabled={!canClose}
              className={`w-full py-3 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                canClose
                  ? 'bg-slate-800 text-white hover:bg-slate-700 border border-slate-600'
                  : 'bg-slate-800/50 text-slate-500 cursor-not-allowed'
              }`}
            >
              {canClose ? (
                <>
                  アドバイスを閉じて回復 <ArrowRight className="w-4 h-4" />
                </>
              ) : (
                <>
                  <Timer className="w-4 h-4 animate-spin" />
                  メッセージを確認中... ({countdown})
                </>
              )}
                </button>
          </div>
            </div>
          </motion.div>
    </div>
  );
}

export default AdsModal;
