/* Asistente — lector de la RESOLUCIÓN EXENTA de cometido funcionario (SERNAGEOMIN, DGDP).
   Entrada: texto de todas las páginas (ya sin sellos de firma). Salida: hechos con su evidencia. */
(function (root) {
  'use strict';
  const A = root.Asistente = root.Asistente || {};

  A.esResolucion = t => /COMETIDO\s+FUNCIONARIO/i.test(t) && /Resoluci[oó]n\s+Exenta/i.test(t) && /RESUELVO/i.test(t);

  A.parseResolucion = function (paginas) {
    const crudo = paginas.map(p => p.texto).join('\n');
    const t = A.plano(crudo);
    const r = { tipo: 'resolucion', ra: '', numero: '', anio: '', fecha: '', autorizacion: '', fechaAutorizacion: '',
      modifica: null, funcionarios: [], imputacion: '', centroCosto: '', fondos: null, objetivo: '', avisos: [] };

    let m = /RA\s*N°\s*(\d+)\/(\d+)\/(\d{4})/.exec(t);
    if (m) { r.ra = `${m[1]}/${m[2]}/${m[3]}`; r.numero = m[2]; r.anio = m[3]; } else r.avisos.push('No se encontró el N° de resolución (RA N°).');
    m = /(?:REGION|REGIÓN)[^,]{0,40},\s*(\d{2}\/\d{2}\/\d{4})/.exec(t) || /RA\s*N°\s*[\d\/]+\s*[A-Z ]{2,}[^,]*,\s*(\d{2}\/\d{2}\/\d{4})/.exec(t);
    if (m) r.fecha = A.fechaDMY(m[1]); else r.avisos.push('No se encontró la fecha de la resolución.');

    m = /autorizaci[oó]n\s*N°\s*(\d+),?\s*de fecha\s*(\d{2}\/\d{2}\/\d{4})/i.exec(t);
    if (m) { r.autorizacion = m[1]; r.fechaAutorizacion = A.fechaDMY(m[2]); }

    m = /MODIFICA A\s+Resoluci[oó]n\s+Exenta\s*N°\s*([\d\/]+)\s*DE\s*(\d{2}\/\d{2}\/\d{4})/i.exec(t);
    if (m) r.modifica = { ra: m[1], fecha: A.fechaDMY(m[2]) };

    m = /centro de costos?\s*(\d+)/i.exec(t);
    if (m) r.centroCosto = m[1];

    // Objetivo / actividad
    m = /siguiente\s+actividad,?\s*[“"]([^”"]+)[”"]/i.exec(t) || /requiere,?\s*(Realizar[^“"]+?)\s*(?:con el fin|,)/i.exec(t);
    if (m) r.objetivo = A.plano(m[1]);

    // Fondos a rendir (varias redacciones)
    const fr = /fondos a rendir\s+(?:al|a nombre del?|a)\s+(?:Sr\.?|Sra\.?)?\s*([^,$]+?),?\s*por\s+(?:un\s+|el\s+)?monto\s+(?:total\s+)?de\s*\$\s*([\d.]+)(?:[^N]{0,60}N°\s*(\d+))?/i.exec(t);
    if (fr) r.fondos = { nombre: A.plano(fr[1]), monto: A.monto(fr[2]), poliza: fr[3] || '' };
    else if (/fondos a rendir/i.test(t)) r.avisos.push('La resolución menciona fondos a rendir pero no se pudo leer el monto.');

    // Funcionarios: "1) NOMBRE, RUN N° ..."
    const i0 = t.indexOf('RESUELVO');
    const cuerpo = i0 >= 0 ? t.slice(i0) : t;
    const bloques = cuerpo.split(/(?:^|\s)(?=\d+\)\s+[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ ]+,\s*RUN\s*N°)/).filter(b => /RUN\s*N°/.test(b));
    bloques.forEach(b => {
      const f = {};
      m = /^\d+\)\s+([A-ZÁÉÍÓÚÑ ]+?),\s*RUN\s*N°\s*([\d.]+-?[\dkK])/.exec(b.trim());
      if (!m) return;
      f.nombreCompleto = A.titulo(m[1]); f.rut = A.formatearRut(m[2].replace(/^(\d+)(-?)([\dkK])$/, '$1-$3'));
      const partes = f.nombreCompleto.split(' ');
      f.nombre = partes.length >= 3 ? `${partes[0]} ${partes[partes.length - 2]} ${partes[partes.length - 1]}` : f.nombreCompleto;
      f.nombreCorto = partes.length >= 3 ? `${partes[0]} ${partes[partes.length - 2]}` : f.nombreCompleto;
      m = /regi[oó]n de\s+(.+?)(?:,\s*comuna de\s+(.+?))?\s+a contar del/i.exec(b);
      if (m) { f.region = A.titulo(m[1].replace(/^REGI[OÓ]N\s+(DE|DEL)\s+/i, '')); f.comuna = m[2] ? A.titulo(m[2]) : ''; }
      m = /a contar del\s+(\d{1,2} de \w+ de \d{4})\s+y hasta(?: el)?\s+(\d{1,2} de \w+ de \d{4})/i.exec(b);
      if (m) { f.desde = A.fechaLarga(m[1]); f.hasta = A.fechaLarga(m[2]); }
      m = /con motivo de\s+(.+?)\.\s*(?:Establ|$)/i.exec(b);
      if (m) f.motivo = A.titulo(A.plano(m[1]));
      m = /(\d+)\s*d[ií]as?\s*al\s*40%[^\d]{0,6}(\d+)\s*d[ií]as?\s*al\s*100%/i.exec(b);
      if (m) { f.dias40 = +m[1]; f.dias100 = +m[2]; }
      else { m = /(\d+)\s*d[ií]as?\s*al\s*100%[^\d]{0,6}(\d+)\s*d[ií]as?\s*al\s*40%/i.exec(b); if (m) { f.dias100 = +m[1]; f.dias40 = +m[2]; } }
      m = /monto total del cometido a\s*\$\s*(\d+)/i.exec(b);
      if (m) f.monto = +m[1];
      m = /Subt[ií]tulo\s+([\d-]+)/i.exec(b);
      if (m) { f.imputacion = m[1]; if (!r.imputacion) r.imputacion = m[1]; }
      r.funcionarios.push(f);
    });
    if (!r.funcionarios.length) r.avisos.push('No se pudieron leer los funcionarios designados.');
    r.categoria = (/categor[ií]a\s*(\d+)\s*del estamento\s*(\w+)/i.exec(t) || []).slice(1);
    return r;
  };
})(typeof window !== 'undefined' ? window : globalThis);
if (typeof module !== 'undefined') module.exports = globalThis.Asistente;
