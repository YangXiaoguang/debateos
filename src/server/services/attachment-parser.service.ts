import 'server-only';

import { mkdir } from 'node:fs/promises';
import path from 'node:path';

import type { AttachmentExtractionMethod, AttachmentExtractionStatus } from '@/types/domain';

const TEXT_MIME_TYPES = new Set([
  'text/plain',
  'text/markdown',
  'application/json',
  'text/csv',
  'application/xml',
  'text/xml',
]);

const IMAGE_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/bmp',
  'image/tiff',
  'image/gif',
]);

const MAX_EXTRACTED_TEXT_CHARS = 24000;
const MAX_PDF_TEXT_PAGES = 8;
const MAX_PDF_OCR_PAGES = 3;
const MIN_DIRECT_PDF_TEXT_CHARS = 40;

type AttachmentExtractionMetadata = {
  method: AttachmentExtractionMethod;
  status: AttachmentExtractionStatus;
  summary: string;
  error?: string;
  pageCount?: number;
  characterCount?: number;
  ocrConfidence?: number;
  truncated?: boolean;
};

type AttachmentExtractionResult = {
  extractedText: string | null;
  metadata: {
    extraction: AttachmentExtractionMetadata;
  };
};

type PdfTextItemLike = {
  str?: string;
};

type PdfTextContentLike = {
  items: PdfTextItemLike[];
};

type PdfPageProxyLike = {
  getTextContent(): Promise<PdfTextContentLike>;
  getViewport(options: { scale: number }): { width: number; height: number };
  render(options: { canvasContext: CanvasRenderingContext2D; viewport: unknown }): {
    promise: Promise<void>;
  };
  cleanup?: () => void;
};

type PdfDocumentProxyLike = {
  numPages: number;
  getPage(pageNumber: number): Promise<PdfPageProxyLike>;
  cleanup?: () => void;
  destroy?: () => Promise<void>;
};

type PdfLoadingTaskLike = {
  promise: Promise<PdfDocumentProxyLike>;
  destroy?: () => Promise<void>;
};

type OcrWorkerLike = {
  recognize(
    image: Buffer | Uint8Array,
    options?: Record<string, never>,
    output?: Record<string, boolean>
  ): Promise<{ data: { text?: string; confidence?: number } }>;
  terminate(): Promise<void>;
};

function isTextLike(file: File) {
  const mimeType = file.type.toLowerCase();
  const lowerName = file.name.toLowerCase();
  return TEXT_MIME_TYPES.has(mimeType) || /\.(txt|md|csv|json|xml|html?)$/i.test(lowerName);
}

