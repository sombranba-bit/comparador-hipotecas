// Simulador y comparador de hipotecas. Sin dependencias.

const $ = (sel, root = document) => root.querySelector(sel);
const reducido = matchMedia("(prefers-reduced-motion: reduce)").matches;

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

// Coste total real: intereses + comisiones + seguros exigidos durante el plazo.
export function evaluarOferta(oferta, { capital, anios, euribor }) {
  const tin = oferta.tipo === "variable" ? (euribor ?? 0) + oferta.diferencial : oferta.tin;
  const cuota = cuotaMensual(capital, tin, anios);
  const totalPagado = cuota * anios * 12;
  const comisiones = (capital * oferta.apertura_pct) / 100 + oferta.tasacion + oferta.notaria_estimada;
  const seguros = (oferta.vinculacion_seguro_anual || 0) * anios;
  const costeTotal = totalPagado - capital + comisiones + seguros;
  return { tin, cuota, costeTotal, aptaPlazo: anios <= oferta.plazo_max };
}

function leerFormulario() {
  return {
    precio: Math.max(0, Number($("#precio").value) || 0),
    ahorro: Math.max(0, Number($("#ahorro").value) || 0),
    anios: Number($("#plazo").value),
    tipo: $("#tipo").value,
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

const estado = { ofertas: [], referencia: {}, euribor: null };

const ETIQUETA_TIPO = { fija: "Fija", variable: "Variable", mixta: "Mixta" };

function motivoNoApta(r, ltv) {
  if (r.sinEuribor) return "Falta el dato de Euríbor";
  if (!r.eval.aptaPlazo) return "Plazo máximo inferior al elegido";
  if (ltv > r.oferta.ltv_max) return `Financia hasta el ${r.oferta.ltv_max} %`;
  return "";
}

function renderLista(resultados, ltv) {
  const lista = $("#lista");
  if (!resultados.length) {
    lista.innerHTML = '<p class="vacio">No hay ofertas de ese tipo todavía.</p>';
    return;
  }
  const aptas = resultados.filter((r) => r.apta);
  const maxCoste = Math.max(...resultados.map((r) => r.eval.costeTotal), 1);
  const mejor = aptas[0];

  lista.innerHTML = resultados
    .map((r, i) => {
      const o = r.oferta;
      const ancho = Math.round((r.eval.costeTotal / maxCoste) * 100);
      const sinVinc = (o.vinculacion_seguro_anual || 0) === 0;
      const motivo = r.apta ? "" : motivoNoApta(r, ltv);
      return `
        <li class="oferta reveal ${r === mejor ? "mejor" : ""} ${r.apta ? "" : "no-apta"}" style="transition-delay:${Math.min(i, 6) * 60}ms">
          <div>
            <h3>${escapar(o.entidad)}</h3>
            <p class="meta">${ETIQUETA_TIPO[o.tipo]}<span class="sep">·</span>${sinVinc ? "Sin vinculación" : "Con vinculación"}${motivo ? `<span class="sep">·</span>${escapar(motivo)}` : ""}</p>
          </div>
          <div class="dato"><small>Cuota mensual</small><strong>${r.apta ? eur(r.eval.cuota) : "—"}</strong></div>
          <div class="dato"><small>Tipo</small><strong>${pct(r.eval.tin)}</strong> <span class="tae">TAE ${pct(o.tae)}</span></div>
          <div class="dato"><small>Coste total</small><strong>${r.apta ? eur(r.eval.costeTotal) : "—"}</strong>
            <div class="barra-coste" aria-hidden="true"><i data-ancho="${r.apta ? ancho : 0}"></i></div>
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

  const candidatas = estado.ofertas.filter((o) => f.tipo === "todas" || o.tipo === f.tipo);
  const resultados = candidatas
    .map((o) => {
      const e = evaluarOferta(o, { capital, anios: f.anios, euribor: estado.euribor });
      const sinEuribor = o.tipo === "variable" && estado.euribor == null;
      const apta = e.aptaPlazo && ltv <= o.ltv_max && !sinEuribor;
      return { oferta: o, eval: e, apta, sinEuribor };
    })
    .sort((a, b) => Number(b.apta) - Number(a.apta) || a.eval.costeTotal - b.eval.costeTotal);

  const aptas = resultados.filter((r) => r.apta);
  $("#aptas").textContent = `${aptas.length} de ${resultados.length}`;

  if (aptas[0]) animarCifra($("#cuota-mejor"), aptas[0].eval.cuota);
  else $("#cuota-mejor").textContent = "—";

  renderLista(resultados, ltv);
}

function pintarReferencia() {
  const ref = estado.referencia;
  const partes = [];
  if (ref.euribor12m != null) partes.push(`Euríbor 12M ${pct(ref.euribor12m)}`);
  if (ref.tipoMedioVivienda != null) partes.push(`tipo medio BCE vivienda ${pct(ref.tipoMedioVivienda)}`);
  partes.push(ref.actualizado ? `actualizado ${new Date(ref.actualizado).toLocaleDateString("es-ES")}` : "sin datos oficiales aún");
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
  const [ofertas, referencia] = await Promise.all([cargarJSON("data/offers.json"), cargarJSON("data/reference.json")]);
  estado.ofertas = ofertas?.ofertas ?? [];
  estado.referencia = referencia ?? {};
  estado.euribor = estado.referencia.euribor12m ?? null;
  pintarReferencia();

  $("#form").addEventListener("input", actualizar);
  $("#tipo").addEventListener("change", actualizar);
  actualizar();
  observarReveal();
}

iniciar();
