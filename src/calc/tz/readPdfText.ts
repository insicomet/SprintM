/**
 * Текстовый слой PDF — в браузере, без сервера.
 *
 * pdf.js подгружается динамически: он весит больше всего остального
 * приложения вместе взятого, а нужен только когда менеджер открывает ТЗ.
 * Воркер берём тот же, что и в сборке, — иначе pdf.js полезет за ним в
 * интернет, а расчёт должен работать и без сети.
 */
export async function readPdfText(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    // Собираем строки так же, как это делает pdftotext: элемент за
    // элементом, перенос строки — когда меняется вертикальная позиция.
    let line = "";
    let lastY: number | null = null;
    const out: string[] = [];
    for (const item of content.items) {
      if (!("str" in item)) continue;
      const y = Math.round(item.transform[5]);
      if (lastY !== null && Math.abs(y - lastY) > 2) {
        out.push(line.trim());
        line = "";
      }
      line += item.str;
      lastY = y;
    }
    if (line.trim()) out.push(line.trim());
    pages.push(out.join("\n"));
  }
  return pages.join("\n");
}
