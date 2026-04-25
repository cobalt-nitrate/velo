import crypto from 'crypto';

export function sha256Hex(buf: Buffer): string {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

/**
 * Best-effort HTML->PDF renderer.
 *
 * Uses Playwright if installed. If not, returns null (caller can fall back to HTML).
 */
export async function renderPdfFromHtml(html: string): Promise<Buffer | null> {
  try {
    // Lazy import so installs that don't include Playwright still work.
    const mod = (await import('playwright')) as unknown as {
      chromium: {
        launch: (opts: Record<string, unknown>) => Promise<{
          newPage: () => Promise<{
            setContent: (html: string, opts?: Record<string, unknown>) => Promise<void>;
            pdf: (opts?: Record<string, unknown>) => Promise<Buffer>;
            close: () => Promise<void>;
          }>;
          close: () => Promise<void>;
        }>;
      };
    };

    const browser = await mod.chromium.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle' });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '16mm', bottom: '16mm', left: '14mm', right: '14mm' },
    });
    await page.close();
    await browser.close();
    return pdf;
  } catch {
    return null;
  }
}

