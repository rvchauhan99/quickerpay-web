/**
 * Browser OCR for hosted /payin — extract UPI / Manual bank reference digits
 * from a payment screenshot. No server round-trip; image stays on-device until Submit.
 */

export type OcrReferenceKind = 'UPI' | 'MANUAL_BANK'

const LABEL_RE =
  /(?:UTR(?:\s*(?:NO|NUMBER|#))?|UPI\s*REF(?:ERENCE)?|REF(?:ERENCE)?\s*(?:NO|NUMBER|#)?|RRN|BANK\s*REF(?:ERENCE)?)\s*[:.#-]?\s*/gi

const MAX_OCR_EDGE_PX = 1600

/** Collapse OCR noise around digit runs (spaces, newlines, common separators). */
function compactDigits(raw: string): string {
  return raw.replace(/[\s\-_.]/g, '')
}

function allDigitRuns(text: string): string[] {
  const runs: string[] = []
  // Per-line so "₹100" does not glue onto a UTR on the next line.
  for (const line of text.split(/\r?\n/)) {
    const re = /\d+/g
    let match: RegExpExecArray | null
    while ((match = re.exec(line)) !== null) {
      runs.push(match[0])
    }
    // Spaced groups on one line: "4293 8102 9482" → 12 digits.
    const spaced = line.match(/\d(?:[\d \-_.]*\d)*/g) ?? []
    for (const chunk of spaced) {
      const compact = compactDigits(chunk)
      if (compact.length >= 9) runs.push(compact)
    }
  }
  return runs
}

function labeledCandidates(text: string): string[] {
  const out: string[] = []
  const re = new RegExp(LABEL_RE.source, 'gi')
  let match: RegExpExecArray | null
  while ((match = re.exec(text)) !== null) {
    const after = text.slice(match.index + match[0].length, match.index + match[0].length + 48)
    const digits = compactDigits(after).match(/^\d+/)
    if (digits) out.push(digits[0])
  }
  return out
}

function isValidUpi(digits: string): boolean {
  return /^\d{12}$/.test(digits)
}

function isValidBankRef(digits: string): boolean {
  return /^\d{9,22}$/.test(digits)
}

/**
 * Pure picker — unit-tested without WASM.
 * Prefer labeled UTR/RRN hits, then bare digit runs matching the method.
 */
export function pickReferenceFromOcrText(text: string, kind: OcrReferenceKind): string | null {
  if (!text.trim()) return null

  const labeled = labeledCandidates(text)
  const bare = allDigitRuns(text)

  if (kind === 'UPI') {
    for (const candidate of labeled) {
      if (isValidUpi(candidate)) return candidate
      // Labeled run may include surrounding digits; take first 12 if longer.
      if (candidate.length > 12) {
        const slice = candidate.slice(0, 12)
        if (isValidUpi(slice)) return slice
      }
    }
    for (const candidate of bare) {
      if (isValidUpi(candidate)) return candidate
    }
    // Spaced "4293 8102 9482" becomes one 12-digit run via compactDigits in allDigitRuns.
    return null
  }

  // MANUAL_BANK: longest valid 9–22 digit run; labeled wins ties by order.
  let best: string | null = null
  for (const candidate of [...labeled, ...bare]) {
    if (!isValidBankRef(candidate)) continue
    if (!best || candidate.length > best.length) best = candidate
  }
  return best
}

async function downscaleForOcr(file: File): Promise<Blob | File> {
  if (typeof createImageBitmap === 'undefined') return file
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    return file
  }
  const maxEdge = Math.max(bitmap.width, bitmap.height)
  if (maxEdge <= MAX_OCR_EDGE_PX) {
    bitmap.close()
    return file
  }
  const scale = MAX_OCR_EDGE_PX / maxEdge
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close()
    return file
  }
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.92)
  })
  return blob ?? file
}

/**
 * Run tesseract in the browser (dynamic import). Returns null when no match
 * or OCR fails — never throws for caller UX.
 */
export async function extractReferenceFromImage(
  file: File,
  kind: OcrReferenceKind,
): Promise<string | null> {
  if (!file.type.startsWith('image/')) return null

  type OcrWorker = {
    recognize: (input: Blob | File) => Promise<{ data: { text: string } }>
    terminate: () => Promise<void>
  }
  let worker: OcrWorker | null = null
  try {
    const { createWorker } = await import('tesseract.js')
    const input = await downscaleForOcr(file)
    worker = (await createWorker('eng')) as unknown as OcrWorker
    const { data } = await worker.recognize(input)
    return pickReferenceFromOcrText(data.text ?? '', kind)
  } catch {
    return null
  } finally {
    if (worker) {
      try {
        await worker.terminate()
      } catch {
        /* ignore */
      }
    }
  }
}
