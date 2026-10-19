'use strict';
const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const LS = 'informe-cometido-v1';
const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const $ = (s, r = document) => r.querySelector(s);

const vacio = () => ({
  fechaSolicitud: '', resolucion: '', fechaResolucion: '', solicitud: '',
  fechaSalida: '', horaSalida: '', fechaLlegada: '', horaLlegada: '',
  ubic: [{ medio: '', region: '', comuna: '', localidad: '', faena: '' }],
  nombre: '', rut: '', categoria: '', estamento: '', objetivo: '',
  itin: [{ fecha: '', actividad: '', horas: '' }],
  desc: [], firma: true
});
let S = vacio();

/* ---------- utilidades ---------- */
const fmt = iso => { const m = /^(\d{4})-(\d\d)-(\d\d)$/.exec(iso || ''); return m ? `${m[3]}/${m[2]}/${m[1]}` : (iso || ''); };
const dia = iso => { const m = /^(\d{4})-(\d\d)-(\d\d)$/.exec(iso || ''); return m ? DIAS[new Date(+m[1], +m[2] - 1, +m[3]).getDay()] : ''; };
const addDays = (iso, n) => { const [y, m, d] = iso.split('-').map(Number); const t = new Date(y, m - 1, d + n); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`; };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function toast(t) { const m = $('#msg'); m.textContent = t; m.classList.add('on'); clearTimeout(toast.h); toast.h = setTimeout(() => m.classList.remove('on'), 2200); }
function guardar() { try { localStorage.setItem(LS, JSON.stringify(S)); } catch (e) { } }

/* ---------- formulario ---------- */
function filaHTML(tipo, r, i) {
  if (tipo === 'ubic') return `<div class="row"><button class="x" data-del="ubic" data-i="${i}" title="Quitar">×</button><div class="g">
    <label>Medio de transporte<input data-l="ubic" data-i="${i}" data-f="medio" value="${esc(r.medio)}" list="medios"></label>
    <label>Región<input data-l="ubic" data-i="${i}" data-f="region" value="${esc(r.region)}"></label>
    <label>Comuna<input data-l="ubic" data-i="${i}" data-f="comuna" value="${esc(r.comuna)}"></label>
    <label>Localidad<input data-l="ubic" data-i="${i}" data-f="localidad" value="${esc(r.localidad)}"></label>
    <label>ID. Faena<input data-l="ubic" data-i="${i}" data-f="faena" value="${esc(r.faena)}"></label></div></div>`;
  if (tipo === 'itin') return `<div class="row"><button class="x" data-del="itin" data-i="${i}" title="Quitar">×</button><div class="g" style="grid-template-columns:150px 1fr 90px">
    <label>Fecha<input type="date" data-l="itin" data-i="${i}" data-f="fecha" value="${esc(r.fecha)}"></label>
    <label>Actividad<textarea rows="2" data-l="itin" data-i="${i}" data-f="actividad">${esc(r.actividad)}</textarea></label>
    <label>Horas<input type="number" min="0" step="0.5" data-l="itin" data-i="${i}" data-f="horas" value="${esc(r.horas)}"></label></div></div>`;
  return `<div class="row"><button class="x" data-del="desc" data-i="${i}" title="Quitar">×</button><div class="g" style="grid-template-columns:150px 150px 1fr 90px">
    <label>Fecha<input type="date" data-l="desc" data-i="${i}" data-f="fecha" value="${esc(r.fecha)}"></label>
    <label>Día<input data-l="desc" data-i="${i}" data-f="dia" value="${esc(r.dia)}" placeholder="${esc(dia(r.fecha))}"></label>
    <label>Actividad<textarea rows="2" data-l="desc" data-i="${i}" data-f="actividad">${esc(r.actividad)}</textarea></label>
    <label>Horas<input type="number" min="0" step="0.5" data-l="desc" data-i="${i}" data-f="horas" value="${esc(r.horas)}"></label></div></div>`;
}
function totales() {
  const t = a => a.reduce((s, r) => s + (parseFloat(r.horas) || 0), 0);
  $('#totItin').textContent = `Total: ${t(S.itin)} h`;
  $('#totDesc').textContent = S.desc.length ? `Total: ${t(S.desc)} h` : '';
}
function render() {
  document.querySelectorAll('[data-k]').forEach(e => e.value = S[e.dataset.k] || '');
  mostrarFirma();
  for (const t of ['ubic', 'itin', 'desc']) $('#' + t).innerHTML = S[t].map((r, i) => filaHTML(t, r, i)).join('');
  if (!$('#medios')) document.body.insertAdjacentHTML('beforeend', '<datalist id="medios"><option>Camioneta institucional</option><option>Vehículo institucional</option><option>Bus</option><option>Avión</option><option>Vehículo particular</option></datalist>');
  totales();
}
document.addEventListener('input', e => {
  const t = e.target;
  if (t.dataset.k) S[t.dataset.k] = t.value;
  else if (t.dataset.l) {
    const r = S[t.dataset.l][+t.dataset.i]; r[t.dataset.f] = t.value;
    if (t.dataset.l === 'desc' && t.dataset.f === 'fecha') {
      const d = t.closest('.row').querySelector('[data-f=dia]'); d.placeholder = dia(t.value);
    }
  }
  totales(); guardar();
});
document.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.del) { S[b.dataset.del].splice(+b.dataset.i, 1); render(); guardar(); }
});
const add = (t, r) => () => { S[t].push(r()); render(); guardar(); };
$('#aUbic').onclick = add('ubic', () => ({ medio: '', region: '', comuna: '', localidad: '', faena: '' }));
$('#aItin').onclick = add('itin', () => {
  const u = S.itin[S.itin.length - 1];
  return { fecha: u && u.fecha ? addDays(u.fecha, 1) : '', actividad: '', horas: '' };
});
$('#aDesc').onclick = add('desc', () => ({ fecha: '', dia: '', actividad: '', horas: '' }));
$('#aRango').onclick = () => {
  if (!S.fechaSalida || !S.fechaLlegada || S.fechaLlegada < S.fechaSalida) return toast('Indique fechas de salida y llegada válidas');
  const ex = new Set(S.itin.map(r => r.fecha)); const nuevo = [];
  for (let f = S.fechaSalida, n = 0; f <= S.fechaLlegada && n < 90; f = addDays(f, 1), n++) if (!ex.has(f)) nuevo.push({ fecha: f, actividad: '', horas: '' });
  S.itin = S.itin.filter(r => r.fecha || r.actividad || r.horas).concat(nuevo).sort((a, b) => a.fecha.localeCompare(b.fecha));
  render(); guardar();
};
$('#aDescIt').onclick = () => {
  const txt = S.itin.filter(r => r.fecha).map((r, i) => `${i + 1}) ${fmt(r.fecha)} — ${r.actividad.slice(0, 50)}`).join('\n');
  if (!txt) return toast('El itinerario no tiene fechas');
  const sel = prompt('Números de los días a copiar, separados por coma (ej. 5,6,7):\n\n' + txt);
  if (!sel) return;
  const con = S.itin.filter(r => r.fecha);
  for (const n of sel.split(/[,\s]+/).map(Number)) {
    const r = con[n - 1]; if (r) S.desc.push({ fecha: r.fecha, dia: '', actividad: r.actividad, horas: r.horas });
  }
  render(); guardar();
};
$('#bNuevo').onclick = () => { if (confirm('¿Borrar el formulario y empezar uno nuevo?')) { S = vacio(); render(); guardar(); } };

/* ---------- firma (solo en este dispositivo, nunca va en el JSON) ---------- */
const LSF = 'informe-cometido-firma';
const firma = () => { try { return localStorage.getItem(LSF) || ''; } catch (e) { return ''; } };
function mostrarFirma() {
  const f = firma(), im = $('#pFirma');
  im.style.display = f ? '' : 'none'; if (f) im.src = f; $('#qFirma').style.display = f ? '' : 'none';
}
$('#fFirma').onchange = e => {
  const file = e.target.files[0]; if (!file) return;
  const img = new Image(), url = URL.createObjectURL(file);
  img.onload = () => {
    const k = Math.min(1, 800 / img.width), c = document.createElement('canvas');
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    try { localStorage.setItem(LSF, c.toDataURL('image/png')); } catch (x) { toast('No se pudo guardar la firma'); }
    URL.revokeObjectURL(url); mostrarFirma(); e.target.value = '';
  };
  img.src = url;
};
$('#qFirma').onclick = () => { try { localStorage.removeItem(LSF); } catch (e) { } mostrarFirma(); };

/* ---------- guardar / abrir JSON ---------- */
function descargar(blob, nombre) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nombre;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
$('#bGuardar').onclick = () => descargar(new Blob([JSON.stringify(S, null, 1)], { type: 'application/json' }), nombreArchivo().replace(/\.docx$/, '.json'));
$('#bCargar').onclick = () => $('#fJson').click();
$('#fJson').onchange = async e => {
  const f = e.target.files[0]; if (!f) return;
  try { S = Object.assign(vacio(), JSON.parse(await f.text())); render(); guardar(); toast('Informe cargado'); } catch (x) { toast('Archivo inválido'); }
  e.target.value = '';
};

/* ---------- exportar a Word (rellena la plantilla original) ---------- */
function nombreArchivo() {
  const f = S.fechaSalida || S.fechaSolicitud;
  const tag = f ? f.slice(2, 4) + f.slice(5, 7) : '';
  const nom = (S.nombre || '').trim().split(/\s+/);
  const ap = nom.length > 1 ? nom[nom.length - 1] : nom[0] || '';
  return `INFORME DE TÉCNICO COMETIDO FUNCIONARIO_${ap}${tag}.docx`.replace(/[\\/:*?"<>|]/g, '');
}
const kids = (el, tag) => [...el.childNodes].filter(n => n.nodeType === 1 && n.localName === tag);
const rowsOf = tbl => kids(tbl, 'tr');
const cellsOf = tr => kids(tr, 'tc');
const parasOf = tc => kids(tc, 'p');

/* Reescribe un párrafo: etiqueta (formato del primer run) + valor (formato del último run) */
function setPara(p, label, value) {
  const runs = kids(p, 'r');
  const rpr = r => r && kids(r, 'rPr')[0];
  const first = rpr(runs[0]), last = rpr(runs[runs.length - 1]);
  [...p.childNodes].forEach(n => { if (n.localName !== 'pPr') p.removeChild(n); });
  const mk = (text, pr) => {
    const r = p.ownerDocument.createElementNS(W, 'w:r');
    if (pr) r.appendChild(pr.cloneNode(true));
    const t = p.ownerDocument.createElementNS(W, 'w:t');
    t.setAttribute('xml:space', 'preserve'); t.textContent = text; r.appendChild(t); p.appendChild(r);
  };
  if (label) mk(label, first);
  if (value) mk((label ? ' ' : '') + value, label ? last : first);
}
function limpiarIds(el) {
  const strip = n => { if (n.nodeType !== 1) return; for (const a of [...n.attributes]) if (/paraId|textId|rsid/i.test(a.name)) n.removeAttribute(a.name); [...n.childNodes].forEach(strip); };
  strip(el);
}
function clonarFila(proto, valores) {
  const tr = proto.cloneNode(true); limpiarIds(tr);
  cellsOf(tr).forEach((tc, i) => { const ps = parasOf(tc); setPara(ps[0], '', valores[i] || ''); ps.slice(1).forEach(p => tc.removeChild(p)); });
  return tr;
}

async function exportar() {
  if (!S.nombre.trim()) { if (!confirm('El nombre del funcionario está vacío. ¿Exportar igual?')) return; }
  const zip = await JSZip.loadAsync(window.TEMPLATE_B64, { base64: true });
  const xml = await zip.file('word/document.xml').async('string');
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const body = doc.getElementsByTagNameNS(W, 'body')[0];
  const tbl = kids(body, 'tbl')[0];
  const R = rowsOf(tbl);
  if (R.length !== 29) { toast('La plantilla interna no coincide (filas: ' + R.length + ')'); return; }
  const P = (ri, ci, pi = 0) => parasOf(cellsOf(R[ri])[ci])[pi];

  // encabezado
  setPara(P(1, 0), 'FECHA DE SOLICITUD:', fmt(S.fechaSolicitud));
  setPara(P(1, 1), 'RES. N°', S.resolucion);
  setPara(P(1, 2), 'FECHA DE RESOLUCIÓN:', fmt(S.fechaResolucion));
  setPara(P(2, 0), 'Solicitud N°:', S.solicitud);
  setPara(P(3, 0), 'Fecha de Salida:', fmt(S.fechaSalida));
  setPara(P(3, 1), 'Hora de Salida:', S.horaSalida);
  setPara(P(3, 2), 'Fecha de llegada:', fmt(S.fechaLlegada));
  setPara(P(3, 3), 'Hora de llegada:', S.horaLlegada);

  // ubicaciones (fila 6 = prototipo)
  const u = S.ubic.length ? S.ubic : [{ medio: '', region: '', comuna: '', localidad: '', faena: '' }];
  const uRows = u.map(x => clonarFila(R[6], [x.medio, x.region, x.comuna, x.localidad, x.faena]));
  uRows.forEach(tr => tbl.insertBefore(tr, R[6])); tbl.removeChild(R[6]);

  // funcionario
  setPara(P(8, 0, 0), 'NOMBRE:', S.nombre);
  setPara(P(8, 0, 1), 'RUT:', S.rut);
  setPara(P(8, 1, 0), 'CATEGORÍA:', S.categoria);
  setPara(P(8, 1, 1), 'ESTAMENTO:', S.estamento);
  setPara(P(10, 0), '', S.objetivo);

  // itinerario: filas 13..23 (8 con datos + 3 vacías); prototipo = fila 13
  const itProto = R[13];
  const itRows = S.itin.filter(r => r.fecha || r.actividad || r.horas)
    .map(r => clonarFila(itProto, [fmt(r.fecha), r.actividad, r.horas]));
  for (let i = 13; i <= 23; i++) tbl.removeChild(R[i]);
  itRows.forEach(tr => tbl.insertBefore(tr, R[24]));

  // descanso complementario: filas 26..28; prototipo = fila 26
  const dsProto = R[26];
  const dRows = S.desc.filter(r => r.fecha || r.actividad || r.horas)
    .map(r => clonarFila(dsProto, [fmt(r.fecha), r.dia || dia(r.fecha), r.actividad, r.horas]));
  for (let i = 26; i <= 28; i++) tbl.removeChild(R[i]);
  if (dRows.length) dRows.forEach(tr => tbl.appendChild(tr));
  else { tbl.removeChild(R[24]); tbl.removeChild(R[25]); }   // sin descanso: se quita la sección

  // firma
  const fd = firma();
  for (const p of kids(body, 'p')) {
    const dr = p.getElementsByTagNameNS(W, 'drawing')[0]; if (!dr) continue;
    if (!fd) { [...p.childNodes].forEach(n => { if (n.localName !== 'pPr') p.removeChild(n); }); continue; }
    const img = await new Promise(ok => { const i = new Image(); i.onload = () => ok(i); i.src = fd; });
    const h = 709930, w = Math.round(h * img.width / img.height);
    dr.querySelectorAll('*').forEach(n => {
      if (n.localName === 'extent' || (n.localName === 'ext' && n.hasAttribute('cx'))) { n.setAttribute('cx', w); n.setAttribute('cy', h); }
    });
    zip.file('word/media/image1.png', fd.split(',')[1], { base64: true });
  }
  zip.file('word/document.xml', new XMLSerializer().serializeToString(doc));
  const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', compression: 'DEFLATE' });
  descargar(blob, nombreArchivo());
  toast('Word exportado');
}
$('#bWord').onclick = () => exportar().catch(e => { console.error(e); toast('Error al exportar: ' + e.message); });

/* ---------- arranque ---------- */
try { const g = JSON.parse(localStorage.getItem(LS) || 'null'); if (g) S = Object.assign(vacio(), g); } catch (e) { }
render();

window.__S = () => S; window.__exportar = exportar;
