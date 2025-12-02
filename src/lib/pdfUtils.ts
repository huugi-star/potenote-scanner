/**
 * pdfUtils.ts
 * 
 * クイズをPDF化するユーティリティ
 * 学習プリント形式（1ページ8問固定、RPGクエスト風デザイン）
 * html2canvasを使用して日本語フォントを正しく表示
 */

import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import type { QuizHistory } from '@/types';

/**
 * 問題文にインライン表示が必要なキーワードが含まれているか判定
 */
function needsInlineOptions(questionText: string): boolean {
  const inlineKeywords = [
    'ないもの',
    '誤っている',
    'どれか',
    '選べ',
    'NOT',
    '不適切',
    '該当しない',
    '含まれない',
    '当てはまらない',
    '正しくない',
    '間違っている',
    '誤り',
    '除外',
    '除く',
    '〜でない',
    '〜ではない',
  ];
  
  const normalizedText = questionText.toLowerCase();
  return inlineKeywords.some(keyword => normalizedText.includes(keyword.toLowerCase()));
}

/**
 * スコア計算ロジック
 * 問題数に応じて満点と配点を決定
 */
function calculateScore(qCount: number): { totalScore: number; pointsPerQ: number } {
  // 100点満点で割り切れる場合
  if (100 % qCount === 0) {
    return {
      totalScore: 100,
      pointsPerQ: 100 / qCount,
    };
  }
  
  // 割り切れない場合
  if (qCount >= 30) {
    // 問題数が多すぎる場合: 5点固定
    return {
      totalScore: qCount * 5,
      pointsPerQ: 5,
    };
  } else {
    // それ以外: 10点固定
    return {
      totalScore: qCount * 10,
      pointsPerQ: 10,
    };
  }
}

/**
 * 複数のクイズ履歴をPDF化
 * 1ページ8問固定のページネーション + RPGクエスト風デザイン
 */
