/**
 * pdfUtils.ts
 * 
 * クイズをPDF化するユーティリティ
 * 学習プリント形式（1ページ最大15問、高密度レイアウト + 動的余白調整）
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
 * 問題の高さを推定（高密度モード）
 */
function estimateQuestionHeight(question: QuizHistory['quiz']['questions'][0], needsInline: boolean): number {
  // 問題文の高さを推定（1文字あたり約0.25mm、行間1.15）
  const questionTextHeight = Math.max(question.q.length / 40 * 3, 6);
  // インライン選択肢の高さ
  const optionsHeight = needsInline ? 5 : 0;
  // 合計高さ（最小マージン含む）
  return questionTextHeight + optionsHeight;
}

/**
 * 複数のクイズ履歴をPDF化
 * 1ページ最大15問の高密度レイアウト + 動的余白調整
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

  const QUESTIONS_PER_PAGE = 15; // 1ページあたりの問題数（最大）
  
  // 15問ずつのチャンクに分割（自動改ページ判定付き）
  const pages: Array<typeof allQuestions> = [];
  let currentPageQuestions: typeof allQuestions = [];
  let estimatedHeight = 0;
  const maxHeightBeforeFooter = 200; // フッター開始位置までの最大高さ（mm）
  
  for (let i = 0; i < allQuestions.length; i++) {
    const item = allQuestions[i];
    const question = item.question;
    
    // 問題文の高さを推定（高密度モード）
    const questionHeight = estimateQuestionHeight(question, item.needsInline);
    const totalHeight = questionHeight + 3; // マージン3mm
    
    // 自動改ページ判定: 15問に達していなくても、高さが上限を超えたら改ページ
    if ((estimatedHeight + totalHeight > maxHeightBeforeFooter || currentPageQuestions.length >= QUESTIONS_PER_PAGE) && currentPageQuestions.length > 0) {
      pages.push([...currentPageQuestions]);
      currentPageQuestions = [item];
      estimatedHeight = totalHeight;
    } else {
      currentPageQuestions.push(item);
      estimatedHeight += totalHeight;
    }
  }
  
  // 最後のページを追加
  if (currentPageQuestions.length > 0) {
    pages.push(currentPageQuestions);
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
  
  // ページサイズ定義
  const PAGE_HEIGHT = 297; // A4高さ（mm）
  const HEADER_HEIGHT = 30; // ヘッダー高さ（mm）
  const FOOTER_HEIGHT = 55; // フッター高さ（mm）
  const MAIN_AREA_HEIGHT = PAGE_HEIGHT - HEADER_HEIGHT - FOOTER_HEIGHT; // メインエリア高さ
  
  // 各ページを生成
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
    if (pageIndex > 0) {
      pdf.addPage();
    }
    
    const pageQuestions = pages[pageIndex];
    const startQuestionNumber = pageIndex === 0 
      ? 1 
      : pages.slice(0, pageIndex).reduce((sum, p) => sum + p.length, 0) + 1;
    const endQuestionNumber = startQuestionNumber + pageQuestions.length - 1;
    
    // 動的マージンの計算
    // ステップ1: 全問題のテキスト高さを仮計算（余白ゼロ）
    let totalTextHeight = 0;
    pageQuestions.forEach(item => {
      totalTextHeight += estimateQuestionHeight(item.question, item.needsInline);
    });
    
    // ステップ2: 残りのスペースを計算
    const remainingSpace = MAIN_AREA_HEIGHT - totalTextHeight;
    
    // ステップ3: 問題間のギャップを算出
    const questionCount = pageQuestions.length;
    let dynamicGap = questionCount > 1 ? remainingSpace / (questionCount - 1) : 0;
    
    // 安全策: 最大15mmでキャップ
    dynamicGap = Math.min(dynamicGap, 15);
    // 最小値も設定（読みやすさのため）
    dynamicGap = Math.max(dynamicGap, 2);
    
    // HTML要素を作成
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.width = '210mm'; // A4幅
    container.style.padding = '12mm'; // パディングを少し小さく
    container.style.fontFamily = 'sans-serif';
    container.style.backgroundColor = '#ffffff';
    container.style.color = '#000000';
    container.style.fontSize = '9px'; // ベースフォントサイズを小さく
    container.style.lineHeight = '1.15'; // 行間を詰める
    container.style.height = '297mm'; // A4高さ（固定）
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.boxSizing = 'border-box';
    
    // コンテンツを作成
    let html = `
      <!-- ヘッダーエリア（RPGクエスト風、コンパクト） -->
      <div style="flex: 0 0 auto; margin-bottom: 6px; padding-bottom: 4px; border-bottom: 2px solid #333;">
        <!-- メインタイトル -->
        <div style="font-size: 16px; font-weight: bold; margin-bottom: ${pageIndex === 0 ? '4px' : '0'}; color: #1a1a1a; text-align: center;">
          QUEST ${categoryName}
        </div>
        ${pageIndex === 0 ? `
        <!-- スコア欄（1ページ目のみ） -->
        <div style="display: flex; justify-content: center; align-items: center; gap: 10px; font-size: 11px; font-weight: bold;">
          <span style="color: #666;">SCORE:</span>
          <span style="padding: 2px 25px; min-width: 50px; text-align: center;">
            
          </span>
          <span style="color: #333;">/ ${totalScore}</span>
          <span style="font-size: 9px; color: #666; font-weight: normal; margin-left: 10px;">
            (1問${pointsPerQ}点)
          </span>
        </div>
        ` : ''}
      </div>
      
      <!-- メインコンテンツエリア（問題文と解答を並列配置、動的余白） -->
      <div style="flex: 1; display: flex; gap: 8px; min-height: 0; margin-bottom: 6px;">
        <!-- 左カラム: 問題文（65%） -->
        <div style="flex: 0 0 65%; display: flex; flex-direction: column; overflow: visible;">
          <div style="font-size: 11px; font-weight: bold; margin-bottom: 4px; color: #333; flex: 0 0 auto;">
            【問題】問${startQuestionNumber}〜問${endQuestionNumber}
          </div>
          <div style="flex: 1; line-height: 1.15; font-size: 9px;">
            ${pageQuestions.map((item, localIndex) => {
              const globalIndex = startQuestionNumber + localIndex - 1;
              const isLast = localIndex === pageQuestions.length - 1;
              const marginBottom = isLast ? '0' : `${dynamicGap}px`;
              let questionHtml = `
                <div style="margin-bottom: ${marginBottom}; padding-bottom: ${item.needsInline ? '3px' : '1px'};">
                  <span style="font-weight: bold; color: #333;">（${globalIndex + 1}）</span> ${item.question.q}
                </div>
              `;
              
              // インライン表示が必要な場合は、問題文の下に選択肢を横一列で表示
              if (item.needsInline) {
                questionHtml += `
                  <div style="margin-left: 15px; margin-bottom: ${isLast ? '0' : '2px'}; font-size: 8px; line-height: 1.2;">
                    <div style="display: flex; flex-wrap: wrap; gap: 4px 8px;">
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
        <div style="flex: 0 0 35%; border-left: 2px dotted #999; padding-left: 6px; display: flex; flex-direction: column; overflow: visible;">
          <div style="font-size: 11px; font-weight: bold; margin-bottom: 4px; color: #333; text-align: center; flex: 0 0 auto;">
            【解答】
          </div>
          <div style="flex: 1; font-size: 9px; line-height: 1.15;">
            ${pageQuestions.map((item, localIndex) => {
              const globalIndex = startQuestionNumber + localIndex - 1;
              const isLast = localIndex === pageQuestions.length - 1;
              const marginBottom = isLast ? '0' : `${dynamicGap}px`;
              const correctAnswer = item.question.options[item.question.a];
              return `
                <div style="margin-bottom: ${marginBottom}; padding: 3px; background-color: #f5f5f5; border-radius: 2px; border: 1px solid #e0e0e0;">
                  <div style="font-weight: bold; margin-bottom: 1px; font-size: 8px; color: #666;">問${globalIndex + 1}</div>
                  <div style="color: #0066cc; font-weight: bold; font-size: 9px;">
                    ${String.fromCharCode(65 + item.question.a)}. ${correctAnswer}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
      
      <!-- フッターエリア（固定高さ、4列×4行グリッド） -->
      <div style="flex: 0 0 auto; margin-top: 4px; padding-top: 6px; border-top: 2px solid #333; min-height: 50mm;">
        <div style="font-size: 11px; font-weight: bold; margin-bottom: 4px; color: #333;">
          【選択肢】問${startQuestionNumber}〜問${endQuestionNumber}
        </div>
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); grid-template-rows: repeat(4, 1fr); gap: 3px 6px; font-size: 7px; line-height: 1.2; height: 100%;">
          ${pageQuestions.map((item, localIndex) => {
            const globalIndex = startQuestionNumber + localIndex - 1;
            
            // インライン表示の問題は空白セルにする
            if (item.needsInline) {
              return `<div style="background-color: #fafafa; border: 1px dashed #ddd; border-radius: 2px;"></div>`;
            }
            
            // フッター表示の問題のみ選択肢を表示
            return `
              <div style="padding: 3px; background-color: #f9f9f9; border-radius: 2px; border: 1px solid #ddd; overflow: hidden; display: flex; flex-direction: column; min-height: 0;">
                <div style="font-weight: bold; margin-bottom: 1px; color: #333; font-size: 7px; flex: 0 0 auto;">[問${globalIndex + 1}]</div>
                <div style="flex: 1; display: flex; flex-direction: column; gap: 1px; overflow: visible;">
                  ${item.question.options.map((option, optIndex) => 
                    `<div style="white-space: normal; overflow: visible; font-size: 6.5px; line-height: 1.15; word-break: break-word;">
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