function isPdf(file: File) {
  return file.type.toLowerCase() === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

function isImage(file: File) {
  return IMAGE_MIME_TYPES.has(file.type.toLowerCase()) || /\.(png|jpe?g|webp|bmp|gif|tiff?)$/i.test(file.name.toLowerCase());
}

function normalizeText(text: string) {
  return text
    .replace(/\0/g, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function limitText(text: string) {
  const normalized = normalizeText(text);
  const characterCount = normalized.length;
  const truncated = characterCount > MAX_EXTRACTED_TEXT_CHARS;
  const clipped = truncated ? `${normalized.slice(0, MAX_EXTRACTED_TEXT_CHARS)}\n\n[内容过长，系统已截断]` : normalized;

  return {
    text: clipped || null,
    characterCount,
    truncated,
  };
}

function buildResult(
  method: AttachmentExtractionMethod,
  status: AttachmentExtractionStatus,
  summary: string,
  options?: {
    extractedText?: string | null;
    error?: string;
    pageCount?: number;
    characterCount?: number;
    ocrConfidence?: number;
    truncated?: boolean;
  }
): AttachmentExtractionResult {
  return {
    extractedText: options?.extractedText ?? null,
    metadata: {
      extraction: {
        method,
        status,
        summary,
        error: options?.error,
        pageCount: options?.pageCount,
        characterCount: options?.characterCount,
        ocrConfidence: options?.ocrConfidence,
        truncated: options?.truncated,
      },
    },
  };
}

async function resolveOcrCachePath() {
  const directory = path.join(process.cwd(), '.cache', 'tesseract');
  await mkdir(directory, { recursive: true });
  return directory;
}

function resolveOcrLanguages() {
  const raw = process.env.OCR_LANGUAGES || 'eng,chi_sim';
  const languages = raw
    .split(/[,+]/)
    .map((item) => item.trim())
    .filter(Boolean);

  return languages.length <= 1 ? languages[0] || 'eng' : languages;
}

async function createOcrWorker() {
  const { createWorker, setLogging } = await import('tesseract.js');
  setLogging(false);

  const cachePath = await resolveOcrCachePath();
  const workerPath = path.join(process.cwd(), 'node_modules', 'tesseract.js', 'src', 'worker-script', 'node', 'index.js');
  const worker = (await createWorker(resolveOcrLanguages(), 1, {
    langPath: process.env.OCR_LANG_PATH || undefined,
    cachePath,
    workerPath,
  })) as unknown as OcrWorkerLike;

  return worker;
}

async function recognizeImageBuffer(worker: OcrWorkerLike, buffer: Buffer | Uint8Array) {
  const result = await worker.recognize(buffer);
  const rawText = result.data.text || '';
  const { text, characterCount, truncated } = limitText(rawText);

  return {
    text,
    characterCount,
    truncated,
    confidence: typeof result.data.confidence === 'number' ? Number(result.data.confidence.toFixed(2)) : null,
  };
}

async function parseTextAttachment(buffer: Buffer) {
  const decoded = buffer.toString('utf8');
  const { text, characterCount, truncated } = limitText(decoded);
  const status: AttachmentExtractionStatus = truncated ? 'partial' : 'ready';

  return buildResult(
    'plain_text',
    status,
    truncated ? '文本已抽取，但内容较长，系统已截断。' : '文本内容已成功抽取，可直接进入辩论上下文。',
    {
      extractedText: text,
      characterCount,
      truncated,
    }
  );
}

async function renderPdfPageToPng(page: PdfPageProxyLike) {
  const { createCanvas } = await import('@napi-rs/canvas');
  const viewport = page.getViewport({ scale: 1.6 });
  const canvas = createCanvas(Math.max(1, Math.ceil(viewport.width)), Math.max(1, Math.ceil(viewport.height)));
  const context = canvas.getContext('2d') as unknown as CanvasRenderingContext2D;

  await page.render({
    canvasContext: context,
    viewport,
  }).promise;

  return canvas.toBuffer('image/png');
}

async function parsePdfAttachment(buffer: Buffer) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = path.join(process.cwd(), 'node_modules', 'pdfjs-dist', 'legacy', 'build', 'pdf.worker.mjs');
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useWorkerFetch: false,
    isEvalSupported: false,
    standardFontDataUrl: `${path.join(process.cwd(), 'node_modules', 'pdfjs-dist', 'standard_fonts')}${path.sep}`,
  }) as unknown as PdfLoadingTaskLike;
  const pdf = await loadingTask.promise;

  try {
    const pageCount = pdf.numPages;
    const pagesToRead = Math.min(pageCount, MAX_PDF_TEXT_PAGES);
    const directTextParts: string[] = [];

    for (let pageNo = 1; pageNo <= pagesToRead; pageNo += 1) {
      const page = await pdf.getPage(pageNo);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item) => item.str || '')
        .filter(Boolean)
        .join(' ');

      if (pageText) {
        directTextParts.push(pageText);
      }

      page.cleanup?.();
    }

    const directText = directTextParts.join('\n\n');
    const limitedDirectText = limitText(directText);

    if ((limitedDirectText.text?.length || 0) >= MIN_DIRECT_PDF_TEXT_CHARS) {
      const truncated = limitedDirectText.truncated || pageCount > MAX_PDF_TEXT_PAGES;
      return buildResult(
        'pdf_text',
        truncated ? 'partial' : 'ready',
        truncated
          ? `PDF 文本已抽取，共检测到 ${pageCount} 页；为控制体量，系统仅纳入前 ${pagesToRead} 页或前 ${MAX_EXTRACTED_TEXT_CHARS} 字。`
          : `PDF 文本已成功抽取，共 ${pageCount} 页。`,
        {
          extractedText: limitedDirectText.text,
          pageCount,
          characterCount: limitedDirectText.characterCount,
          truncated,
        }
      );
    }

    const worker = await createOcrWorker();

    try {
      const pagesToOcr = Math.min(pageCount, MAX_PDF_OCR_PAGES);
      const ocrTexts: string[] = [];
      const confidenceValues: number[] = [];

      for (let pageNo = 1; pageNo <= pagesToOcr; pageNo += 1) {
        const page = await pdf.getPage(pageNo);
        const pngBuffer = await renderPdfPageToPng(page);
        const ocr = await recognizeImageBuffer(worker, pngBuffer);

        if (ocr.text) {
          ocrTexts.push(ocr.text);
        }

        if (typeof ocr.confidence === 'number') {
          confidenceValues.push(ocr.confidence);
        }

        page.cleanup?.();
      }

      const combinedOcrText = ocrTexts.join('\n\n');
      const limitedOcrText = limitText(combinedOcrText);

      if (!limitedOcrText.text) {
        return buildResult(
          'ocr_pdf',
          'failed',
          'PDF 已上传，但未从中提取到足够的文本，可能是图片质量过低或扫描件内容过弱。',
          {
            pageCount,
            error: 'No readable text extracted from PDF.',
          }
        );
      }

      const averageConfidence =
        confidenceValues.length > 0
          ? Number((confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length).toFixed(2))
          : null;
      const truncated = limitedOcrText.truncated || pageCount > MAX_PDF_OCR_PAGES;

      return buildResult(
        'ocr_pdf',
        truncated ? 'partial' : 'ready',
        truncated
          ? `PDF 未检测到可搜索文本，系统已对前 ${pagesToOcr} 页执行 OCR 并截断超长内容。`
          : `PDF 未检测到可搜索文本，系统已通过 OCR 成功识别 ${pagesToOcr} 页。`,
        {
          extractedText: limitedOcrText.text,
          pageCount,
          characterCount: limitedOcrText.characterCount,
          ocrConfidence: averageConfidence ?? undefined,
          truncated,
        }
      );
    } finally {
      await worker.terminate().catch(() => undefined);
    }
  } finally {
    pdf.cleanup?.();
    await pdf.destroy?.().catch(() => undefined);
    await loadingTask.destroy?.().catch(() => undefined);
  }
}

