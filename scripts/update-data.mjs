// Actualiza data/reference.json con indicadores oficiales del BCE (API SDMX pública, sin clave).
// Ejecución: node scripts/update-data.mjs   (Node 20+)
//
// Reglas:
// - El Euríbor diario (euribor12m / euribor12mPeriodo) es un dato de cierre diario que el BCE
//   no publica en esta serie. Este script NO lo sobrescribe. Se actualiza a mano y su fuente
//   va en `fuente`.
// - La media mensual del Euríbor 12M del BCE se guarda aparte (euribor12mMediaMensual).
// - Si una serie falla, conserva el valor anterior y sale con código 0 para no romper el workflow.
// - `actualizado` solo cambia si algún valor cambia, para no generar un commit diario vacío.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, "..", "data", "reference.json");
const API = "https://data-api.ecb.europa.eu/service/data";

// Series a consultar. Verificar las claves en data.ecb.europa.eu si el BCE cambia su catálogo.
// `campo` es la clave que se escribe en reference.json (con su periodo en `${campo}Periodo`).
const SERIES = [
  {
    campo: "euribor12mMediaMensual",
    flow: "FM",
    key: "M.U2.EUR.RT.MM.EURIBOR1YD_.HSTA"
  },
  {
    campo: "tipoMedioVivienda",
    flow: "MIR",
    key: "M.ES.B.A2C.A.R.A.2250.EUR.N"
  }
];

async function lastValue({ flow, key }) {
  const url = `${API}/${flow}/${key}?format=csvdata&lastNObservations=1`;
  const res = await fetch(url, { headers: { Accept: "text/csv" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} en ${flow}/${key}`);
  const [header, ...rows] = (await res.text()).trim().split("\n");
  const cols = header.split(",");
  const iVal = cols.indexOf("OBS_VALUE");
  const iTime = cols.indexOf("TIME_PERIOD");
  const last = rows.at(-1)?.split(",");
  if (!last || iVal < 0) throw new Error(`Respuesta inesperada en ${flow}/${key}`);
  const valor = Number(last[iVal]);
  if (!Number.isFinite(valor)) throw new Error(`Valor no numérico en ${flow}/${key}`);
  return { valor, periodo: last[iTime] };
}

const previous = JSON.parse(await readFile(OUT, "utf8"));
const next = { ...previous };
let cambios = false;

for (const serie of SERIES) {
  try {
    const { valor, periodo } = await lastValue(serie);
    if (next[serie.campo] !== valor || next[`${serie.campo}Periodo`] !== periodo) cambios = true;
    next[serie.campo] = valor;
    next[`${serie.campo}Periodo`] = periodo;
    console.log(`${serie.campo}: ${valor} (${periodo})`);
  } catch (err) {
    console.warn(`Aviso: ${serie.campo} no actualizado → ${err.message}`);
  }
}

if (cambios) next.actualizado = new Date().toISOString();
await writeFile(OUT, JSON.stringify(next, null, 2) + "\n");
