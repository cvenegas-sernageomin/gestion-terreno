/* Asistente — documentos de gasto: boleta de honorarios electrónica, factura electrónica, comprobante de transferencia.
   Entrada: texto con saltos de línea (pdf.js). Salida: hechos; las cifras se leen, nunca se estiman. */
(function (root) {
  'use strict';
  const A = root.Asistente = root.Asistente || {};
  const RUT_SERVICIO = '61.702.000-9';   // SERNAGEOMIN: es el receptor, no el proveedor

  A.clasificar = function (texto) {
    const t = A.plano(texto);
    if (A.esResolucion && A.esResolucion(t)) return 'resolucion';
    if (/BOLETA\s+DE\s+HONORARIOS/i.test(t)) return 'boleta_honorarios';
    if (/FACTURA\s+ELECTR[OÓ]NICA/i.test(t)) return 'factura';
    if (/Comprobante de Transferencia/i.test(t) && /Monto/i.test(t)) return 'comprobante_transferencia';
    if (/BOLETA\s+ELECTR[OÓ]NICA|COMPROBANTE DE VENTA|VENTA EN LINEA/i.test(t)) return 'boleta_comercio';
    return 'otro';
  };

  /** Resume la glosa en una «materia» corta para la rendición (sin teléfonos ni nombres de personas). */
  A.materia = function (glosa) {
    const g = A.plano(glosa);
    let m = /arriendo de (\d+) caballos? por (\d+) d[ií]as?/i.exec(g);
    if (m) return `Arriendo de ${m[1]} ${m[1] === '1' ? 'caballo' : 'caballos'} por ${m[2]} ${m[2] === '1' ? 'día' : 'días'}`;
    m = /alarife[^\d]{0,6}(\d+)\s*d[ií]as?/i.exec(g);
    if (m) return `Servicio de alarife por ${m[1]} ${m[1] === '1' ? 'día' : 'días'}`;
    if (/alarife/i.test(g)) return 'Servicio de alarife';
    if (/caballo/i.test(g)) return 'Arriendo de caballos';
    if (/ayudante|arriero|log[ií]stic/i.test(g)) { const n = /(\d+)\s*d[ií]as?/i.exec(g); return n ? `Servicio de apoyo logístico por ${n[1]} días` : 'Servicio de apoyo logístico'; }
    let s = g.split(/ para | a \$/i)[0].replace(/\bTEL\.?\s*[\d ]+/gi, '').replace(/\bVALOR DIARIO[^.]*\./gi, '').replace(/\s+/g, ' ').trim();
    s = s.replace(/^serv\.?\s*/i, 'Servicio ');
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase().slice(0, 90);
  };

  A.parseBoletaHonorarios = function (texto) {
    const lineas = String(texto).split('\n').map(l => l.trim()).filter(Boolean);
    const t = A.plano(texto);
    const d = { tipo: 'boleta_honorarios', avisos: [] };
    d.proveedor = A.titulo(lineas[0] || '');
    let m = /N\s*°\s*(\d+)/.exec(t); d.num = m ? m[1] : '';
    m = /RUT:\s*([\d.]+\s*[−-]\s*[\dkK])/.exec(t); d.rut = m ? A.formatearRut(m[1]) : '';
    m = /Fecha:\s*(\d{1,2} de \w+ de \d{4})/i.exec(t); d.fecha = m ? A.fechaLarga(m[1]) : '';
    const i0 = lineas.findIndex(l => /Por atenci[oó]n profesional/i.test(l));
    const i1 = lineas.findIndex((l, i) => i > i0 && /^[\d.]+$/.test(l));
    d.glosa = i0 >= 0 ? lineas.slice(i0 + 1, i1 > i0 ? i1 : i0 + 3).join(' ') : '';
    m = /Total Honorarios:\s*\$?:?\s*([\d.]+)/i.exec(t); d.bruto = m ? A.monto(m[1]) : 0;
    m = /([\d.,]+)\s*%\s*Impto\.?\s*Retenido:\s*([\d.]+)/i.exec(t); d.retencion = m ? A.monto(m[2]) : 0; d.tasa = m ? m[1] : '';
    m = /\bTotal:\s*([\d.]+)/.exec(t); d.liquido = m ? A.monto(m[1]) : 0;
    d.monto = d.liquido;                       // en honorarios se rinde el líquido
    d.materia = A.materia(d.glosa);
    if (d.bruto && d.retencion && d.liquido && d.bruto - d.retencion !== d.liquido) d.avisos.push('El líquido no cuadra con bruto − retención.');
    if (!d.num || !d.monto) d.avisos.push('Faltan N° o monto.');
    return d;
  };

  A.parseFactura = function (texto) {
    const lineas = String(texto).split('\n').map(l => l.trim()).filter(Boolean);
    const t = A.plano(texto);
    const d = { tipo: 'factura', avisos: [] };
    d.proveedor = A.titulo(lineas[0] || '');
    let m = /FACTURA\s+ELECTR[OÓ]NICA\s*N\s*[º°]\s*(\d+)/i.exec(t) || /N\s*[º°]\s*(\d+)\s*S\.I\.I/i.exec(t); d.num = m ? m[1] : '';
    const ruts = [...t.matchAll(/R\.?U\.?T\.?:?\s*([\d.]+\s*[−-]\s*[\dkK])/gi)].map(x => A.formatearRut(x[1])).filter(r => r && r !== RUT_SERVICIO);
    d.rut = ruts[0] || '';
    m = /Fecha Emisi[oó]n:\s*(\d{1,2} de \w+ del? \d{4})/i.exec(t); d.fecha = m ? A.fechaLarga(m[1]) : '';
    const i0 = lineas.findIndex(l => /^Codigo\s+Descripcion/i.test(l) || /Codigo Descripcion/i.test(l));
    const i1 = lineas.findIndex((l, i) => i > i0 && /Forma de Pago/i.test(l));
    d.glosa = i0 >= 0 ? lineas.slice(i0 + 2, i1 > i0 ? i1 : i0 + 6).join(' ') : '';
    m = /MONTO NETO\s*\$\s*([\d.]+)/i.exec(t); d.neto = m ? A.monto(m[1]) : 0;
    m = /I\.V\.A\.?\s*19%\s*\$\s*([\d.]+)/i.exec(t); d.iva = m ? A.monto(m[1]) : 0;
    m = /\bTOTAL\s*\$\s*([\d.]+)/.exec(t); d.total = m ? A.monto(m[1]) : 0;
    d.monto = d.total;
    d.materia = A.materia(d.glosa);
    if (d.neto && d.total && d.neto + d.iva !== d.total) d.avisos.push('El total no cuadra con neto + IVA.');
    if (!d.num || !d.monto) d.avisos.push('Faltan N° o monto.');
    return d;
  };

  A.parseComprobanteTransferencia = function (texto) {
    const t = A.plano(texto);
    const d = { tipo: 'comprobante_transferencia', avisos: [] };
    let m = /Monto\s*\$\s*([\d.]+)/i.exec(t); d.monto = m ? A.monto(m[1]) : 0;
    m = /Fecha y hora\s*(\d{2}\/\d{2}\/\d{4})/i.exec(t); d.fecha = m ? A.fechaDMY(m[1]) : '';
    m = /N°\s*de operaci[oó]n\s*(\d+)/i.exec(t); d.operacion = m ? m[1] : '';
    d.esReintegro = /Servicio Nacional De Geolog/i.test(t) || /Reintegro/i.test(t);
    return d;
  };

  A.parseDocumento = function (texto) {
    const tipo = A.clasificar(texto);
    if (tipo === 'boleta_honorarios') return A.parseBoletaHonorarios(texto);
    if (tipo === 'factura') return A.parseFactura(texto);
    if (tipo === 'comprobante_transferencia') return A.parseComprobanteTransferencia(texto);
    return { tipo, avisos: [] };
  };
})(typeof window !== 'undefined' ? window : globalThis);
if (typeof module !== 'undefined') module.exports = globalThis.Asistente;
