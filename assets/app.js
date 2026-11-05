// Simulador y comparador de hipotecas. Sin dependencias.

const $ = (sel, root = document) => root.querySelector(sel);
const reducido = matchMedia("(prefers-reduced-motion: reduce)").matches;

// Gastos de notaría estimados (no publicados por las entidades). Se muestra en la web.
const NOTARIA_ESTIMADA = 900;

const eur = (n) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
const pct = (n) =>
  new Intl.NumberFormat("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + " %";
const escapar = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// Fórmula francesa: cuota constante.
export function cuotaMensual(capital, tinAnualPct, anios) {
  const r = tinAnualPct / 100 / 12;
  const n = anios * 12;
  if (r === 0) return capital / n;
  return (capital * r) / (1 - Math.pow(1 + r, -n));
}

// Coste total real de una oferta según acepte o no las vinculaciones.
export function evaluarOferta(o, { capital, anios, euribor, conVinculacion, seguroAnual }) {
  let tin = null;
  if (o.tipo === "variable") {
    tin = euribor == null ? null : euribor + o.diferencial;
  } else {
    tin = conVinculacion ? o.tin_bonificado : o.tin_sin_vinculacion;
  }
  if (tin == null) return { disponible: false };

  const cuota = cuotaMensual(capital, tin, anios);
  const totalPagado = cuota * anios * 12;
  const comisiones = (capital * (o.apertura_pct ?? 0)) / 100 + NOTARIA_ESTIMADA;
  // Seguro propio de la oferta si la entidad lo publica; si no, el importe por defecto del fichero.
  const seguroOferta = o.seguro_anual ?? seguroAnual;
  const seguros = conVinculacion && o.tipo !== "variable" && o.seguro_vinculado !== false ? seguroOferta * anios : 0;
  const costeTotal = totalPagado - capital + comisiones + seguros;
  const tae = conVinculacion ? o.tae_bonificada : o.tae_sin_vinculacion;

  return { disponible: true, tin, tae, cuota, costeTotal, aptaPlazo: o.plazo_max == null || anios <= o.plazo_max };
}

function leerFormulario() {
  return {
    precio: Math.max(0, Number($("#precio").value) || 0),
    ahorro: Math.max(0, Number($("#ahorro").value) || 0),
    anios: Number($("#plazo").value),
    tipo: $("#tipo").value,
    conVinculacion: $("#vinc").value === "si",
  };
}

async function cargarJSON(ruta) {
  // En la versión de un solo archivo los datos vienen incrustados.
  if (typeof __DATOS__ !== "undefined") {
    if (ruta.includes("offers")) return __DATOS__.offers;
    if (ruta.includes("reference")) return __DATOS__.reference;
  }
  try {
    const r = await fetch(ruta, { cache: "no-cache" });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

const estado = { datos: null, referencia: {}, euribor: null };

const ETIQUETA_TIPO = { fija: "Fija", variable: "Variable", mixta: "Mixta" };

// Hueco de logotipo: mientras no haya logo verificado, se muestran las iniciales.
function iniciales(nombre) {
  return nombre.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
}

// Dominio oficial de cada entidad. El icono se pide al abrir la página; si no carga, aparece la inicial.
const DOMINIOS = {
  "Ibercaja": "ibercaja.es",
  "Banca March": "bancamarch.es",
  "Banco Sabadell": "bancsabadell.com",
  "Openbank": "openbank.es",
  "BBVA": "bbva.es",
  "Banco Santander": "bancosantander.es",
  "Unicaja Banco": "unicajabanco.es",
  "Cajamar Caja Rural": "cajamar.es",
  "MyInvestor": "myinvestor.es",
  "Bankinter": "bankinter.com",
  "Kutxabank": "kutxabank.es",
  "imagin": "imaginbank.es",
  "Abanca": "abanca.com",
};

function monograma(o) {
  return `<span class="monograma" aria-hidden="true">${escapar(iniciales(o.entidad))}</span>`;
}

// Orden de búsqueda del logo: archivo local (assets/logos/<dominio>.png o .svg), icono de Google y, si nada carga, la inicial.
function logoEntidad(o) {
  if (o.logo) return `<img class="logo" src="${escapar(o.logo)}" alt="" width="34" height="34" decoding="async">`;
  const dominio = DOMINIOS[o.entidad];
  if (!dominio) return monograma(o);
  const rutas = [
    `assets/logos/${dominio}.png`,
    `assets/logos/${dominio}.svg`,
    `https://www.google.com/s2/favicons?domain=${encodeURIComponent(dominio)}&sz=64`,
  ];
  return `<img class="logo" src="${rutas[0]}" alt="" width="34" height="34" decoding="async" data-resto="${escapar(JSON.stringify(rutas.slice(1)))}" data-iniciales="${escapar(iniciales(o.entidad))}">`;
}

function motivo(r, ltv) {
  if (!r.eval.disponible) {
    if (r.oferta.tipo === "variable" && estado.euribor == null) return "Falta el dato de Euríbor";
    return "Sin dato con las condiciones elegidas";
  }
  if (!r.eval.aptaPlazo) return `Plazo máximo ${r.oferta.plazo_max} años`;
  if (ltv > r.oferta.ltv_max) return `Financia hasta el ${r.oferta.ltv_max} %`;
  return "";
}

function renderLista(resultados, ltv, conVinc) {
  const lista = $("#lista");
  if (!resultados.length) {
    lista.innerHTML = '<tr><td colspan="5" class="vacio">No hay ofertas de ese tipo todavía.</td></tr>';
    return;
  }
  const aptas = resultados.filter((r) => r.apta);
  const maxCoste = Math.max(...aptas.map((r) => r.eval.costeTotal), 1);
  const mejor = aptas[0];

  lista.innerHTML = resultados
    .map((r) => {
      const o = r.oferta;
      const ev = r.eval;
      const ancho = r.apta ? Math.round((ev.costeTotal / maxCoste) * 100) : 0;
      const textoMotivo = r.apta ? "" : motivo(r, ltv);
      const vinc = o.tipo === "variable" ? "Sin datos de vinculación" : o.seguro_vinculado === false ? "Sin vinculaciones obligatorias" : conVinc ? `Con vinculación: ${o.vinculaciones}` : "Sin vinculaciones";
      const logo = logoEntidad(o);
      const etiqueta = r === mejor ? `<span class="etiqueta-mejor">Mejor opción</span>` : "";
      return `
        <tr class="${r === mejor ? "mejor" : ""} ${r.apta ? "" : "no-apta"}">
          <td class="entidad-celda">
            <div class="celda-entidad">
              ${logo}
              <div>
                <h3>${escapar(o.entidad)} ${etiqueta}</h3>
                <p class="meta">${escapar(o.producto)}<span class="sep">·</span>${ETIQUETA_TIPO[o.tipo]}${textoMotivo ? `<span class="sep">·</span>${escapar(textoMotivo)}` : ""}</p>
              </div>
            </div>
            <details class="condiciones">
              <summary>Condiciones</summary>
              <p>${escapar(vinc)}</p>
              <a class="fuente" href="${escapar(o.fuente)}" target="_blank" rel="noopener">${escapar(o.fuente_nombre || "Fuente")}</a>
            </details>
          </td>
          <td class="num">${r.apta ? eur(ev.cuota) : "–"}</td>
          <td class="num">${ev.disponible ? pct(ev.tin) : "–"}</td>
          <td class="num">${ev.disponible && ev.tae != null ? pct(ev.tae) : "sin dato"}</td>
          <td class="num">
            <strong>${r.apta ? eur(ev.costeTotal) : "–"}</strong>
            <div class="barra-coste" aria-hidden="true"><i data-ancho="${ancho}"></i></div>
          </td>
        </tr>`;
    })
    .join("");

  requestAnimationFrame(() =>
    lista.querySelectorAll("i[data-ancho]").forEach((b) => (b.style.width = b.dataset.ancho + "%"))
  );
}

// Cifra que se desliza hasta su valor
function animarCifra(el, destino) {
  const inicio = parseFloat(el.dataset.valor || "0");
  el.dataset.valor = destino;
  if (reducido) {
    el.textContent = eur(destino);
    return;
  }
  const t0 = performance.now();
  const paso = (t) => {
    const p = Math.min(1, (t - t0) / 450);
    const e = 1 - Math.pow(1 - p, 3);
    el.textContent = eur(inicio + (destino - inicio) * e);
    if (p < 1) requestAnimationFrame(paso);
  };
  requestAnimationFrame(paso);
}

function actualizar() {
  const f = leerFormulario();
  $("#plazo-valor").textContent = `${f.anios} años`;

  const capital = Math.max(0, f.precio - f.ahorro);
  const ltv = f.precio > 0 ? (capital / f.precio) * 100 : 0;
  $("#prestamo").textContent = eur(capital);
  $("#ltv").textContent = `${ltv.toFixed(0)} %`;

  const seguroAnual = estado.datos?.seguro_anual_estimado ?? 0;
  const candidatas = (estado.datos?.ofertas ?? []).filter((o) => f.tipo === "todas" || o.tipo === f.tipo);
  const resultados = candidatas
    .map((o) => {
      const e = evaluarOferta(o, {
        capital,
        anios: f.anios,
        euribor: estado.euribor,
        conVinculacion: f.conVinculacion,
        seguroAnual,
      });
      const apta = e.disponible && e.aptaPlazo && ltv <= o.ltv_max;
      return { oferta: o, eval: e, apta };
    })
    .sort((a, b) => Number(b.apta) - Number(a.apta) || (a.eval.costeTotal ?? Infinity) - (b.eval.costeTotal ?? Infinity));

  const aptas = resultados.filter((r) => r.apta);
  $("#aptas").textContent = `${aptas.length} de ${resultados.length}`;
  // Lo que sale el piso en total con la mejor oferta: precio + intereses, comisiones y seguros.
  const mejor = aptas[0];
  $("#total-piso").textContent = mejor ? eur(f.precio + mejor.eval.costeTotal) : "—";

  if (aptas[0]) animarCifra($("#cuota-mejor"), aptas[0].eval.cuota);
  else $("#cuota-mejor").textContent = "–";

  renderLista(resultados, ltv, f.conVinculacion);
}

function pintarReferencia() {
  const ref = estado.referencia;
  const partes = [];
  if (ref.euribor12m != null) {
    const fecha = ref.euribor12mPeriodo ? ` (${new Date(ref.euribor12mPeriodo).toLocaleDateString("es-ES")})` : "";
    partes.push(`Euríbor 12 meses ${pct(ref.euribor12m)}${fecha}`);
  } else {
    partes.push("Euríbor sin dato");
  }
  if (ref.actualizado) partes.push(`indicadores actualizados ${new Date(ref.actualizado).toLocaleDateString("es-ES")}`);
  $("#nota-datos").textContent = partes.join(" · ");
}

// Fecha y hora actual, y fechas de la última comprobación de precios y del Euríbor.
function pintarEstado() {
  const fechaLarga = (d) => new Date(d).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
  const pintarReloj = () => {
    $("#reloj").textContent = new Date().toLocaleString("es-ES", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };
  pintarReloj();
  setInterval(pintarReloj, 30000);

  $("#ultima-pasada").textContent = estado.datos?.actualizado ? fechaLarga(estado.datos.actualizado) : "sin fecha";
  const refFecha = estado.referencia.euribor12mPeriodo;
  $("#euribor-fecha").textContent = refFecha ? fechaLarga(refFecha) : "sin dato";
}

// Pestañas: muestra una sección y oculta las demás.
function iniciarPestanas() {
  const botones = [...document.querySelectorAll('[role="tab"]')];
  const mostrar = (nombre) => {
    botones.forEach((b) => {
      const activa = b.dataset.tab === nombre;
      b.setAttribute("aria-selected", String(activa));
      b.tabIndex = activa ? 0 : -1;
    });
    document.querySelectorAll('[role="tabpanel"]').forEach((p) => {
      p.hidden = p.id !== `panel-${nombre}`;
    });
  };
  botones.forEach((b) => b.addEventListener("click", () => mostrar(b.dataset.tab)));
  // Botones y enlaces con data-ir llevan a otra pestaña.
  document.querySelectorAll("[data-ir]").forEach((b) => b.addEventListener("click", (e) => {
    e.preventDefault();
    mostrar(b.dataset.ir);
    if (b.dataset.ir === "simulador") document.getElementById("panel-simulador").scrollIntoView({ block: "start" });
    else window.scrollTo({ top: 0 });
  }));
  // Flechas izquierda y derecha entre pestañas.
  document.querySelector('[role="tablist"]').addEventListener("keydown", (e) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const i = botones.findIndex((b) => b.getAttribute("aria-selected") === "true");
    const siguiente = botones[(i + (e.key === "ArrowRight" ? 1 : -1) + botones.length) % botones.length];
    siguiente.focus();
    mostrar(siguiente.dataset.tab);
  });
}

async function iniciar() {
  const [datos, referencia] = await Promise.all([cargarJSON("data/offers.json"), cargarJSON("data/reference.json")]);
  estado.datos = datos ?? { ofertas: [] };
  estado.referencia = referencia ?? {};
  estado.euribor = estado.referencia.euribor12m ?? null;
  pintarReferencia();
  pintarEstado();

  $("#form").addEventListener("input", actualizar);
  $("#tipo").addEventListener("change", actualizar);
  $("#vinc").addEventListener("change", actualizar);
  iniciarPestanas();
  // Si un icono no carga, se cambia por la inicial de la entidad.
  $("#lista").addEventListener("error", (e) => {
    const img = e.target;
    if (img.tagName !== "IMG" || !img.dataset.iniciales) return;
    const resto = JSON.parse(img.dataset.resto || "[]");
    if (resto.length) {
      img.dataset.resto = JSON.stringify(resto.slice(1));
      img.src = resto[0];
      return;
    }
    img.outerHTML = `<span class="monograma" aria-hidden="true">${escapar(img.dataset.iniciales)}</span>`;
  }, true);
  actualizar();
}

iniciar();
