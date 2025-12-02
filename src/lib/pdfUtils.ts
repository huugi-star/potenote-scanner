/**
 * pdfUtils.ts
 * 
 * クイズをPDF化するユーティリティ
 * 学習プリント形式（2カラム構成、折り目付き）
 */

import jsPDF from 'jspdf';
import type { QuizHistory } from '@/types';

/**
 * クイズ履歴をPDF化
 * 2カラム構成（左75%：問題、右25%：正解と解説）
 * 折り目の点線付き
 */
export function generateQuizPDF(history: QuizHistory): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15; // 上下左右のマージン
  const foldLineX = margin + (pageWidth - margin * 2) * 0.75; // 折り目位置（左75%）
  
  const leftColumnWidth = foldLineX - margin - 5; // 左カラム幅（マージン考慮）
  const rightColumnWidth = pageWidth - foldLineX - margin - 5; // 右カラム幅（マージン考慮）
  
  let currentY = margin + 10; // 現在のY位置

  // タイトル
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('学習プリント', pageWidth / 2, currentY, { align: 'center' });
  currentY += 8;

  // サマリー
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const summaryLines = doc.splitTextToSize(history.quiz.summary, pageWidth - margin * 2);
  doc.text(summaryLines, margin, currentY);
  currentY += summaryLines.length * 5 + 8;

  // 問題を1問ずつ処理
  history.quiz.questions.forEach((question, index) => {
    // ページを超える場合は改ページ
    if (currentY > pageHeight - margin - 50) {
      doc.addPage();
      currentY = margin + 10;
    }

    const questionStartY = currentY;

    // ===== 左カラム：問題文 =====
    let leftY = questionStartY;
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`問${index + 1}`, margin, leftY);
    leftY += 6;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const questionLines = doc.splitTextToSize(question.q, leftColumnWidth);
    doc.text(questionLines, margin + 5, leftY);
    leftY += questionLines.length * 4.5 + 3;

    // 選択肢
    question.options.forEach((option, optIndex) => {
      const optionText = `${String.fromCharCode(65 + optIndex)}. ${option}`;
      const optionLines = doc.splitTextToSize(optionText, leftColumnWidth - 5);
      doc.setFontSize(9);
      doc.text(optionLines, margin + 5, leftY);
      leftY += optionLines.length * 4.5;
    });

    const leftEndY = leftY;

    // ===== 右カラム：正解と解説 =====
    let rightY = questionStartY;
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`答${index + 1}`, foldLineX + 5, rightY);
    rightY += 6;
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    const correctAnswer = question.options[question.a];
    const answerText = `正解: ${String.fromCharCode(65 + question.a)}. ${correctAnswer}`;
    const answerLines = doc.splitTextToSize(answerText, rightColumnWidth);
    doc.text(answerLines, foldLineX + 5, rightY);
    rightY += answerLines.length * 4.5 + 3;
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const explanationLines = doc.splitTextToSize(question.explanation, rightColumnWidth);
    doc.text(explanationLines, foldLineX + 5, rightY);
    rightY += explanationLines.length * 4.5;

    const rightEndY = rightY;

    // 左と右の高い方に合わせて次の問題の位置を決定
    currentY = Math.max(leftEndY, rightEndY) + 5;

    // 区切り線
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.2);
    doc.line(margin, currentY - 2, pageWidth - margin, currentY - 2);
    currentY += 3;
  });

  // 折り目の点線を各ページに描画
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(100, 100, 100);
    doc.setLineWidth(0.3);
    
    // 点線を描画（短い線を繰り返し描画）
    let y = margin;
    while (y < pageHeight - margin) {
      doc.line(foldLineX, y, foldLineX, y + 2);
      y += 4;
    }
  }

  // PDFをダウンロード
  const safeFileName = history.quiz.summary
    .substring(0, 20)
    .replace(/[^\w\s-]/g, '') // 特殊文字を除去
    .trim();
  const fileName = `クイズ_${safeFileName || '問題'}_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
}

