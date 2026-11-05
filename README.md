# Comparador de hipotecas

Simulador y comparador de hipotecas en España. Ordena las ofertas por **coste total** (intereses, comisiones y seguros exigidos), no solo por tipo.

## Estructura

```
index.html                  Página principal (sin build)
assets/styles.css           Estilos y animaciones
assets/app.js               Simulador, comparador y reveal al hacer scroll
data/offers.json            Ofertas (DATOS DE EJEMPLO por ahora)
data/reference.json         Indicadores oficiales del BCE (lo rellena el script)
scripts/update-data.mjs     Descarga Euríbor 12M y tipo medio vivienda del BCE
.github/workflows/          Ejecución automática diaria
mockups/                    Tres propuestas visuales
```

## Uso local

Abre `index.html` con un servidor estático (por ejemplo `npx serve .`), porque la página carga los JSON con `fetch`.

Para actualizar los indicadores a mano: `node scripts/update-data.mjs` (Node 20+).

## Actualización automática

El workflow `actualizar-datos.yml` se ejecuta cada día a las 06:17 UTC, actualiza `data/reference.json` y hace commit solo si hay cambios.

## Datos

- **Ofertas** (`data/offers.json`): comparativas publicadas en noviembre de 2026 (Rankia, ON Economia). Cada oferta lleva su fuente. Las cifras que faltan se dejan en `null`.
- **Euríbor** (`data/reference.json`): 3,109 % del 4 de septiembre de 2026, tomado de Rankia. Está desactualizado. Al ejecutarse en GitHub Actions, `update-data.mjs` lo sustituye por la serie oficial del BCE.
- **Supuestos**: seguro de vinculación 300 €/año y notaría 900 €. Son estimaciones, no datos publicados, y se indican en la web.

## Pendiente antes de publicar

1. **Verificar cada oferta** en la FiPer o en la web de la entidad. Las fuentes discrepan en algunos casos (TAE de Sabadell, TIN de BBVA).
2. **Completar los `null`** de `data/offers.json`, sobre todo el TIN sin vinculación de Santander y la comisión de apertura de varias entidades.
3. **Comprobar las claves del BCE** en `scripts/update-data.mjs`. Desde esta sesión no hay acceso al BCE.
4. **Logotipos y fotos**: no se han descargado. Las entidades usan un monograma hasta que haya logos con permiso de uso. Las fotos de Commons con licencia CC BY-SA sí son posibles, pero hay que descargarlas desde un entorno con acceso a `upload.wikimedia.org`.
5. **Activar GitHub Pages** (rama `main`, carpeta raíz).
6. **Revisar el texto legal**: la web se presenta como informativa, no como intermediario de crédito.

## Referencias consultadas

- Comparadores de referencia: OCU, Rankia, HelpMyCash, Rastreator, iAhorro, Credimarket.
- Calculadoras open source revisadas: solo la fórmula de cuota francesa. El código de la maqueta copiada se ha descartado.
- Serie de tipos del BCE: `MIR` (tipos de interés bancarios) y `FM` (Euríbor).
