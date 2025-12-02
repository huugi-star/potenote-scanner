/**
 * pdfUtils.ts
 * 
 * クイズをPDF化するユーティリティ
 * 学習プリント形式（2カラム構成、折り目付き）
 * html2canvasを使用して日本語フォントを正しく表示
 */

import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import type { QuizHistory } from '@/types';

/**
 * クイズ履歴をPDF化
 * 2カラム構成（左75%：問題、右25%：正解と解説）
 * 折り目の点線付き
 */
export async function generateQuizPDF(history: QuizHistory): Promise<void> {
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
  let html = `
    <div style="text-align: center; font-size: 20px; font-weight: bold; margin-bottom: 15px;">
      学習プリント
    </div>
    <div style="margin-bottom: 20px; font-size: 11px; color: #666;">
      ${history.quiz.summary}
    </div>
  `;
  
  // 問題を1問ずつ処理
  history.quiz.questions.forEach((question, index) => {
    const questionHtml = `
      <div style="margin-bottom: 20px; border-bottom: 1px solid #ddd; padding-bottom: 15px;">
        <div style="display: flex;">
          <!-- 左カラム：問題（75%） -->
          <div style="width: 75%; padding-right: 10px; border-right: 2px dotted #999;">
            <div style="font-size: 14px; font-weight: bold; margin-bottom: 8px;">
              問${index + 1}
            </div>
            <div style="font-size: 11px; margin-bottom: 10px; line-height: 1.8;">
              ${question.q}
            </div>
            <div style="font-size: 10px; line-height: 1.8;">
              ${question.options.map((option, optIndex) => 
                `<div style="margin-bottom: 5px;">${String.fromCharCode(65 + optIndex)}. ${option}</div>`
              ).join('')}
            </div>
          </div>
          
          <!-- 右カラム：正解と解説（25%） -->
          <div style="width: 25%; padding-left: 10px;">
            <div style="font-size: 14px; font-weight: bold; margin-bottom: 8px;">
              答${index + 1}
            </div>
            <div style="font-size: 11px; font-weight: bold; margin-bottom: 8px; color: #0066cc;">
              正解: ${String.fromCharCode(65 + question.a)}. ${question.options[question.a]}
            </div>
            <div style="font-size: 9px; line-height: 1.6; color: #333;">
              ${question.explanation}
            </div>
          </div>
        </div>
      </div>
    `;
    html += questionHtml;
  });
  
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
    const pageHeight = 297; // A4高さ（mm）
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });
    
    let heightLeft = imgHeight;
    let position = 0;
    
    // 最初のページを追加
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
    
    // 複数ページに対応
    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }
    
    // PDFをダウンロード
    const safeFileName = history.quiz.summary
      .substring(0, 20)
      .replace(/[^\w\s-]/g, '') // 特殊文字を除去
      .trim();
    const fileName = `クイズ_${safeFileName || '問題'}_${new Date().toISOString().split('T')[0]}.pdf`;
    pdf.save(fileName);
  } catch (error) {
    console.error('PDF generation error:', error);
    throw error;
  } finally {
    // 一時要素を削除
    document.body.removeChild(container);
  }
}
