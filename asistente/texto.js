/* Asistente — lectura de texto de documentos (PDF con pdf.js, xlsx/docx con JSZip) y utilidades comunes.
   Funciona en el navegador y en Node (pruebas). Nada se envía a ningún servidor. */
(function (root) {
  'use strict';
  const A = root.Asistente = root.Asistente || {};

  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  A.MESES = MESES;

  /** "27 de abril de 2026" / "5 de Mayo del 2026" -> "2026-04-27" */
  A.fechaLarga = function (s) {
    const m = /(\d{1,2})\s+de\s+([A-Za-zñáéíóú]+)\s+del?\s+(\d{4})/i.exec(s || '');
    if (!m) return '';
    const i = MESES.indexOf(m[2].toLowerCase());
    if (i < 0) return '';
    return `${m[3]}-${String(i + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  };
  /** "28/04/2026" -> "2026-04-28" */
  A.fechaDMY = function (s) {
    const m = /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/.exec(s || '');
    return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : '';
  };
  /** "$1.201.846" / "1.201.846" / "445446" -> 1201846 */
  A.monto = function (s) {
    const d = String(s == null ? '' : s).replace(/[^\d]/g, '');
    return d ? parseInt(d, 10) : 0;
  };
  /** "13477199-2" / "13.477.199−2" -> "13.477.199-2" */
  A.formatearRut = function (s) {
    const m = /(\d{1,2})\.?(\d{3})\.?(\d{3})\s*[-−–]\s*([\dkK])/.exec(s || '');
    return m ? `${m[1]}.${m[2]}.${m[3]}-${m[4].toUpperCase()}` : '';
  };
  A.titulo = function (s) {
    return String(s || '').toLowerCase().replace(/(^|[\s\-])([a-záéíóúñü])/g, (m, a, b) => a + b.toUpperCase());
  };
  A.plano = t => String(t || '').replace(/\s+/g, ' ').trim();

  /** Quita los sellos de firma electrónica que pdf.js intercala en el texto (siaper.contraloria.cl, FIRMAGOB, etc.)
      conservando el texto de la resolución que comparte línea con ellos. */
  A.limpiarFirmas = function (texto) {
    return String(texto || '')
      .replace(/[A-ZÁÉÍÓÚÑ][^\s.\d]*(?:[ \t]+[A-ZÁÉÍÓÚÑ][^\s.\d]*){1,4}[ \t]+https?:\/\/siaper\.contraloria\.cl(?:[ \t]+\d{2}\/\d{2}\/\d{4})?(?:[ \t]+\d{2}:\d{2}:\d{2})?\d*/g, ' ')
      .replace(/https?:\/\/siaper\.contraloria\.cl(?:[ \t]+\d{2}\/\d{2}\/\d{4})?(?:[ \t]+\d{2}:\d{2}:\d{2})?\d*/g, ' ')
      .replace(/P[aá]gina \d+ \/ \d+\d*_FIRMAGOB/g, ' ')
      .replace(/\d*_FIRMAGOB/g, ' ')
      .replace(/[ \t]+(?:ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|OCT|NOV|DIC) \d{4}\b/g, ' ')
      .replace(/^[ \t]*P[aá]gina \d+ \/ \d+[ \t]*$/gm, '');
  };

  /** Lee un PDF con pdf.js y devuelve [{n, texto}] (una entrada por página, con saltos de línea reales). */
  A.leerPdf = async function (pdfjsLib, buffer) {
    const data = new Uint8Array(buffer);
    const doc = await pdfjsLib.getDocument({ data, useSystemFonts: true, disableFontFace: true, verbosity: 0 }).promise;
    const out = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const tc = await (await doc.getPage(i)).getTextContent();
      out.push({ n: i, texto: A.limpiarFirmas(tc.items.map(it => it.str + (it.hasEOL ? '\n' : '')).join('')) });
    }
    return out;
  };

  /** Texto de una hoja xlsx/docx (JSZip): devuelve el texto plano de cada parte relevante. */
  A.leerOfficeZip = async function (JSZipLib, buffer, nombre) {
    const zip = await JSZipLib.loadAsync(buffer);
    const quitarXml = x => x.replace(/<w:tab\/>/g, '\t').replace(/<\/w:p>|<\/row>|<\/si>/g, '\n').replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
    if (/\.docx$/i.test(nombre)) {
      const f = zip.file('word/document.xml');
      return f ? [{ n: 1, texto: quitarXml(await f.async('string')) }] : [];
    }
    const comp = zip.file('xl/sharedStrings.xml');
    return comp ? [{ n: 1, texto: quitarXml(await comp.async('string')) }] : [];
  };
})(typeof window !== 'undefined' ? window : globalThis);
if (typeof module !== 'undefined') module.exports = globalThis.Asistente;
