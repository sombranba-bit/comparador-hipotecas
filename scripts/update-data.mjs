// Actualiza data/reference.json con indicadores oficiales del BCE (API SDMX pública, sin clave).
// Ejecución: node scripts/update-data.mjs   (Node 20+)
// Si una serie falla, conserva el valor anterior y sale con código 0 para no romper el workflow.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, "..", "data", "reference.json");
const API = "https://data-api.ecb.europa.eu/service/data";

// Series a consultar. Verificar las claves en data.ecb.europa.eu si el BCE cambia su catálogo.
const SERIES = {
  euribor12m: { flow: "FM", key: "M.U2.EUR.RT.MM.EURIBOR1YD_.HSTA" },
  tipoMedioVivienda: { flow: "MIR", key: "M.ES.B.A2C.A.R.A.2250.EUR.N" }
};

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
  return { valor: Number(last[iVal]), periodo: last[iTime] };
}

const previous = JSON.parse(await readFile(OUT, "utf8"));
const next = { ...previous, actualizado: new Date().toISOString() };

for (const [name, serie] of Object.entries(SERIES)) {
  try {
    const { valor, periodo } = await lastValue(serie);
    next[name] = valor;
    next[`${name}Periodo`] = periodo;
    console.log(`${name}: ${valor} (${periodo})`);
  } catch (err) {
    console.warn(`Aviso: ${name} no actualizado → ${err.message}`);
  }
}

await writeFile(OUT, JSON.stringify(next, null, 2) + "\n");
