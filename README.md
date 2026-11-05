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

## Pendiente antes de publicar

1. **Sustituir `data/offers.json`** por ofertas verificadas. Hoy son ejemplos: los nombres son genéricos y los tipos inventados para probar la lógica. Las cifras reales deben salir de la documentación precontractual de cada entidad.
2. **Verificar las claves de las series del BCE** en `scripts/update-data.mjs` (ver el catálogo en data.ecb.europa.eu). Si una falla, el script conserva el valor anterior y avisa en el log.
3. **Activar GitHub Pages** (rama `main`, carpeta raíz) para publicar la web.
4. Revisar el texto legal: la web se presenta como informativa, no como intermediario de crédito.

## Referencias consultadas

- Comparadores de referencia: OCU, Rankia, HelpMyCash, Rastreator, iAhorro, Credimarket.
- Calculadoras open source revisadas para la fórmula de cuota y la estructura: proyectos de calculadora hipotecaria en JavaScript publicados en GitHub.
- Serie de tipos del BCE: `MIR` (tipos de interés bancarios) y `FM` (Euríbor).
