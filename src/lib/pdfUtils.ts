/**
 * pdfUtils.ts
 * 
 * クイズをPDF化するユーティリティ
 * 学習プリント形式（1ページ10問固定、ハイブリッド表示対応）
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
 * 1ページ10問固定のページネーション
 * - ヘッダー: タイトル、日付
 * - メインエリア（左65-70%）: 問題文リスト（ハイブリッド表示対応）
 * - 右サイドバー（右30-35%）: 正解のみ表示（折り曲げ用）
 * - フッター: そのページの10問の選択肢のみ
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

  const QUESTIONS_PER_PAGE = 10; // 1ページあたりの問題数（固定）
  
  // 10問ずつのチャンクに分割
  const pages: Array<typeof allQuestions> = [];
  for (let i = 0; i < allQuestions.length; i += QUESTIONS_PER_PAGE) {
    pages.push(allQuestions.slice(i, i + QUESTIONS_PER_PAGE));
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
    
    const pageQuestions = pages[pageIndex];
    const startQuestionNumber = pageIndex * QUESTIONS_PER_PAGE + 1;
    const endQuestionNumber = startQuestionNumber + pageQuestions.length - 1;
    
    // フッター表示が必要な問題（インライン表示でない問題）
    const footerQuestions = pageQuestions.filter(q => !q.needsInline);
    
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
    
    // 現在の日付を取得
    const today = new Date();
    const dateString = today.toLocaleDateString('ja-JP', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    
    // コンテンツを作成
    let html = `
      <!-- ヘッダーエリア -->
      <div style="text-align: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #333;">
        <div style="font-size: 20px; font-weight: bold; margin-bottom: 8px;">
          学習プリント
        </div>
        <div style="font-size: 11px; color: #666; margin-bottom: 10px;">
          ${dateString}
        </div>
        <div style="font-size: 10px; color: #999; display: flex; justify-content: space-between; max-width: 300px; margin: 0 auto;">
          <span>名前: _______________</span>
          <span>学習日: _______________</span>
        </div>
      </div>
      
      <!-- メインコンテンツエリア -->
      <div style="display: flex; gap: 15px; margin-bottom: 20px;">
        <!-- 左カラム: 問題文（65-70%） -->
        <div style="flex: 0 0 70%;">
          <div style="font-size: 14px; font-weight: bold; margin-bottom: 15px; color: #333;">
            【問題】問${startQuestionNumber}〜問${endQuestionNumber}
          </div>
          <div style="line-height: 2.0;">
            ${pageQuestions.map((item, localIndex) => {
              const globalIndex = startQuestionNumber + localIndex - 1;
              let questionHtml = `
                <div style="margin-bottom: ${item.needsInline ? '20px' : '15px'}; font-size: 11px;">
                  <span style="font-weight: bold;">（${globalIndex + 1}）</span> ${item.question.q}
                </div>
              `;
              
              // インライン表示が必要な場合は、問題文の下に選択肢を表示
              if (item.needsInline) {
                questionHtml += `
                  <div style="margin-left: 20px; margin-bottom: 15px; font-size: 10px;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px 15px;">
                      ${item.question.options.map((option, optIndex) => 
                        `<div style="padding: 4px 0;">
                          <span style="font-weight: bold;">${String.fromCharCode(65 + optIndex)}.</span> ${option}
                        </div>`
                      ).join('')}
                    </div>
                  </div>
                `;
              }
              
              return questionHtml;
            }).join('')}
          </div>
        </div>
        
        <!-- 右カラム: 解答欄（30-35%） -->
        <div style="flex: 0 0 30%; border-left: 2px dotted #999; padding-left: 10px;">
          <div style="font-size: 14px; font-weight: bold; margin-bottom: 15px; color: #333; text-align: center;">
            【解答】
          </div>
          <div style="font-size: 11px; line-height: 2.0;">
            ${pageQuestions.map((item, localIndex) => {
              const globalIndex = startQuestionNumber + localIndex - 1;
              const correctAnswer = item.question.options[item.question.a];
              return `
                <div style="margin-bottom: 15px; padding: 6px; background-color: #f5f5f5; border-radius: 4px;">
                  <div style="font-weight: bold; margin-bottom: 3px; font-size: 10px;">問${globalIndex + 1}</div>
                  <div style="color: #0066cc; font-weight: bold; font-size: 11px;">
                    ${String.fromCharCode(65 + item.question.a)}. ${correctAnswer}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
      
      <!-- フッターエリア: 選択肢群（そのページのフッター表示問題のみ） -->
      ${footerQuestions.length > 0 ? `
        <div style="margin-top: 30px; padding-top: 15px; border-top: 2px solid #333;">
          <div style="font-size: 14px; font-weight: bold; margin-bottom: 12px; color: #333;">
            【選択肢】問${startQuestionNumber}〜問${endQuestionNumber}
          </div>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px 20px; font-size: 10px; line-height: 1.8;">
            ${footerQuestions.map((item) => {
              const globalIndex = startQuestionNumber + pageQuestions.findIndex(q => q === item);
              return `
                <div style="padding: 8px; background-color: #f9f9f9; border-radius: 4px; border: 1px solid #ddd;">
                  <div style="font-weight: bold; margin-bottom: 5px; color: #333;">[問${globalIndex + 1}]</div>
                  ${item.question.options.map((option, optIndex) => 
                    `<div style="padding: 2px 0;">
                      <span style="font-weight: bold;">${String.fromCharCode(65 + optIndex)}.</span> ${option}
                    </div>`
                  ).join('')}
                </div>
              `;
            }).join('')}
          </div>
        </div>
      ` : ''}
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