export async function generateQuizPDF(histories: QuizHistory[]): Promise<void> {
  if (histories.length === 0) {
    throw new Error('クイズ履歴がありません');
  }

  // すべての問題を統合（インライン表示かどうかの判定も含む）
  const allQuestions: Array<{ 
    question: QuizHistory['quiz']['questions'][0]; 
    quizIndex: number; 
    questionIndex: number;
    needsInline: boolean;
  }> = [];
  
  histories.forEach((history, quizIndex) => {
    history.quiz.questions.forEach((question, questionIndex) => {
      allQuestions.push({ 
        question, 
        quizIndex, 
        questionIndex,
        needsInline: needsInlineOptions(question.q),
      });
    });
  });

  const QUESTIONS_PER_PAGE = 8; // 1ページあたりの問題数（固定）
  
  // 8問ずつのチャンクに分割
  const pages: Array<typeof allQuestions> = [];
  for (let i = 0; i < allQuestions.length; i += QUESTIONS_PER_PAGE) {
    pages.push(allQuestions.slice(i, i + QUESTIONS_PER_PAGE));
  }
  
  // 全体の問題数からスコアを計算
  const totalQuestionCount = allQuestions.length;
  const { totalScore, pointsPerQ } = calculateScore(totalQuestionCount);
  
  // カテゴリ名を取得（キーワードのみを使用）
  const categoryName = histories[0]?.quiz.keywords?.[0] || histories[0]?.quiz.keywords?.[1] || histories[0]?.quiz.keywords?.[2] || '学習クエスト';
  
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });
  
  // 各ページを生成
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
    if (pageIndex > 0) {
      pdf.addPage();
    }
    
    const pageQuestions = pages[pageIndex];
    const startQuestionNumber = pageIndex * QUESTIONS_PER_PAGE + 1;
    const endQuestionNumber = startQuestionNumber + pageQuestions.length - 1;
    
    // HTML要素を作成
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.width = '210mm'; // A4幅
    container.style.padding = '15mm';
    container.style.fontFamily = 'sans-serif';
    container.style.backgroundColor = '#ffffff';
    container.style.color = '#000000';
    container.style.fontSize = '12px';
    container.style.lineHeight = '1.6';
    container.style.height = '297mm'; // A4高さ（固定）
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.boxSizing = 'border-box';
    
    // コンテンツを作成
    let html = `
      <!-- ヘッダーエリア（RPGクエスト風、コンパクト） -->
      <div style="flex: 0 0 auto; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 2px solid #333;">
        <!-- メインタイトル -->
        <div style="font-size: 18px; font-weight: bold; margin-bottom: ${pageIndex === 0 ? '6px' : '0'}; color: #1a1a1a; text-align: center;">
          QUEST ${categoryName}
        </div>
        ${pageIndex === 0 ? `
        <!-- スコア欄（1ページ目のみ） -->
        <div style="display: flex; justify-content: center; align-items: center; gap: 12px; font-size: 13px; font-weight: bold;">
          <span style="color: #666;">SCORE:</span>
          <span style="padding: 2px 30px; min-width: 60px; text-align: center;">
            
          </span>
          <span style="color: #333;">/ ${totalScore}</span>
          <span style="font-size: 11px; color: #666; font-weight: normal; margin-left: 12px;">
            (1問${pointsPerQ}点)
          </span>
        </div>
        ` : ''}
      </div>
      
      <!-- メインコンテンツエリア（問題文と解答を並列配置） -->
      <div style="flex: 1; display: flex; gap: 10px; min-height: 0; margin-bottom: 0;">
        <!-- 左カラム: 問題文（65%） -->
        <div style="flex: 0 0 65%; display: flex; flex-direction: column; overflow: visible;">
          <div style="font-size: 13px; font-weight: bold; margin-bottom: 6px; color: #333; flex: 0 0 auto;">
            【問題】問${startQuestionNumber}〜問${endQuestionNumber}
          </div>
          <div style="flex: 1; line-height: 1.6; font-size: 11px; display: flex; flex-direction: column; justify-content: flex-start; margin-bottom: 0; padding-bottom: 0;">
            ${pageQuestions.map((item, localIndex) => {
              const globalIndex = startQuestionNumber + localIndex - 1;
              const isLast = localIndex === pageQuestions.length - 1;
              let questionHtml = `
                <div style="margin-bottom: ${isLast ? '0' : (item.needsInline ? '18px' : '14px')}; padding-bottom: ${isLast ? '0' : (item.needsInline ? '8px' : '4px')};">
                  <span style="font-weight: bold; color: #333;">（${globalIndex + 1}）</span> ${item.question.q}
                </div>
              `;
              
              // インライン表示が必要な場合は、問題文の下に選択肢を横一列で表示
              if (item.needsInline) {
                questionHtml += `
                  <div style="margin-left: 18px; margin-bottom: ${isLast ? '0' : '8px'}; font-size: 9px; line-height: 1.5;">
                    <div style="display: flex; flex-wrap: wrap; gap: 6px 10px;">
                      ${item.question.options.map((option, optIndex) => 
                        `<span style="white-space: nowrap;">
                          <span style="font-weight: bold;">${String.fromCharCode(65 + optIndex)}.</span> ${option}
                        </span>`
                      ).join('')}
                    </div>
                  </div>
                `;
              }
              
              return questionHtml;
            }).join('')}
          </div>
        </div>
        
        <!-- 右カラム: 解答欄（35%、折り曲げ用） -->
        <div style="flex: 0 0 35%; border-left: 2px dotted #999; padding-left: 8px; display: flex; flex-direction: column; overflow: visible;">
          <div style="font-size: 13px; font-weight: bold; margin-bottom: 6px; color: #333; text-align: center; flex: 0 0 auto;">
            【解答】
          </div>
          <div style="flex: 1; font-size: 10px; line-height: 1.6; display: flex; flex-direction: column; justify-content: flex-start; margin-bottom: 0; padding-bottom: 0;">
            ${pageQuestions.map((item, localIndex) => {
              const globalIndex = startQuestionNumber + localIndex - 1;
              const isLast = localIndex === pageQuestions.length - 1;
              const correctAnswer = item.question.options[item.question.a];
              return `
                <div style="margin-bottom: ${isLast ? '0' : (item.needsInline ? '18px' : '14px')}; padding: ${isLast ? '4px 4px 0 4px' : '4px'}; background-color: #f5f5f5; border-radius: 3px; border: 1px solid #e0e0e0;">
                  <div style="font-weight: bold; margin-bottom: 2px; font-size: 9px; color: #666;">問${globalIndex + 1}</div>
                  <div style="color: #0066cc; font-weight: bold; font-size: 10px;">
                    ${String.fromCharCode(65 + item.question.a)}. ${correctAnswer}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
      
      <!-- フッターエリア（固定高さ、固定グリッドシステム、選択肢の高さを拡大） -->
      <div style="flex: 0 0 auto; margin-top: 8px; padding-top: 10px; border-top: 2px solid #333; min-height: 70mm;">
        <div style="font-size: 13px; font-weight: bold; margin-bottom: 6px; color: #333;">
          【選択肢】問${startQuestionNumber}〜問${endQuestionNumber}
        </div>
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); grid-template-rows: repeat(4, 1fr); gap: 6px 10px; font-size: 8px; line-height: 1.4; height: 100%;">
          ${pageQuestions.map((item, localIndex) => {
            const globalIndex = startQuestionNumber + localIndex - 1;
            
            // インライン表示の問題は空白セルにする
            if (item.needsInline) {
              return `<div style="background-color: #fafafa; border: 1px dashed #ddd; border-radius: 2px;"></div>`;
            }
            
            // フッター表示の問題のみ選択肢を表示
            return `
              <div style="padding: 6px 5px; background-color: #f9f9f9; border-radius: 3px; border: 1px solid #ddd; overflow: visible; display: flex; flex-direction: column; min-height: 0;">
                <div style="font-weight: bold; margin-bottom: 3px; color: #333; font-size: 8px; flex: 0 0 auto;">[問${globalIndex + 1}]</div>
                <div style="flex: 1; display: flex; flex-direction: column; gap: 2px; overflow: visible;">
                  ${item.question.options.map((option, optIndex) => 
                    `<div style="white-space: normal; overflow: visible; font-size: 7.5px; line-height: 1.3;">
                      <span style="font-weight: bold;">${String.fromCharCode(65 + optIndex)}.</span> ${option}
                    </div>`
                  ).join('')}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
    
    container.innerHTML = html;
    document.body.appendChild(container);
    
    try {
      // html2canvasでキャンバスに変換
      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: container.scrollWidth,
        height: container.scrollHeight,
      });
      
      const imgData = canvas.toDataURL('image/png');
      const imgWidth = 210; // A4幅（mm）
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      // PDFに画像を追加
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
    } catch (error) {
      console.error('PDF generation error:', error);
      throw error;
    } finally {
      // 一時要素を削除
      document.body.removeChild(container);
    }
  }
  
  // PDFをダウンロード
  const safeFileName = histories.length === 1
    ? histories[0].quiz.summary.substring(0, 20).replace(/[^\w\s-]/g, '').trim()
    : `複数クイズ_${histories.length}件`;
  const fileName = `クイズ_${safeFileName || '問題'}_${new Date().toISOString().split('T')[0]}.pdf`;
  pdf.save(fileName);
}
