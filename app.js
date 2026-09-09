/* ============================================================================
   app.js — Lógica del dashboard de gestión de Intercambios (CRFPTIC)
   ----------------------------------------------------------------------------
   - Muestra y filtra el catálogo público de centros (data.js), igual que el
     dashboard original.
   - Al hacer clic en una ficha pide la clave de administrador (Firebase
     Authentication) y, si es correcta, abre el formulario editable.
   - Los datos de gestión (coordinador, fechas, memorias, incidencias) se
     guardan en Firestore, colección "centros", un documento por código de
     centro. Solo un administrador autenticado puede leerlos o escribirlos
     (ver firestore.rules).
   ============================================================================ */
(function () {
  "use strict";

  // ---------------------------------------------------------------------
  // Firebase
  // ---------------------------------------------------------------------
  firebase.initializeApp(FIREBASE_CONFIG);
  var auth = firebase.auth();
  var db = firebase.firestore();

  var isAdmin = false;
  var gestionData = {};      // codigo -> doc de Firestore (o {} si aún no existe)
  var gestionUnsub = null;
  var pendingOpenCodigo = null; // ficha que el usuario quería abrir antes de logarse

  // ---------------------------------------------------------------------
  // Utilidades
  // ---------------------------------------------------------------------
  function alumnosTotal(centro) {
    return centro.d.reduce(function (s, pair) { return s + pair[1]; }, 0);
  }
  function fmtEUR(n) { return (n || 0).toLocaleString('es-ES') + ' €'; }
  function fmtNum(n) { return (n || 0).toLocaleString('es-ES'); }
  function normalize(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
  function byId(id) { return document.getElementById(id); }
  function centroByCodigo(c) { return CENTROS.find(function (x) { return x.c === c; }); }

  function emptyGestion() {
    return {
      coordinador: { nombre: '', correo: '' },
      destinos: {},
      memoriaIntercambio: { entregada: false, fecha: '' },
      memoriaEconomica: {
        apuntes: { ok: false, fecha: '' },
        listado: { ok: false, fecha: '' }
      },
      devolucion: { importe: '', solicitada: false, hecha: false },
      incidencias: [],
      seguimiento: [],
      actualizadoEn: null,
      actualizadoPor: ''
    };
  }
  function destinoDefault() {
    return { destino: { inicio: '', fin: '' }, cyl: { inicio: '', fin: '' } };
  }
  // Estado "en vivo" de un destino según las fechas guardadas por el admin:
  // 'alli'  -> hoy cae dentro del viaje de alumnado español a ese país
  // 'aqui'  -> hoy cae dentro de la estancia del alumnado extranjero en CyL
  // null    -> no hay fechas guardadas, o hoy no cae en ninguna de las dos
  function estadoDestino(vals) {
    if (!vals) return null;
    var hoy = todayStamp();
    var d = vals.destino, c = vals.cyl;
    if (d && d.inicio && d.fin && hoy >= d.inicio && hoy <= d.fin) return 'alli';
    if (c && c.inicio && c.fin && hoy >= c.inicio && hoy <= c.fin) return 'aqui';
    return null;
  }
  // Normaliza el campo incidencias: admite el formato antiguo (un texto suelto)
  // y lo convierte en una entrada más del listado nuevo, para no perder nada
  // de lo que ya se hubiera escrito antes de este cambio. También añade los
  // campos "leida"/"gestionada" a incidencias antiguas que no los tenían
  // (se consideran sin leer hasta que un administrador las marque).
  function normalizeIncidencias(raw) {
    var arr;
    if (Array.isArray(raw)) arr = raw;
    else if (typeof raw === 'string' && raw.trim()) arr = [{ fecha: '', autor: '', texto: raw.trim() }];
    else arr = [];
    return arr.map(function (inc) {
      return {
        fecha: inc.fecha || '',
        autor: inc.autor || '',
        texto: inc.texto || '',
        leida: !!inc.leida,
        gestionada: !!inc.gestionada
      };
    });
  }
  // Normaliza el campo seguimiento (siempre un listado de eventos con fecha,
  // autor y texto, igual que incidencias pero sin estado de leída/gestionada).
  function normalizeSeguimiento(raw) {
    if (!Array.isArray(raw)) return [];
    return raw.map(function (ev) {
      return { fecha: ev.fecha || '', autor: ev.autor || '', texto: ev.texto || '' };
    });
  }
  function getGestion(codigo) {
    var g = gestionData[codigo];
    if (!g) return emptyGestion();
    // fusiona con la plantilla vacía por si el documento es antiguo o incompleto
    var base = emptyGestion();
    return Object.assign({}, base, g, {
      coordinador: Object.assign({}, base.coordinador, g.coordinador || {}),
      memoriaIntercambio: Object.assign({}, base.memoriaIntercambio, g.memoriaIntercambio || {}),
      memoriaEconomica: {
        apuntes: Object.assign({}, base.memoriaEconomica.apuntes, (g.memoriaEconomica || {}).apuntes || {}),
        listado: Object.assign({}, base.memoriaEconomica.listado, (g.memoriaEconomica || {}).listado || {})
      },
      devolucion: Object.assign({}, base.devolucion, g.devolucion || {}),
      destinos: g.destinos || {},
      incidencias: normalizeIncidencias(g.incidencias),
      seguimiento: normalizeSeguimiento(g.seguimiento)
    });
  }
  // Nº total de incidencias sin marcar como "leída" en todos los centros
  // (solo tiene sentido para un administrador, que es quien ve estos datos).
  function countIncidenciasSinLeer() {
    if (!isAdmin) return 0;
    var total = 0;
    CENTROS.forEach(function (c) {
      total += getGestion(c.c).incidencias.filter(function (inc) { return !inc.leida; }).length;
    });
    return total;
  }
  function renderUnreadWarning() {
    var box = byId('unreadWarning');
    if (!box) return;
    var n = countIncidenciasSinLeer();
    if (!isAdmin || n === 0) { box.hidden = true; return; }
    box.textContent = n === 1 ? '⚠ ¡1 incidencia sin leer!' : '⚠ ¡' + n + ' incidencias sin leer!';
    box.hidden = false;
  }

  // ---------------------------------------------------------------------
  // Cabecera / stats / gráficos (idéntico al dashboard original)
  // ---------------------------------------------------------------------
  var totalCentros = CENTROS.length;
  var totalAlumnos = CENTROS.reduce(function (s, c) { return s + alumnosTotal(c); }, 0);
  var totalImporte = CENTROS.reduce(function (s, c) { return s + c.im; }, 0);
  var paisTotals = {};
  CENTROS.forEach(function (c) { c.d.forEach(function (pair) { paisTotals[pair[0]] = (paisTotals[pair[0]] || 0) + pair[1]; }); });
  var paisList = Object.keys(paisTotals).sort();
  var paisRanked = Object.keys(paisTotals).map(function (k) { return [k, paisTotals[k]]; }).sort(function (a, b) { return b[1] - a[1]; });
  var provinciaSet = {};
  CENTROS.forEach(function (c) { provinciaSet[c.p] = true; });
  var provinciaList = Object.keys(provinciaSet).sort();
  var pubCentros = PUBLICOS.length, conCentros = CONCERTADOS.length;
  var pubAlumnos = PUBLICOS.reduce(function (s, c) { return s + alumnosTotal(c); }, 0);
  var conAlumnos = CONCERTADOS.reduce(function (s, c) { return s + alumnosTotal(c); }, 0);
  var pubImporte = PUBLICOS.reduce(function (s, c) { return s + c.im; }, 0);
  var conImporte = CONCERTADOS.reduce(function (s, c) { return s + c.im; }, 0);

  function renderHeaderStats() {
    var tiles = [
      { label: "Centros con intercambio", value: fmtNum(totalCentros), sub: pubCentros + " públicos · " + conCentros + " concertados" },
      { label: "Alumnado participante", value: fmtNum(totalAlumnos), sub: pubAlumnos + " públicos · " + conAlumnos + " concertados" },
      { label: "Importe total concedido", value: fmtEUR(totalImporte), sub: fmtEUR(pubImporte) + " · " + fmtEUR(conImporte) },
      { label: "Países de destino", value: fmtNum(paisList.length), sub: "de " + fmtNum(paisRanked.reduce(function (s, x) { return s + x[1]; }, 0)) + " plazas de alumnado" }
    ];
    byId('statsRow').innerHTML = tiles.map(function (t) {
      return '<div class="stat-tile"><div class="label">' + t.label + '</div><div class="value">' + t.value + '</div><div class="sub">' + t.sub + '</div></div>';
    }).join('');
  }
  function renderCountryChart() {
    var maxPais = paisRanked[0][1];
    byId('countryChart').innerHTML = paisRanked.map(function (pair) {
      var pct = Math.max(3, Math.round(pair[1] / maxPais * 100));
      return '<div class="bar-row">'
        + '<div class="country">' + (FLAGS[pair[0]] || '') + ' ' + pair[0] + '</div>'
        + '<div class="bar-track"><div class="bar-fill" style="width:' + pct + '%" title="' + pair[0] + ': ' + pair[1] + ' alumnos/as"></div></div>'
        + '<div class="bar-value mono">' + pair[1] + '</div></div>';
    }).join('');
  }
  function splitBlock(label, aVal, bVal, fmt) {
    var total = aVal + bVal;
    var aPct = Math.round(aVal / total * 100), bPct = 100 - aPct;
    return '<div class="split-block">'
      + '<div class="split-label"><span>' + label + '</span><span class="mono">' + fmt(total) + '</span></div>'
      + '<div class="split-bar">'
      + '<div class="split-seg public" style="width:' + aPct + '%" title="Público: ' + fmt(aVal) + '">' + (aPct >= 12 ? fmt(aVal) : '') + '</div>'
      + '<div class="split-seg concertado" style="width:' + bPct + '%" title="Concertado: ' + fmt(bVal) + '">' + (bPct >= 12 ? fmt(bVal) : '') + '</div>'
      + '</div></div>';
  }
  function renderSplitCharts() {
    byId('splitCharts').innerHTML =
      splitBlock('Centros', pubCentros, conCentros, fmtNum)
      + splitBlock('Alumnado', pubAlumnos, conAlumnos, fmtNum)
      + splitBlock('Importe concedido', pubImporte, conImporte, fmtEUR);
  }

  // ---------------------------------------------------------------------
  // Filtros y listado de fichas
  // ---------------------------------------------------------------------
  var state = { tipo: 'todos', provincia: 'todas', pais: 'todos', q: '', sort: 'alfabetico', estado: 'todos' };
  var currentList = CENTROS.slice();

  function setupFilterControls() {
    var provinciaSelect = byId('provinciaSelect');
    provinciaList.forEach(function (p) {
      var opt = document.createElement('option'); opt.value = p; opt.textContent = p; provinciaSelect.appendChild(opt);
    });
    var paisSelect = byId('paisSelect');
    paisList.forEach(function (p) {
      var opt = document.createElement('option'); opt.value = p; opt.textContent = (FLAGS[p] || '') + ' ' + p; paisSelect.appendChild(opt);
    });
    byId('tipoToggle').addEventListener('click', function (e) {
      var btn = e.target.closest('button'); if (!btn) return;
      state.tipo = btn.getAttribute('data-tipo');
      Array.from(this.querySelectorAll('button')).forEach(function (b) { b.classList.toggle('active', b === btn); });
      applyFilters();
    });
    byId('estadoToggle').addEventListener('click', function (e) {
      var btn = e.target.closest('button'); if (!btn) return;
      state.estado = btn.getAttribute('data-estado');
      Array.from(this.querySelectorAll('button')).forEach(function (b) { b.classList.toggle('active', b === btn); });
      applyFilters();
    });
    provinciaSelect.addEventListener('change', function (e) { state.provincia = e.target.value; applyFilters(); });
    paisSelect.addEventListener('change', function (e) { state.pais = e.target.value; applyFilters(); });
    byId('sortSelect').addEventListener('change', function (e) { state.sort = e.target.value; applyFilters(); });
    byId('searchInput').addEventListener('input', function (e) { state.q = e.target.value; applyFilters(); });
  }

  function applyFilters() {
    var q = normalize(state.q.trim());
    var list = CENTROS.filter(function (c) {
      if (state.tipo !== 'todos' && c.tipo !== state.tipo) return false;
      if (state.provincia !== 'todas' && c.p !== state.provincia) return false;
      if (state.pais !== 'todos' && !c.d.some(function (pair) { return pair[0] === state.pais; })) return false;
      if (q && normalize(c.n).indexOf(q) === -1 && normalize(c.c).indexOf(q) === -1) return false;
      if (state.estado !== 'todos' && isAdmin) {
        var g = getGestion(c.c);
        var match = c.d.some(function (pair) { return estadoDestino(g.destinos[pair[0]]) === state.estado; });
        if (!match) return false;
      }
      return true;
    });
    list.sort(function (a, b) {
      if (state.sort === 'importe') return b.im - a.im;
      if (state.sort === 'alumnos') return alumnosTotal(b) - alumnosTotal(a);
      if (state.sort === 'puntuacion') return b.pt - a.pt;
      return a.n.localeCompare(b.n, 'es');
    });
    currentList = list;
    renderCards(list);
    renderUnreadWarning();
  }

  function gestionBadgesHTML(centro) {
    if (!isAdmin) return '';
    var g = getGestion(centro.c);
    var pills = [];
    pills.push(g.memoriaIntercambio.entregada
      ? '<span class="gpill ok">Memoria ✓</span>'
      : '<span class="gpill pend">Memoria pend.</span>');
    var econOk = g.memoriaEconomica.apuntes.ok && g.memoriaEconomica.listado.ok;
    pills.push(econOk
      ? '<span class="gpill ok">Econ. ✓</span>'
      : '<span class="gpill pend">Econ. pend.</span>');
    if (g.incidencias && g.incidencias.length) pills.push('<span class="gpill warn">⚠ ' + g.incidencias.length + (g.incidencias.length === 1 ? ' incidencia' : ' incidencias') + '</span>');
    return '<div class="gestion-badges">' + pills.join('') + '</div>';
  }

  function renderCards(list) {
    var grid = byId('cardsGrid');
    byId('resultsCount').innerHTML =
      '<span>Mostrando ' + list.length + ' de ' + totalCentros + ' centros con intercambio aprobado</span>'
      + (isAdmin ? '<span class="field-hint">Haz clic en una ficha para editar sus datos de gestión.</span>' : '<span class="field-hint">🔒 Inicia sesión como administrador para abrir y editar fichas.</span>');

    if (list.length === 0) {
      grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;">No hay centros que coincidan con estos filtros.</div>';
      return;
    }
    grid.innerHTML = list.map(function (c) {
      var badgeClass = c.tipo === 'publico' ? 'publico' : 'concertado';
      var badgeText = c.tipo === 'publico' ? 'Público' : 'Concertado';
      var g = isAdmin ? getGestion(c.c) : null;
             var destinosHTML = c.d.map(function (pair) {
        var isMatch = state.pais !== 'todos' && pair[0] === state.pais;
        var estado = g ? estadoDestino(g.destinos[pair[0]]) : null;
        var rowClass = 'dest-row' + (isMatch ? ' match' : '') + (estado ? ' status-' + estado : '');
        var fraseHTML = '';
        if (estado === 'alli') fraseHTML = '<div class="dest-frase frase-alli">🟢 Alumnos españoles allí ahora</div>';
        else if (estado === 'aqui') fraseHTML = '<div class="dest-frase frase-aqui">🔴 Alumnos extranjeros aquí ahora</div>';
        return '<div class="dest-item">'
          + '<div class="' + rowClass + '">'
          + '<div class="dest-name"><span class="flag">' + (FLAGS[pair[0]] || '🏳') + '</span><span class="country-text">' + esc(pair[0]) + '</span></div>'
          + '<div class="dest-count">' + pair[1] + ' alumnos/as</div></div>'
          + fraseHTML
          + '</div>';
      }).join('');
      return '<button type="button" class="card" data-codigo="' + c.c + '">'
        + '<div class="card-head"><div class="card-title">' + esc(c.n) + '</div><div class="badge ' + badgeClass + '">' + badgeText + '</div></div>'
        + '<div class="card-meta"><span>' + esc(c.p) + '</span><span class="mono">Código ' + c.c + '</span></div>'
        + '<div class="card-stats">'
        + '<div class="stat"><div class="k">Puntuación</div><div class="v">' + c.pt.toLocaleString('es-ES') + '</div></div>'
        + '<div class="stat"><div class="k">Alumnado</div><div class="v">' + alumnosTotal(c) + '</div></div>'
        + '<div class="stat importe"><div class="k">Importe concedido</div><div class="v">' + fmtEUR(c.im) + '</div></div>'
        + '</div>'
        + '<div class="destinos"><div class="dhead">Destinos del intercambio</div>' + destinosHTML + '</div>'
        + (c.nota ? '<div class="note">ⓘ ' + esc(c.nota) + '</div>' : '')
        + '<div class="card-footer">' + gestionBadgesHTML(c) + '<span class="lockline">' + (isAdmin ? '✏️ Editar ficha' : '🔒 Ver ficha') + '</span></div>'
        + '</button>';
    }).join('');

    grid.querySelectorAll('.card').forEach(function (card) {
      card.addEventListener('click', function () { onCardClick(card.getAttribute('data-codigo')); });
    });
  }

  function onCardClick(codigo) {
    if (!isAdmin) { pendingOpenCodigo = codigo; openLoginModal(); return; }
    openFichaModal(codigo);
  }

  // ---------------------------------------------------------------------
  // Autenticación de administrador
  // ---------------------------------------------------------------------
  function openLoginModal() {
    byId('loginError').hidden = true;
    byId('loginPassword').value = '';
    byId('loginOverlay').hidden = false;
    byId('loginPassword').focus();
  }
  function closeLoginModal() { byId('loginOverlay').hidden = true; pendingOpenCodigo = null; }

  function setupLogin() {
    byId('openLoginBtn').addEventListener('click', function () { openLoginModal(); });
    byId('loginClose').addEventListener('click', closeLoginModal);
    byId('loginOverlay').addEventListener('click', function (e) { if (e.target === byId('loginOverlay')) closeLoginModal(); });
    byId('logoutBtn').addEventListener('click', function () { auth.signOut(); });

    byId('loginForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var pass = byId('loginPassword').value;
      var nombre = byId('loginNombre').value.trim();
      var box = byId('loginError');
      if (!nombre) {
        box.textContent = 'Escribe tu nombre: queda registrado en cada ficha que guardes.';
        box.hidden = false;
        byId('loginNombre').focus();
        return;
      }
      var submitBtn = byId('loginSubmit');
      submitBtn.disabled = true; submitBtn.textContent = 'Comprobando…';
      auth.signInWithEmailAndPassword(ADMIN_EMAIL, pass)
        .then(function () {
          try { sessionStorage.setItem('adminDisplayName', nombre); } catch (err) { /* ignorar si no hay storage */ }
          closeLoginModalKeepingPending();
        })
        .catch(function (err) {
          var msg = 'No se ha podido iniciar sesión. Inténtalo de nuevo.';
          if (err && (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential' || err.code === 'auth/invalid-login-credentials')) msg = 'Clave de administrador incorrecta.';
          if (err && err.code === 'auth/too-many-requests') msg = 'Demasiados intentos. Espera un momento antes de volver a intentarlo.';
          if (err && err.code === 'auth/network-request-failed') msg = 'No hay conexión con el servidor. Comprueba tu red.';
          var box = byId('loginError'); box.textContent = msg; box.hidden = false;
        })
        .finally(function () { submitBtn.disabled = false; submitBtn.textContent = 'Entrar'; });
    });
  }
  function closeLoginModalKeepingPending() {
    byId('loginOverlay').hidden = true;
    var toOpen = pendingOpenCodigo; pendingOpenCodigo = null;
    if (toOpen) openFichaModal(toOpen);
  }

  auth.onAuthStateChanged(function (user) {
    isAdmin = !!user;
    byId('adminSignedOut').hidden = isAdmin;
    byId('adminSignedIn').hidden = !isAdmin;
    byId('downloadBtn').hidden = !isAdmin;
    byId('estadoToggle').hidden = !isAdmin;
    if (isAdmin) {
      subscribeGestion();
    } else {
      unsubscribeGestion();
      gestionData = {};
      closeFichaModal();
      closeDownloadModal();
      // Sin sesión no hay fechas que consultar: se resetea el filtro para que
      // no quede "escondido" un filtro activo que ya no se puede ver ni tocar.
      state.estado = 'todos';
      var estadoToggle = byId('estadoToggle');
      Array.from(estadoToggle.querySelectorAll('button')).forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-estado') === 'todos'); });
    }
    applyFilters();
  });

  function subscribeGestion() {
    if (gestionUnsub) return;
    gestionUnsub = db.collection('centros').onSnapshot(function (snap) {
      var map = {};
      snap.forEach(function (doc) { map[doc.id] = doc.data(); });
      gestionData = map;
      // applyFilters (no solo renderCards) porque el filtro "Españoles allí / Extranjeros
      // aquí" depende de estas fechas y debe recalcularse en cuanto llegan datos frescos.
      applyFilters();
      if (!byId('fichaOverlay').hidden) refreshOpenFicha();
    }, function (err) {
      console.error('Error leyendo Firestore:', err);
    });
  }
  function unsubscribeGestion() { if (gestionUnsub) { gestionUnsub(); gestionUnsub = null; } }

  // ---------------------------------------------------------------------
  // Ficha editable
  // ---------------------------------------------------------------------
  var fichaCodigoActual = null;
  var fichaIncidenciasActual = []; // copia de trabajo de las incidencias de la ficha abierta

  function fmtFechaCorta(iso) {
    if (!iso) return '';
    var p = iso.split('-');
    if (p.length !== 3) return iso;
    return p[2] + '/' + p[1] + '/' + p[0];
  }

  function incidenciaItemHTML(inc, idx) {
    return '<div class="incidencia-item" data-idx="' + idx + '">'
      + '<div class="incidencia-meta">'
      + '<input type="date" class="inc-fecha mono" data-idx="' + idx + '" value="' + esc(inc.fecha || '') + '">'
      + '<span class="inc-autor mono" title="Administrador que registró esta incidencia">' + (inc.autor ? esc(inc.autor) : '—') + '</span>'
      + '<label class="inc-check-label"><input type="checkbox" class="inc-leida" data-idx="' + idx + '"' + (inc.leida ? ' checked' : '') + '> Leída</label>'
      + '<label class="inc-check-label"><input type="checkbox" class="inc-gestionada" data-idx="' + idx + '"' + (inc.gestionada ? ' checked' : '') + '> Gestionada</label>'
      + '<button type="button" class="btn small ghost inc-delete" data-idx="' + idx + '" aria-label="Eliminar esta incidencia">✕</button>'
      + '</div>'
      + '<textarea class="inc-texto" data-idx="' + idx + '" placeholder="Describe la incidencia…">' + esc(inc.texto || '') + '</textarea>'
      + '</div>';
  }

  function renderIncidenciasList() {
    var wrap = byId('fIncidenciasList');
    if (!fichaIncidenciasActual.length) {
      wrap.innerHTML = '<div class="field-hint">No hay incidencias registradas todavía.</div>';
      return;
    }
    wrap.innerHTML = fichaIncidenciasActual.map(function (inc, idx) { return incidenciaItemHTML(inc, idx); }).join('');
  }

  function readIncidenciasFromDOM() {
    // Vuelca en fichaIncidenciasActual lo que haya en pantalla (fecha, texto y los
    // checks de leída/gestionada editados) antes de leerlo, para no perder cambios
    // hechos a mano en entradas ya existentes.
    document.querySelectorAll('#fIncidenciasList .incidencia-item').forEach(function (item) {
      var idx = Number(item.getAttribute('data-idx'));
      var fecha = item.querySelector('.inc-fecha').value;
      var texto = item.querySelector('.inc-texto').value;
      var leida = item.querySelector('.inc-leida').checked;
      var gestionada = item.querySelector('.inc-gestionada').checked;
      if (fichaIncidenciasActual[idx]) {
        fichaIncidenciasActual[idx].fecha = fecha;
        fichaIncidenciasActual[idx].texto = texto;
        fichaIncidenciasActual[idx].leida = leida;
        fichaIncidenciasActual[idx].gestionada = gestionada;
      }
    });
    // Descarta entradas completamente vacías (añadidas y no rellenadas)
    return fichaIncidenciasActual.filter(function (inc) { return (inc.texto && inc.texto.trim()) || inc.fecha; });
  }

  // ---------------------------------------------------------------------
  // Seguimiento (idéntico a incidencias en estructura, sin estado leída/gestionada
  // y sin aviso en la portada de la ficha)
  // ---------------------------------------------------------------------
  var fichaSeguimientoActual = []; // copia de trabajo del seguimiento de la ficha abierta

  function seguimientoItemHTML(ev, idx) {
    return '<div class="incidencia-item" data-idx="' + idx + '">'
      + '<div class="incidencia-meta">'
      + '<input type="date" class="seg-fecha mono" data-idx="' + idx + '" value="' + esc(ev.fecha || '') + '">'
      + '<span class="inc-autor mono" title="Administrador que registró este evento">' + (ev.autor ? esc(ev.autor) : '—') + '</span>'
      + '<button type="button" class="btn small ghost seg-delete" data-idx="' + idx + '" aria-label="Eliminar este evento">✕</button>'
      + '</div>'
      + '<textarea class="seg-texto" data-idx="' + idx + '" placeholder="Describe el evento de seguimiento…">' + esc(ev.texto || '') + '</textarea>'
      + '</div>';
  }

  function renderSeguimientoList() {
    var wrap = byId('fSeguimientoList');
    if (!fichaSeguimientoActual.length) {
      wrap.innerHTML = '<div class="field-hint">No hay eventos de seguimiento registrados todavía.</div>';
      return;
    }
    wrap.innerHTML = fichaSeguimientoActual.map(function (ev, idx) { return seguimientoItemHTML(ev, idx); }).join('');
  }

  function readSeguimientoFromDOM() {
    document.querySelectorAll('#fSeguimientoList .incidencia-item').forEach(function (item) {
      var idx = Number(item.getAttribute('data-idx'));
      var fecha = item.querySelector('.seg-fecha').value;
      var texto = item.querySelector('.seg-texto').value;
      if (fichaSeguimientoActual[idx]) {
        fichaSeguimientoActual[idx].fecha = fecha;
        fichaSeguimientoActual[idx].texto = texto;
      }
    });
    return fichaSeguimientoActual.filter(function (ev) { return (ev.texto && ev.texto.trim()) || ev.fecha; });
  }

  function destinoBlockHTML(pais, key, vals) {
    return '<div class="destino-block">'
      + '<div style="font-weight:600;font-size:13px;">' + (FLAGS[pais] || '🏳') + ' ' + esc(pais) + '</div>'
      + '<div class="dgrid">'
      + '<div><div class="grp">Inicio</div><input type="date" data-dest="' + esc(pais) + '" data-part="' + key + '" data-sub="inicio" value="' + esc(vals.inicio) + '"></div>'
      + '<div><div class="grp">Fin</div><input type="date" data-dest="' + esc(pais) + '" data-part="' + key + '" data-sub="fin" value="' + esc(vals.fin) + '"></div>'
      + '</div></div>';
  }

  function openFichaModal(codigo) {
    var centro = centroByCodigo(codigo);
    if (!centro) return;
    fichaCodigoActual = codigo;
    var g = getGestion(codigo);

    byId('fichaTitulo').textContent = centro.n;
    byId('fichaSub').textContent = 'Código ' + centro.c + ' · ' + centro.p + ' · ' + (centro.tipo === 'publico' ? 'Centro público' : 'Centro concertado');
    byId('fichaMsg').hidden = true;

    byId('fCoordNombre').value = g.coordinador.nombre || '';
    byId('fCoordCorreo').value = g.coordinador.correo || '';
    byId('fTelefonoDisplay').textContent = centro.tel ? centro.tel : 'No disponible — revisar directorio de centros';

    fichaIncidenciasActual = (g.incidencias || []).map(function (inc) { return Object.assign({}, inc); });
    renderIncidenciasList();

    fichaSeguimientoActual = (g.seguimiento || []).map(function (ev) { return Object.assign({}, ev); });
    renderSeguimientoList();

    byId('fMemoriaCheck').checked = !!g.memoriaIntercambio.entregada;
    byId('fMemoriaFecha').value = g.memoriaIntercambio.fecha || '';
    byId('fApuntesCheck').checked = !!g.memoriaEconomica.apuntes.ok;
    byId('fApuntesFecha').value = g.memoriaEconomica.apuntes.fecha || '';
    byId('fListadoCheck').checked = !!g.memoriaEconomica.listado.ok;
    byId('fListadoFecha').value = g.memoriaEconomica.listado.fecha || '';
    byId('fDevolucionImporte').value = g.devolucion.importe || '';
    byId('fDevolucionSolicitada').checked = !!g.devolucion.solicitada;
    byId('fDevolucionHecha').checked = !!g.devolucion.hecha;

    var destWrap = byId('fFechasDestino'); var cylWrap = byId('fFechasCyl');
    destWrap.innerHTML = ''; cylWrap.innerHTML = '';
    centro.d.forEach(function (pair) {
      var pais = pair[0];
      var vals = (g.destinos[pais] || destinoDefault());
      destWrap.insertAdjacentHTML('beforeend', destinoBlockHTML(pais, 'destino', vals.destino));
      cylWrap.insertAdjacentHTML('beforeend', destinoBlockHTML(pais, 'cyl', vals.cyl));
    });

    var nombreGuardado = ''; try { nombreGuardado = sessionStorage.getItem('adminDisplayName') || ''; } catch (e) {}
    byId('fActualizadoPor').value = nombreGuardado;

    byId('fichaOverlay').hidden = false;
  }

  function refreshOpenFicha() {
    // Si otro administrador ha guardado cambios mientras esta ficha estaba abierta,
    // no pisamos lo que se está escribiendo: solo mostramos aviso.
    if (fichaCodigoActual) {
             var hint = byId('fichaConcurrenteAviso');
      if (hint) hint.hidden = false;
    }
  }

  function closeFichaModal() {
    byId('fichaOverlay').hidden = true;
    fichaCodigoActual = null;
    fichaIncidenciasActual = [];
    fichaSeguimientoActual = [];
    var hint = byId('fichaConcurrenteAviso'); if (hint) hint.hidden = true;
  }

  function readDestinosFromForm(centro) {
    var out = {};
    centro.d.forEach(function (pair) {
      var pais = pair[0];
      function v(part, sub) {
        var el = document.querySelector('[data-dest="' + CSS.escape(pais) + '"][data-part="' + part + '"][data-sub="' + sub + '"]');
        return el ? el.value : '';
      }
      out[pais] = {
        destino: { inicio: v('destino', 'inicio'), fin: v('destino', 'fin') },
        cyl: { inicio: v('cyl', 'inicio'), fin: v('cyl', 'fin') }
      };
    });
    return out;
  }

  function setupFicha() {
    byId('fichaClose').addEventListener('click', closeFichaModal);
    byId('fichaCancelBtn').addEventListener('click', closeFichaModal);
    byId('fichaOverlay').addEventListener('click', function (e) { if (e.target === byId('fichaOverlay')) closeFichaModal(); });

    byId('addIncidenciaBtn').addEventListener('click', function () {
      var nombreAdmin = byId('fActualizadoPor').value.trim();
      if (!nombreAdmin) {
        showFichaMsg('Escribe primero quién eres en "Actualizado por": ese nombre queda registrado como autor de la incidencia.', true);
        byId('fActualizadoPor').focus();
        return;
      }
      readIncidenciasFromDOM(); // conserva lo ya escrito en pantalla
      fichaIncidenciasActual.push({ fecha: todayStamp(), autor: nombreAdmin, texto: '', leida: false, gestionada: false });
      renderIncidenciasList();
      var items = document.querySelectorAll('#fIncidenciasList .incidencia-item');
      var last = items[items.length - 1];
      if (last) last.querySelector('.inc-texto').focus();
    });

    byId('fIncidenciasList').addEventListener('click', function (e) {
      var btn = e.target.closest('.inc-delete');
      if (!btn) return;
      readIncidenciasFromDOM();
      var idx = Number(btn.getAttribute('data-idx'));
      fichaIncidenciasActual.splice(idx, 1);
      renderIncidenciasList();
    });

    byId('addSeguimientoBtn').addEventListener('click', function () {
      var nombreAdmin = byId('fActualizadoPor').value.trim();
      if (!nombreAdmin) {
        showFichaMsg('Escribe primero quién eres en "Actualizado por": ese nombre queda registrado como autor del evento.', true);
        byId('fActualizadoPor').focus();
        return;
      }
      readSeguimientoFromDOM(); // conserva lo ya escrito en pantalla
      fichaSeguimientoActual.push({ fecha: todayStamp(), autor: nombreAdmin, texto: '' });
      renderSeguimientoList();
      var itemsSeg = document.querySelectorAll('#fSeguimientoList .incidencia-item');
      var lastSeg = itemsSeg[itemsSeg.length - 1];
      if (lastSeg) lastSeg.querySelector('.seg-texto').focus();
    });

    byId('fSeguimientoList').addEventListener('click', function (e) {
      var btn = e.target.closest('.seg-delete');
      if (!btn) return;
      readSeguimientoFromDOM();
      var idx = Number(btn.getAttribute('data-idx'));
      fichaSeguimientoActual.splice(idx, 1);
      renderSeguimientoList();
    });

    byId('fichaForm').addEventListener('submit', function (e) {
      e.preventDefault();
      if (!fichaCodigoActual) return;
      var centro = centroByCodigo(fichaCodigoActual);
      var correo = byId('fCoordCorreo').value.trim();
      if (correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
        showFichaMsg('Revisa el correo del coordinador: no parece una dirección válida.', true);
        return;
      }
      var nombreAdmin = byId('fActualizadoPor').value.trim();
      if (!nombreAdmin) {
        showFichaMsg('Escribe quién actualiza esta ficha antes de guardar.', true);
        byId('fActualizadoPor').focus();
        return;
      }
      try { sessionStorage.setItem('adminDisplayName', nombreAdmin); } catch (err) {}

      var payload = {
        coordinador: {
          nombre: byId('fCoordNombre').value.trim(),
          correo: correo
        },
        // Borra cualquier DNI guardado antes de este cambio (esta ficha ya no lo pide).
        'coordinador.dni': firebase.firestore.FieldValue.delete(),
        destinos: readDestinosFromForm(centro),
        memoriaIntercambio: {
          entregada: byId('fMemoriaCheck').checked,
          fecha: byId('fMemoriaFecha').value
        },
        memoriaEconomica: {
          apuntes: { ok: byId('fApuntesCheck').checked, fecha: byId('fApuntesFecha').value },
          listado: { ok: byId('fListadoCheck').checked, fecha: byId('fListadoFecha').value }
        },
        devolucion: {
          importe: byId('fDevolucionImporte').value,
          solicitada: byId('fDevolucionSolicitada').checked,
          hecha: byId('fDevolucionHecha').checked
        },
        incidencias: readIncidenciasFromDOM(),
        seguimiento: readSeguimientoFromDOM(),
        actualizadoEn: firebase.firestore.FieldValue.serverTimestamp(),
        actualizadoPor: nombreAdmin
      };

      var btn = byId('fichaSaveBtn'); btn.disabled = true; btn.textContent = 'Guardando…';
      db.collection('centros').doc(fichaCodigoActual).set(payload, { merge: true })
        .then(function () { showFichaMsg('Ficha guardada correctamente.', false); })
        .catch(function (err) {
          console.error(err);
          showFichaMsg('No se ha podido guardar. Comprueba tu conexión e inténtalo de nuevo.', true);
        })
        .finally(function () { btn.disabled = false; btn.textContent = 'Guardar cambios'; });
    });
  }

  function showFichaMsg(text, isError) {
    var box = byId('fichaMsg');
    box.textContent = text;
    box.className = isError ? 'error-msg' : 'success-msg';
    box.hidden = false;
  }

  // ---------------------------------------------------------------------
  // Descarga de datos (solo administradores)
  // ---------------------------------------------------------------------
  function openDownloadModal() { byId('downloadOverlay').hidden = false; }
  function closeDownloadModal() { byId('downloadOverlay').hidden = true; }

  function setupDownload() {
    byId('downloadBtn').addEventListener('click', openDownloadModal);
    byId('downloadClose').addEventListener('click', closeDownloadModal);
    byId('downloadOverlay').addEventListener('click', function (e) { if (e.target === byId('downloadOverlay')) closeDownloadModal(); });
    byId('exportXlsBtn').addEventListener('click', function () { doExport('xlsx'); });
    byId('exportPdfBtn').addEventListener('click', function () { doExport('pdf'); });
  }

  function buildExportRows() {
    var chk = function (id) { return byId(id).checked; };
    var cols = {
      publico: chk('colPublico'),
      coordinador: chk('colCoordinador'),
      telefono: chk('colTelefono'),
      fechas: chk('colFechas'),
      memoriaIntercambio: chk('colMemoriaIntercambio'),
      memoriaEconomica: chk('colMemoriaEconomica'),
      devolucion: chk('colDevolucion'),
      seguimiento: chk('colSeguimiento'),
      incidencias: chk('colIncidencias')
    };
    var rows = currentList.map(function (c) {
      var g = getGestion(c.c);
      var row = { "Código": c.c, "Centro": c.n };
      if (cols.publico) {
        row["Tipo"] = c.tipo === 'publico' ? 'Público' : 'Concertado';
        row["Provincia"] = c.p;
        row["Puntuación"] = c.pt;
        row["Importe concedido (€)"] = c.im;
        row["Alumnado total"] = alumnosTotal(c);
        row["Destinos (alumnado)"] = c.d.map(function (p) { return p[0] + ': ' + p[1]; }).join(' · ');
      }
      if (cols.coordinador) {
        row["Coordinador · Nombre"] = g.coordinador.nombre;
        row["Coordinador · Correo"] = g.coordinador.correo;
      }
      if (cols.telefono) row["Teléfono centro"] = c.tel || '';
      if (cols.fechas) {
        row["Fechas en destino"] = c.d.map(function (p) {
          var v = (g.destinos[p[0]] || destinoDefault()).destino;
          return p[0] + ': ' + (v.inicio || '?') + ' → ' + (v.fin || '?');
        }).join(' · ');
        row["Fechas en CyL"] = c.d.map(function (p) {
          var v = (g.destinos[p[0]] || destinoDefault()).cyl;
          return p[0] + ': ' + (v.inicio || '?') + ' → ' + (v.fin || '?');
        }).join(' · ');
      }
      if (cols.memoriaIntercambio) {
        row["Memoria intercambio"] = g.memoriaIntercambio.entregada ? 'Entregada' : 'Pendiente';
        row["Memoria intercambio · Fecha"] = g.memoriaIntercambio.fecha || '';
      }
      if (cols.memoriaEconomica) {
        row["Memoria económica · Apuntes"] = g.memoriaEconomica.apuntes.ok ? 'Sí' : 'No';
        row["Memoria económica · Apuntes fecha"] = g.memoriaEconomica.apuntes.fecha || '';
        row["Memoria económica · Listado"] = g.memoriaEconomica.listado.ok ? 'Sí' : 'No';
        row["Memoria económica · Listado fecha"] = g.memoriaEconomica.listado.fecha || '';
      }
      if (cols.devolucion) {
        row["Devolución · Importe (€)"] = g.devolucion.importe || '';
        row["Devolución · Solicitada"] = g.devolucion.solicitada ? 'Sí' : 'No';
        row["Devolución · Hecha"] = g.devolucion.hecha ? 'Sí' : 'No';
      }
      if (cols.seguimiento) {
        row["Seguimiento"] = (g.seguimiento || []).map(function (ev) {
          return '[' + fmtFechaCorta(ev.fecha) + (ev.autor ? ' · ' + ev.autor : '') + '] ' + ev.texto;
        }).join(' | ');
      }
      if (cols.incidencias) {
        row["Incidencias"] = (g.incidencias || []).map(function (inc) {
          var estado = inc.leida ? 'leída' : 'sin leer';
          if (inc.gestionada) estado += ', gestionada';
          return '[' + fmtFechaCorta(inc.fecha) + (inc.autor ? ' · ' + inc.autor : '') + ' · ' + estado + '] ' + inc.texto;
        }).join(' | ');
      }
      return row;
    });
    return rows;
  }

  function todayStamp() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function doExport(format) {
    var rows = buildExportRows();
    if (!rows.length) { alert('No hay centros que coincidan con los filtros actuales.'); return; }
    var filename = 'intercambios_' + todayStamp();

    if (format === 'xlsx') {
      var ws = XLSX.utils.json_to_sheet(rows);
      var wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Centros');
      XLSX.writeFile(wb, filename + '.xlsx');
    } else {
      var docPdf = new window.jspdf.jsPDF({ orientation: 'landscape' });
      var head = Object.keys(rows[0]);
      var body = rows.map(function (r) { return head.map(function (h) { return r[h] == null ? '' : String(r[h]); }); });
      docPdf.setFontSize(12);
      docPdf.text('Intercambios escolares CyL — datos de gestión (' + todayStamp() + ')', 14, 12);
      docPdf.autoTable({ head: [head], body: body, startY: 18, styles: { fontSize: 7, cellPadding: 2 }, headStyles: { fillColor: [156, 112, 40] } });
      docPdf.save(filename + '.pdf');
    }
    closeDownloadModal();
  }

  // ---------------------------------------------------------------------
  // Arranque
  // ---------------------------------------------------------------------
  renderHeaderStats();
  renderCountryChart();
  renderSplitCharts();
  setupFilterControls();
  setupLogin();
  setupFicha();
  setupDownload();
  applyFilters();
})();