async function parseImageAttachment(buffer: Buffer) {
  const worker = await createOcrWorker();

  try {
    const recognized = await recognizeImageBuffer(worker, buffer);
    if (!recognized.text) {
      return buildResult('ocr_image', 'failed', '图片已上传，但 OCR 没有识别到足够文本。', {
        error: 'No readable text extracted from image.',
        ocrConfidence: recognized.confidence ?? undefined,
      });
    }

    return buildResult(
      'ocr_image',
      recognized.truncated ? 'partial' : 'ready',
      recognized.truncated ? '图片 OCR 已完成，但内容较长，系统已截断。' : '图片 OCR 已成功完成。',
      {
        extractedText: recognized.text,
        characterCount: recognized.characterCount,
        ocrConfidence: recognized.confidence ?? undefined,
        truncated: recognized.truncated,
      }
    );
  } finally {
    await worker.terminate().catch(() => undefined);
  }
}

export async function extractAttachmentContent(file: File, buffer: Buffer): Promise<AttachmentExtractionResult> {
  try {
    if (isTextLike(file)) {
      return await parseTextAttachment(buffer);
    }

    if (isPdf(file)) {
      return await parsePdfAttachment(buffer);
    }

    if (isImage(file)) {
      return await parseImageAttachment(buffer);
    }

    return buildResult('none', 'skipped', '当前格式暂不支持自动解析，文件已保存，可在辩论时手动参考。');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown attachment parse error.';
    const method: AttachmentExtractionMethod = isPdf(file) ? 'pdf_text' : isImage(file) ? 'ocr_image' : isTextLike(file) ? 'plain_text' : 'none';

    return buildResult(method, 'failed', '自动解析失败，但文件已成功上传保存。', {
      error: message,
    });
  }
}
