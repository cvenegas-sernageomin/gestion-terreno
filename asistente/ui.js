/* Asistente — interfaz: elegir carpeta/archivos, leer PDFs en el navegador, revisar y aplicar a los formularios.
   Todo ocurre en este equipo: los documentos se leen en memoria y no se suben a ningún servidor. */
(function () {
  'use strict';
  const A = window.Asistente;
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const LS_RUT = 'asistente_rut_v1';
  const MAX_ARCHIVOS = 300;
  const estado = { docs: [], vistos: new Set(), campos: null, cometidos: [], leyendo: false };

  if (window.pdfjsLib) window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';

  const NOMBRE_TIPO = { resolucion: 'Resolución de cometido', boleta_honorarios: 'Boleta de honorarios', factura: 'Factura', comprobante_transferencia: 'Comprobante de transferencia',
    boleta_comercio: 'Boleta/voucher', otro: 'Otro documento', escaneado: 'PDF escaneado (sin texto)' };

  function aviso(t) { $('asistEstado').textContent = t; }

  async function listarDirectorio(handle, ruta, out, prof) {
    for await (const [nombre, h] of handle.entries()) {
      if (out.length >= MAX_ARCHIVOS) return;
      if (h.kind === 'directory') { if (prof < 4) await listarDirectorio(h, ruta + nombre + '/', out, prof + 1); }
      else if (/\.pdf$/i.test(nombre)) out.push({ h, ruta: ruta + nombre });
    }
  }

  async function leerArchivos(items) {   // items: [{file|h, ruta}]
    if (!window.pdfjsLib) { aviso('No se pudo cargar el lector de PDF (pdf.js).'); return; }
    estado.leyendo = true;
    let n = 0;
    for (const it of items) {
      n++;
      aviso(`Leyendo ${n} de ${items.length}: ${it.ruta}`);
      try {
        const file = it.file || await it.h.getFile();
        const clave = it.ruta + '|' + file.size;
        if (estado.vistos.has(clave)) continue;
        estado.vistos.add(clave);
        const pag = await A.leerPdf(window.pdfjsLib, await file.arrayBuffer());
        const texto = pag.map(p => p.texto).join('\n');
        let tipo = A.clasificar(texto), datos = null;
        if (A.plano(texto).length < 40) tipo = 'escaneado';
        else if (tipo === 'resolucion') { datos = A.parseResolucion(pag); datos.archivo = it.ruta; }
        else if (tipo === 'boleta_honorarios' || tipo === 'factura' || tipo === 'comprobante_transferencia') { datos = A.parseDocumento(texto); datos.archivo = it.ruta; }
        estado.docs.push({ ruta: it.ruta, tipo, datos });
      } catch (e) {
        estado.docs.push({ ruta: it.ruta, tipo: 'otro', datos: null, error: e.message });
      }
    }
    estado.leyendo = false;
    aviso(`${estado.docs.length} PDF leídos.`);
    refrescar();
  }

  $('asistBtnCarpeta').addEventListener('click', async () => {
    if (!window.showDirectoryPicker) { aviso('Este navegador no permite elegir carpetas. Usa «Elegir archivos» (Chrome o Edge de escritorio sí lo permiten).'); return; }
    try {
      const dir = await window.showDirectoryPicker({ mode: 'read' });
      const items = []; await listarDirectorio(dir, dir.name + '/', items, 0);
      if (items.length >= MAX_ARCHIVOS) aviso(`Se leerán solo los primeros ${MAX_ARCHIVOS} PDF; elige una carpeta más específica.`);
      await leerArchivos(items);
    } catch (e) { if (e.name !== 'AbortError') aviso('No se pudo leer la carpeta: ' + e.message); }
  });
  $('asistBtnArchivos').addEventListener('click', () => $('asistFile').click());
  $('asistFile').addEventListener('change', async e => {
    await leerArchivos(Array.from(e.target.files).map(f => ({ file: f, ruta: f.webkitRelativePath || f.name })));
    e.target.value = '';
  });
  $('asistBtnLimpiar').addEventListener('click', () => { estado.docs = []; estado.vistos = new Set(); estado.campos = null; aviso('Listo: no hay documentos cargados.'); refrescar(); });

  const card = $('asistCardDocs');
  ['dragover', 'drop'].forEach(ev => card.addEventListener(ev, e => e.preventDefault()));
  card.addEventListener('drop', async e => {
    const files = Array.from(e.dataTransfer.files).filter(f => /\.pdf$/i.test(f.name));
    if (files.length) await leerArchivos(files.map(f => ({ file: f, ruta: f.name })));
  });

  function ventana(c, yo) {
    const sumar = (iso, d) => { const x = new Date(iso + 'T00:00:00'); x.setDate(x.getDate() + d); return x.toISOString().slice(0, 10); };
    return [sumar(yo.desde || c.fecha, -10), sumar(yo.hasta || c.fecha, 60)];
  }

  function refrescar() {
    // lista de documentos
    const cuenta = {};
    estado.docs.forEach(d => { cuenta[d.tipo] = (cuenta[d.tipo] || 0) + 1; });
    $('asistDocs').innerHTML = estado.docs.length ? Object.keys(cuenta).map(t => `<li><b>${esc(NOMBRE_TIPO[t] || t)}</b>: ${cuenta[t]}</li>`).join('') : '<li class="nota">Aún no hay documentos.</li>';
    const esc_ = estado.docs.filter(d => d.tipo === 'escaneado').length;
    $('asistEscaneados').style.display = esc_ ? '' : 'none';
    $('asistEscaneados').textContent = esc_ ? `${esc_} PDF sin texto (escaneados) no se pueden leer: tendrás que ingresar esos datos a mano.` : '';

    // cometidos
    const res = estado.docs.filter(d => d.tipo === 'resolucion').map(d => d.datos);
    estado.cometidos = A.agruparResoluciones(res);
    const selC = $('asistCometido'), prevC = selC.value;
    selC.innerHTML = estado.cometidos.map((c, i) => {
      const f0 = c.funcionarios[0] || {};
      return `<option value="${i}">${esc(c.ra)} · ${esc(f0.desde || '')} → ${esc(f0.hasta || '')} · ${c.funcionarios.length} funcionario(s)</option>`;
    }).join('') || '<option value="">— sin resolución —</option>';
    if (prevC && estado.cometidos[+prevC]) selC.value = prevC;
    llenarYo();
    analizar();
  }

  function llenarYo() {
    const c = estado.cometidos[+$('asistCometido').value];
    const sel = $('asistYo'), prev = sel.value;
    const guardado = (() => { try { return localStorage.getItem(LS_RUT) || ''; } catch (e) { return ''; } })();
    sel.innerHTML = '<option value="">— elige quién eres —</option>' + (c ? c.funcionarios.map(f => `<option value="${esc(f.rut)}">${esc(f.nombre)} (${esc(f.rut)})</option>`).join('') : '');
    const elegido = [prev, guardado].find(r => r && c && c.funcionarios.some(f => f.rut === r));
    if (elegido) sel.value = elegido;
  }
  $('asistCometido').addEventListener('change', () => { llenarYo(); analizar(); });
  $('asistYo').addEventListener('change', () => { try { localStorage.setItem(LS_RUT, $('asistYo').value); } catch (e) { } analizar(); });
  ['asistChkRend', 'asistChkMemo', 'asistChkInf'].forEach(id => $(id).addEventListener('change', renderRevision));

  function analizar() {
    const c = estado.cometidos[+$('asistCometido').value];
    const yo = c && A.eligeFuncionario(c, $('asistYo').value);
    if (!c || !yo) { estado.campos = null; renderRevision(); return; }
    const [d0, d1] = ventana(c, yo);
    const gas = estado.docs.filter(d => (d.tipo === 'boleta_honorarios' || d.tipo === 'factura') && d.datos).map(d => d.datos);
    const dentro = gas.filter(g => !g.fecha || (g.fecha >= d0 && g.fecha <= d1));
    const fuera = gas.filter(g => !dentro.includes(g));
    const comp = (estado.docs.filter(d => d.tipo === 'comprobante_transferencia' && d.datos && d.datos.esReintegro).map(d => d.datos)[0]) || null;
    estado.campos = A.construirCampos(c, yo, dentro, comp);
    estado.campos.fuera = fuera;
    estado.campos.cometido = c;
    renderRevision();
  }

  const BADGE = { alta: '#2e7d46', media: '#b5651d', baja: '#c0392b' };
  function filaCampo(c, idx, key) {
    const v = c.tipoCampo === 'doc' ? c.detalle : (Array.isArray(c.valor) ? (c.detalle || c.valor.map(x => typeof x === 'object' ? JSON.stringify(x) : x).join(', ')) : c.valor);
    return `<tr><td>${c.soloInfo ? '' : `<input type="checkbox" data-form="${key}" data-i="${idx}" ${c.aplicar ? 'checked' : ''}>`}</td>
      <td>${esc(c.label)}</td><td>${esc(v)}</td><td class="nota">${esc(c.fuente)}</td><td><span style="color:${BADGE[c.conf]};font-weight:600">${esc(c.conf)}</span></td></tr>`;
  }
  function tabla(titulo, key, lista) {
    return `<h3 style="font-size:14px;margin:14px 0 4px;color:var(--nar-osc);">${titulo}</h3>
      <table class="asist-tabla"><thead><tr><th></th><th>Campo</th><th>Valor</th><th>Fuente</th><th>Confianza</th></tr></thead><tbody>${lista.map((c, i) => filaCampo(c, i, key)).join('')}</tbody></table>`;
  }

  function renderRevision() {
    const cont = $('asistRevision'), btn = $('asistBtnAplicar');
    const k = estado.campos;
    if (!k) {
      cont.innerHTML = '<p class="nota">Carga la resolución de cometido y elige quién eres para ver qué se puede llenar.</p>';
      btn.disabled = true; return;
    }
    let h = '';
    if ($('asistChkRend').checked) h += tabla('Rendición de cuentas', 'rendicion', k.rendicion);
    if ($('asistChkMemo').checked) h += tabla('Memo de fondos a rendir', 'memo', k.memo);
    if ($('asistChkInf').checked) h += tabla('Informe de cometido', 'informe', k.informe);
    if (k.fuera && k.fuera.length) h += `<p class="nota">No incluidos por fecha (fuera del cometido): ${k.fuera.map(g => esc(`${g.proveedor} N°${g.num} (${g.fecha})`)).join('; ')}.</p>`;
    if (k.avisos.length) h += `<div class="aviso warn">${k.avisos.map(esc).join('<br>')}</div>`;
    cont.innerHTML = h;
    btn.disabled = false;
    cont.querySelectorAll('input[type=checkbox][data-form]').forEach(ch => ch.addEventListener('change', () => { k[ch.dataset.form][+ch.dataset.i].aplicar = ch.checked; }));
  }

  function irA(topId, subId) {
    $(topId).click();
    if (subId) $(subId).click();
  }

  $('asistBtnAplicar').addEventListener('click', () => {
    const k = estado.campos; if (!k) return;
    const hecho = [];
    if ($('asistChkRend').checked) {
      const actual = recolectarRend();
      const usaDocs = k.rendicion.some(c => c.tipoCampo === 'doc' && c.aplicar);
      if (!(usaDocs && actual.docs.length) || confirm('La Rendición ya tiene documentos. ¿Reemplazarlos por los leídos?')) {
        aplicarRend(A.aplicarSeleccion(actual, k.rendicion)); hecho.push(['Rendición de cuentas', 'topBtnPost', 'postBtnRend']);
      }
    }
    if ($('asistChkMemo').checked) {
      const actual = recolectarMemo();
      const out = A.aplicarSeleccion(actual, k.memo);
      const cc = k.memo.find(c => c.k === 'conceptos');
      if (cc && cc.aplicar && out.conceptos && out.conceptos.length) { const j = construirJustificacion(out.conceptos); out.motivo = j.motivo; out.puntos = j.puntos; }
      aplicarMemo(Object.assign({}, MEMO_DEFECTO, out)); hecho.push(['Memo de fondos a rendir', 'topBtnPre', 'tabBtnMemo']);
    }
    if ($('asistChkInf').checked) {
      const datos = {};
      k.informe.filter(c => c.aplicar).forEach(c => { datos[c.k] = c.valor; });
      enviarInforme(datos); hecho.push(['Informe de cometido', 'topBtnPost', 'postBtnInforme']);
    }
    const pend = [];
    if ($('asistChkRend').checked) pend.push('Rendición: agrega las boletas/comprobantes que no se pudieron leer (escaneados o de comercio), revisa mes e imputación.');
    if ($('asistChkMemo').checked) pend.push('Memo: faltan N° de memo, fecha, proyecto y las líneas de monto.');
    if ($('asistChkInf').checked) pend.push('Informe: faltan actividades y horas por día, medio de transporte y firma.');
    $('asistResultado').innerHTML = `<p><b>Aplicado.</b> Revisa cada formulario y completa lo que falta:</p><ul>${pend.map(p => `<li>${esc(p)}</li>`).join('')}</ul>
      <div class="fila-botones">${hecho.map(([n, t, s], i) => `<button class="btn secundario" data-ir="${i}" type="button">Ir a ${esc(n)}</button>`).join('')}</div>`;
    $('asistResultado').querySelectorAll('[data-ir]').forEach(b => b.addEventListener('click', () => irA(hecho[+b.dataset.ir][1], hecho[+b.dataset.ir][2])));
  });

  function enviarInforme(datos) {
    const fr = $('frameInforme');
    const enviar = () => fr.contentWindow.postMessage({ tipo: 'gt-informe', datos }, location.origin);
    if (fr.dataset.ok === '1') { enviar(); return; }
    fr.addEventListener('load', enviar, { once: true });
    if (!fr.getAttribute('src')) fr.setAttribute('src', fr.dataset.src);
  }
  $('frameInforme').addEventListener('load', () => { $('frameInforme').dataset.ok = '1'; });

  refrescar();
})();
