/**
 * pdfUtils.ts
 * 
 * クイズをPDF化するユーティリティ
 * 学習プリント形式（Active Recall法：選択肢・分離レイアウト + ハイブリッド表示）
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
 * 複数のクイズ履歴をPDF化
 * Active Recall法：選択肢・分離レイアウト + ハイブリッド表示
 * - デフォルト: 選択肢はページ下部にまとめて表示
 * - 例外: 特定キーワードを含む問題は、問題文の下にインライン表示
 * - 右端（縦一列）: 解答欄
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

  const maxHeightPerPage = 250; // 1ページあたりの最大高さ（mm、余裕を持たせる）
  
  // ページごとに問題を分割（問題文と選択肢が同じページに収まるように）
  const pages: Array<{ questions: typeof allQuestions; startIndex: number; endIndex: number }> = [];
  let currentPageQuestions: typeof allQuestions = [];
  let estimatedHeight = 0;
  let startIndex = 0;
  
  allQuestions.forEach((item, index) => {
    const question = item.question;
    // 問題文の高さを推定
    const questionHeight = Math.max(question.q.length / 30 * 4, 12);
    // 選択肢の高さ（インライン表示の場合は問題文の下に配置されるため、高さに含める）
    const optionsHeight = item.needsInline ? 12 : 0; // フッター表示の場合は後でまとめて計算
    // 合計高さ
    const totalHeight = questionHeight + optionsHeight + 15; // 15mmはマージン
    
    if (estimatedHeight + totalHeight > maxHeightPerPage && currentPageQuestions.length > 0) {
      // 現在のページを保存して新しいページを開始
      pages.push({
        questions: currentPageQuestions,
        startIndex,
        endIndex: index - 1,
      });
      currentPageQuestions = [item];
      estimatedHeight = totalHeight;
      startIndex = index;
    } else {
      currentPageQuestions.push(item);
      estimatedHeight += totalHeight;
    }
  });
  
  // 最後のページを追加
  if (currentPageQuestions.length > 0) {
    pages.push({
      questions: currentPageQuestions,
      startIndex,
      endIndex: allQuestions.length - 1,
    });
  }
  
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
    
    const pageData = pages[pageIndex];
    
    // フッター表示の問題を抽出（選択肢セクション用）
    const footerQuestions = pageData.questions.filter(q => !q.needsInline);
    
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
    
    // コンテンツを作成
    let html = '';
    
    if (pageIndex === 0) {
      // 最初のページのみタイトルとサマリーを表示
      const summaries = histories.map(h => h.quiz.summary).join(' / ');
      html += `
        <div style="text-align: center; font-size: 20px; font-weight: bold; margin-bottom: 20px;">
          学習プリント
        </div>
        <div style="margin-bottom: 25px; font-size: 11px; color: #666; padding-bottom: 15px; border-bottom: 1px solid #ddd;">
          ${summaries}
        </div>
      `;
    }
    
    html += `
      <div style="display: flex; gap: 15px;">
        <!-- メインコンテンツエリア（左側） -->
        <div style="flex: 1;">
          <!-- 上部: 問題文リスト -->
          <div style="margin-bottom: 30px;">
            <div style="font-size: 14px; font-weight: bold; margin-bottom: 15px; color: #333;">
              【問題】
            </div>
            <div style="line-height: 2.2;">
              ${pageData.questions.map((item, localIndex) => {
                const globalIndex = pageData.startIndex + localIndex;
                let questionHtml = `
                  <div style="margin-bottom: ${item.needsInline ? '20px' : '12px'}; font-size: 11px;">
                    <span style="font-weight: bold;">（${globalIndex + 1}）</span> ${item.question.q}
                  </div>
                `;
                
                // インライン表示が必要な場合は、問題文の下に選択肢を表示
                if (item.needsInline) {
                  questionHtml += `
                    <div style="margin-left: 20px; margin-bottom: 15px; font-size: 10px; line-height: 1.8;">
                      ${item.question.options.map((option, optIndex) => 
                        `<div style="margin-bottom: 5px;">
                          <span style="font-weight: bold;">${String.fromCharCode(65 + optIndex)}.</span> ${option}
                        </div>`
                      ).join('')}
                    </div>
                  `;
                }
                
                return questionHtml;
              }).join('')}
            </div>
          </div>
          
          <!-- 下部: 選択肢の塊（フッター表示の問題のみ） -->
          ${footerQuestions.length > 0 ? `
            <div style="margin-top: 40px; padding-top: 20px; border-top: 2px solid #333;">
              <div style="font-size: 14px; font-weight: bold; margin-bottom: 15px; color: #333;">
                【選択肢】
              </div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px 20px; font-size: 10px; line-height: 1.8;">
                ${footerQuestions.map((item) => 
                  item.question.options.map((option, optIndex) => 
                    `<div style="padding: 5px 0;">
                      <span style="font-weight: bold;">${String.fromCharCode(65 + optIndex)}.</span> ${option}
                    </div>`
                  ).join('')
                ).join('')}
              </div>
            </div>
          ` : ''}
        </div>
        
        <!-- 右端: 解答欄（縦一列） -->
        <div style="width: 40mm; border-left: 2px dotted #999; padding-left: 10px;">
          <div style="font-size: 14px; font-weight: bold; margin-bottom: 15px; color: #333; text-align: center;">
            【解答】
          </div>
          <div style="font-size: 11px; line-height: 2.5;">
            ${pageData.questions.map((item, localIndex) => {
              const globalIndex = pageData.startIndex + localIndex;
              const correctAnswer = item.question.options[item.question.a];
              return `
                <div style="margin-bottom: 15px; padding: 8px; background-color: #f5f5f5; border-radius: 4px;">
                  <div style="font-weight: bold; margin-bottom: 5px;">問${globalIndex + 1}</div>
                  <div style="color: #0066cc; font-weight: bold;">
                    ${String.fromCharCode(65 + item.question.a)}. ${correctAnswer}
                  </div>
                  <div style="font-size: 9px; color: #666; margin-top: 5px; line-height: 1.5;">
                    ${item.question.explanation}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
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
