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
  const seguros = conVinculacion && o.tipo !== "variable" && o.seguro_vinculado !== false ? seguroAnual * anios : 0;
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
    lista.innerHTML = '<p class="vacio">No hay ofertas de ese tipo todavía.</p>';
    return;
  }
  const aptas = resultados.filter((r) => r.apta);
  const maxCoste = Math.max(...aptas.map((r) => r.eval.costeTotal), 1);
  const mejor = aptas[0];

  lista.innerHTML = resultados
    .map((r, i) => {
      const o = r.oferta;
      const ev = r.eval;
      const ancho = r.apta ? Math.round((ev.costeTotal / maxCoste) * 100) : 0;
      const textoMotivo = r.apta ? "" : motivo(r, ltv);
      const vinc = o.tipo === "variable" ? "Sin datos de vinculación" : o.seguro_vinculado === false ? "Sin vinculaciones obligatorias" : conVinc ? `Con vinculación: ${o.vinculaciones}` : "Sin vinculaciones";
      return `
        <li class="oferta reveal ${r === mejor ? "mejor" : ""} ${r.apta ? "" : "no-apta"}" style="transition-delay:${Math.min(i, 6) * 60}ms">
          <div>
            <div class="entidad">
              ${o.logo
                ? `<img class="logo" src="${escapar(o.logo)}" alt="" width="36" height="36" decoding="async">`
                : `<span class="monograma" aria-hidden="true">${escapar(iniciales(o.entidad))}</span>`}
              <div>
                <h3>${escapar(o.entidad)}</h3>
                <p class="meta">${escapar(o.producto)}<span class="sep">·</span>${ETIQUETA_TIPO[o.tipo]}</p>
              </div>
            </div>
            <p class="meta">${escapar(vinc)}${textoMotivo ? `<span class="sep">·</span>${escapar(textoMotivo)}` : ""}</p>
          </div>
          <div class="dato"><small>Cuota mensual</small><strong>${r.apta ? eur(ev.cuota) : "–"}</strong></div>
          <div class="dato"><small>TIN · TAE</small><strong>${ev.disponible ? pct(ev.tin) : "–"}</strong>
            <span class="tae">${ev.disponible && ev.tae != null ? "TAE " + pct(ev.tae) : "TAE sin dato"}</span></div>
          <div class="dato"><small>Coste total</small><strong>${r.apta ? eur(ev.costeTotal) : "–"}</strong>
            <div class="barra-coste" aria-hidden="true"><i data-ancho="${ancho}"></i></div>
            <a class="fuente" href="${escapar(o.fuente)}" target="_blank" rel="noopener">${escapar(o.fuente_nombre || "Fuente")}</a>
          </div>
        </li>`;
    })
    .join("");

  requestAnimationFrame(() =>
    lista.querySelectorAll("i[data-ancho]").forEach((b) => (b.style.width = b.dataset.ancho + "%"))
  );
  observarReveal(lista);
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
  el.classList.add("pulso");
  const paso = (t) => {
    const p = Math.min(1, (t - t0) / 450);
    const e = 1 - Math.pow(1 - p, 3);
    el.textContent = eur(inicio + (destino - inicio) * e);
    if (p < 1) requestAnimationFrame(paso);
    else el.classList.remove("pulso");
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

function observarReveal(raiz = document) {
  const io = new IntersectionObserver(
    (entradas) =>
      entradas.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("visible");
          io.unobserve(e.target);
        }
      }),
    { threshold: 0.12 }
  );
  raiz.querySelectorAll(".reveal:not(.visible)").forEach((el) => io.observe(el));
}

async function iniciar() {
  const [datos, referencia] = await Promise.all([cargarJSON("data/offers.json"), cargarJSON("data/reference.json")]);
  estado.datos = datos ?? { ofertas: [] };
  estado.referencia = referencia ?? {};
  estado.euribor = estado.referencia.euribor12m ?? null;
  pintarReferencia();

  $("#form").addEventListener("input", actualizar);
  $("#tipo").addEventListener("change", actualizar);
  $("#vinc").addEventListener("change", actualizar);
  actualizar();
  observarReveal();
}

iniciar();
