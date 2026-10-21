/* Asistente — de los hechos leídos (resolución + boletas) a los campos de cada formulario de la PWA.
   Cada campo lleva valor, fuente y confianza; la pantalla de revisión decide qué se aplica. */
(function (root) {
  'use strict';
  const A = root.Asistente = root.Asistente || {};

  /** Agrupa resoluciones: cada base con sus modificatorias; devuelve cometidos del más reciente al más antiguo. */
  A.agruparResoluciones = function (resoluciones) {
    const porRa = new Map(resoluciones.map(r => [r.ra, r]));
    const mods = resoluciones.filter(r => r.modifica);
    const bases = resoluciones.filter(r => !r.modifica);
    const cometidos = bases.map(b => ({ base: b, mods: mods.filter(m => m.modifica.ra === b.ra).sort((x, y) => x.fecha.localeCompare(y.fecha)) }));
    mods.filter(m => !porRa.has(m.modifica.ra)).forEach(m => cometidos.push({ base: m, mods: [] }));   // modificatoria sin su original
    return cometidos.map(c => {
      const ult = c.mods.filter(m => m.funcionarios.length).slice(-1)[0] || c.base;
      const fondos = [...c.mods].reverse().map(m => m.fondos).concat([c.base.fondos]).find(Boolean) || null;
      return Object.assign({}, c.base, {
        funcionarios: ult.funcionarios.length ? ult.funcionarios : c.base.funcionarios,
        fondos, raModificatorias: c.mods.map(m => m.ra), archivos: [c.base.archivo].concat(c.mods.map(m => m.archivo)).filter(Boolean),
      });
    }).sort((a, b) => b.fecha.localeCompare(a.fecha));
  };

  A.eligeFuncionario = function (cometido, rutYo) {
    const fs = cometido.funcionarios || [];
    return fs.find(f => f.rut === rutYo) || null;
  };

  const diasEntre = (a, b) => {
    const out = [];
    if (!a || !b) return out;
    const d = new Date(a + 'T00:00:00'), fin = new Date(b + 'T00:00:00');
    for (let i = 0; d <= fin && i < 60; i++, d.setDate(d.getDate() + 1)) out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    return out;
  };
  const limpiarObjetivo = o => A.plano(o).replace(/\.?\s*Fondos a rendir sobre.*$/i, '').replace(/^Realizar\s+/i, '').replace(/\.$/, '');
  const mesDe = iso => A.MESES[parseInt(iso.slice(5, 7), 10) - 1];

  /**
   * @param {object} c        cometido (resolución combinada)
   * @param {object} yo       funcionario (de c.funcionarios) que usa la PWA
   * @param {object[]} gastos documentos de gasto elegidos: boletas/facturas, ya con .archivo y .fecha
   * @param {object|null} comprobante comprobante de transferencia (reintegro) si existe
   * @returns {{rendicion:Array, memo:Array, informe:Array, avisos:string[]}} listas de campos {k,label,valor,fuente,conf,aplicar}
   */
  A.construirCampos = function (c, yo, gastos, comprobante) {
    const f = (k, label, valor, fuente, conf, extra) => Object.assign({ k, label, valor, fuente, conf: conf || 'alta', aplicar: valor !== '' && valor != null && !(Array.isArray(valor) && !valor.length) }, extra || {});
    const rf = `Resolución ${c.ra}`;
    const avisos = [];
    const hasta = yo.hasta || '', desde = yo.desde || '';
    const doc = x => ({ num: x.num, val: x.monto, prov: x.proveedor, mat: x.materia });
    const docs = (gastos || []).slice().sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''));
    if (docs.length > 5) avisos.push(`La Rendición admite 5 documentos; hay ${docs.length}. Se cargan los 5 primeros.`);
    const gastosTotal = docs.slice(0, 5).reduce((s, x) => s + (x.monto || 0), 0);
    const fondos = c.fondos ? c.fondos.monto : 0;
    if (!fondos) avisos.push('La resolución no trae fondos a rendir: ingrésalos a mano.');
    const nombreFuncionario = yo.nombre;

    const rendicion = [
      f('funcionario', 'Funcionario que rinde', nombreFuncionario, rf),
      f('mes', 'Mes de los gastos', hasta ? mesDe(hasta) : '', `Término del cometido (${hasta})`, 'media'),
      f('anio', 'Año', hasta ? hasta.slice(0, 4) : '', `Término del cometido (${hasta})`),
      f('resolucion', 'Resolución Exenta N°', c.numero, rf),
      f('fechaResol', 'Fecha de la resolución', c.fecha, rf),
      f('imputacion', 'Imputación', c.imputacion, rf + ' (Subtítulo)', 'media'),
      f('fondos', 'Fondos asignados ($)', fondos, c.fondos ? `${rf}, fondos a rendir${c.fondos.nombre ? ' a ' + c.fondos.nombre : ''}` : '', 'alta'),
    ];
    docs.slice(0, 5).forEach((x, i) => rendicion.push(f(`doc${i}`, `Documento ${i + 1}: ${x.proveedor || '?'} N°${x.num || '?'}`, doc(x),
      `${x.archivo || ''}`, x.avisos && x.avisos.length ? 'baja' : 'alta', { tipoCampo: 'doc', detalle: `${x.materia} — $${A.clp(x.monto)}` })));
    if (docs.length && fondos) {
      rendicion.push(f('totalCheck', 'Control', `Gastos $${A.clp(gastosTotal)} · fondos $${A.clp(fondos)} · a reintegrar $${A.clp(Math.max(0, fondos - gastosTotal))}`, 'calculado', 'alta', { aplicar: false, soloInfo: true }));
      if (gastosTotal > fondos) avisos.push('Los gastos superan los fondos asignados.');
    }
    if (comprobante && comprobante.monto) {
      rendicion.push(f('reintegroDetalle', 'Detalle del reintegro', 'Transferencia a Sernageomin', comprobante.archivo || 'comprobante', 'media'));
      rendicion.push(f('transferencia', 'Transferencia electrónica', `N° operación ${comprobante.operacion || '?'}${comprobante.fecha ? ' del ' + comprobante.fecha.split('-').reverse().join('-') : ''} por $${A.clp(comprobante.monto)}`, comprobante.archivo || 'comprobante', 'media'));
      const esperado = Math.max(0, fondos - gastosTotal);
      if (fondos && docs.length && comprobante.monto !== esperado) avisos.push(`El reintegro del comprobante ($${A.clp(comprobante.monto)}) no coincide con fondos − gastos ($${A.clp(esperado)}).`);
    }

    // ---- Memo de fondos a rendir
    const otros = (c.funcionarios || []).filter(x => x.rut !== yo.rut);
    const quienes = [`${A.titulo(yo.nombreCorto)} (encargado de comisión)`].concat(otros.map(x => x.nombreCorto));
    const equipo = quienes.length > 1 ? `los profesionales ${quienes.slice(0, -1).join(', ')} y ${quienes[quienes.length - 1]}` : `el profesional ${quienes[0]}`;
    const conceptos = [];
    if (docs.some(x => /caballo/i.test(x.materia))) conceptos.push('caballos');
    if (docs.some(x => /alarife|log[ií]stic/i.test(x.materia))) conceptos.push('alarife');
    const memo = [
      f('funcNombre', 'Funcionario que lleva los fondos', nombreFuncionario, rf),
      f('ini', 'Comisión desde', desde, rf), f('fin', 'Comisión hasta', hasta, rf),
      f('equipo', 'Quienes realizan la comisión', equipo, rf, 'media'),
      f('conceptos', 'Conceptos del gasto', conceptos, 'Boletas y facturas (arriendo de caballos / alarife)', 'media'),
      f('montoInfo', 'Total autorizado', fondos ? `$${A.clp(fondos)}` : '', rf, 'alta', { aplicar: false, soloInfo: true }),
    ];

    // ---- Informe de cometido
    const itin = diasEntre(desde, hasta).map(d => ({ fecha: d, actividad: '', horas: '' }));
    const informe = [
      f('resolucion', 'Res. N°', c.ra, rf), f('fechaResolucion', 'Fecha de resolución', c.fecha, rf),
      f('solicitud', 'Solicitud N°', c.autorizacion, rf + ' (autorización)'),
      f('fechaSalida', 'Fecha de salida', desde, rf), f('fechaLlegada', 'Fecha de llegada', hasta, rf),
      f('ubic', 'Ubicación', [{ medio: '', region: yo.region || '', comuna: yo.comuna || '', localidad: '', faena: '' }], rf, 'media'),
      f('nombre', 'Nombre', nombreFuncionario, rf), f('rut', 'RUT', yo.rut, rf),
      f('categoria', 'Categoría', (c.categoria && c.categoria[0]) || '', rf, 'media'),
      f('estamento', 'Estamento', c.categoria && c.categoria[1] ? A.titulo(c.categoria[1]) : '', rf, 'media'),
      f('objetivo', 'Objetivo del cometido', limpiarObjetivo(c.objetivo || ''), rf, 'media'),
      f('itin', 'Itinerario (un día por fila, sin actividades)', itin, rf, 'media', { detalle: `${itin.length} días` }),
    ];
    return { rendicion, memo, informe, avisos };
  };

  A.clp = n => Math.round(n || 0).toLocaleString('es-CL');

  /** Arma el objeto de cada formulario: parte del estado actual y sobreescribe solo los campos marcados. */
  A.aplicarSeleccion = function (actual, campos) {
    const out = Object.assign({}, actual);
    const docs = [];
    campos.filter(c => c.aplicar && !c.soloInfo).forEach(c => { if (c.tipoCampo === 'doc') docs.push(c.valor); else out[c.k] = c.valor; });
    if (docs.length) out.docs = docs;
    return out;
  };
})(typeof window !== 'undefined' ? window : globalThis);
if (typeof module !== 'undefined') module.exports = globalThis.Asistente;
