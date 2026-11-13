// Comprueba el cálculo de cuota, coste total y plazo de cada oferta frente a una
// simulación cuota a cuota, que no usa la fórmula cerrada.
// Ejecución: node tests/comprobar.mjs   (Node 20+). Sale con código 1 si hay discrepancias.
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

// Se toman las funciones reales de app.js, sin ejecutar el resto del script (que necesita el DOM).
const fuente = await readFile(path.join(raiz, "assets/app.js"), "utf8");
const trozo = fuente.slice(fuente.indexOf("const NOTARIA_ESTIMADA"), fuente.indexOf("function leerFormulario"));
const { evaluarOferta } = new Function(trozo.replace(/export /g, "") + "; return { evaluarOferta };")();

const datos = JSON.parse(await readFile(path.join(raiz, "data/offers.json"), "utf8"));
const seguroPorDefecto = datos.seguro_anual_estimado;

// Amortización francesa cuota a cuota: los intereses de cada mes salen del saldo vivo.
function simular(capital, tinPct, meses) {
  const r = tinPct / 100 / 12;
  const cuota = r === 0 ? capital / meses : (capital * r) / (1 - Math.pow(1 + r, -meses));
  let saldo = capital;
  let intereses = 0;
  for (let i = 0; i < meses; i++) {
    const interesMes = saldo * r;
    intereses += interesMes;
    saldo = saldo + interesMes - cuota;
  }
  return { cuota, intereses };
}

let casos = 0;
const fallos = [];

for (const capital of [50000, 120000, 176000, 300000]) {
  for (const anios of [5, 15, 25, 30, 40]) {
    for (const conVinculacion of [true, false]) {
      for (const euribor of [3.302, null]) {
        for (const o of datos.ofertas) {
          casos++;
          const real = evaluarOferta(o, { capital, anios, euribor, conVinculacion, seguroAnual: seguroPorDefecto });
          const id = `${o.id} capital=${capital} años=${anios} vinc=${conVinculacion} euribor=${euribor}`;

          let tin = null;
          if (o.tipo === "variable") tin = euribor == null ? null : euribor + o.diferencial;
          else tin = conVinculacion ? o.tin_bonificado : o.tin_sin_vinculacion;

          if (tin == null) {
            if (real.disponible) fallos.push(`${id}: debería no estar disponible`);
            continue;
          }
          if (!real.disponible) {
            fallos.push(`${id}: no disponible sin motivo`);
            continue;
          }

          const sim = simular(capital, tin, anios * 12);
          const comisiones = (capital * (o.apertura_pct ?? 0)) / 100 + 900;
          const seguroOferta = o.seguro_anual ?? seguroPorDefecto;
          const seguros = conVinculacion && o.tipo !== "variable" && o.seguro_vinculado !== false ? seguroOferta * anios : 0;
          const costeEsperado = sim.intereses + comisiones + seguros;

          if (Math.abs(real.cuota - sim.cuota) > 0.01) fallos.push(`${id}: cuota ${real.cuota} ≠ ${sim.cuota}`);
          if (Math.abs(real.costeTotal - costeEsperado) > 0.5) fallos.push(`${id}: coste ${real.costeTotal} ≠ ${costeEsperado}`);

          const aptaPlazoEsperada = o.plazo_max == null || anios <= o.plazo_max;
          if (real.aptaPlazo !== aptaPlazoEsperada) fallos.push(`${id}: aptaPlazo ${real.aptaPlazo} ≠ ${aptaPlazoEsperada}`);
        }
      }
    }
  }
}

console.log(`casos ${casos}, discrepancias ${fallos.length}`);
for (const f of fallos.slice(0, 20)) console.log("  " + f);
process.exit(fallos.length ? 1 : 0);
