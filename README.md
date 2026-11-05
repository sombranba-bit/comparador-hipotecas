# Comparador de hipotecas

Simulador y comparador de hipotecas en España. Ordena las ofertas por **coste total** (intereses, comisiones y seguros exigidos), no solo por tipo. Las cifras son orientativas y no están verificadas con cada entidad.

## Estructura

```
index.html                  Página principal (sin build)
assets/styles.css           Estilos y animaciones
assets/app.js               Simulador, comparador y reveal al hacer scroll
data/offers.json            Ofertas (DATOS DE EJEMPLO por ahora)
data/reference.json         Euríbor 12M y fecha de referencia
scripts/update-data.mjs     Intenta descargar el Euríbor 12M del BCE
.github/workflows/          Ejecución automática diaria
mockups/                    Tres propuestas visuales
```

## Uso local

Abre `index.html` con un servidor estático (por ejemplo `npx serve .`), porque la página carga los JSON con `fetch`.

Para actualizar los indicadores a mano: `node scripts/update-data.mjs` (Node 20+).

## Actualización automática

El workflow `actualizar-datos.yml` se ejecuta cada día a las 06:17 UTC, actualiza `data/reference.json` y hace commit solo si hay cambios.

## Datos

- **Ofertas** (`data/offers.json`): 15 productos de fijas y una variable, tomados de comparadores (Rankia, Rastreator, Kelisto, Selectra, HelpMyCash, sincomisiones, Roams, hipotecas.me, euribor.com.es) entre julio y noviembre de 2026. Cada oferta lleva su fuente y su fecha. **No están verificados con cada entidad.** Donde las fuentes discrepan, la oferta tiene una `nota`.
- **Euríbor** (`data/reference.json`): cierre diario del 4 de noviembre de 2026, 3,302 %, según la página de Expansión. El script `update-data.mjs` intenta sustituirlo por la serie del BCE en GitHub Actions, pero desde esta sesión el BCE no responde.
- **Supuestos**: seguro de vinculación por oferta (`seguro_anual`, según la web de cada entidad; si es `null`, 300 €/año de `seguro_anual_estimado`), solo en ofertas con `seguro_vinculado` distinto de `false`; y notaría 900 €. Son estimaciones y se indican en la web.
- **Ofertas sin TAE sin vinculación**: se muestran como "TAE sin dato" y no se calcula.

## Pendiente antes de publicar

1. **Verificar las cifras con cada entidad** (ficha precontractual o web oficial). Las webs de Sabadell, Bankinter y Unicaja no han sido accesibles desde esta sesión, y la de Cajamar bloquea robots.
2. **Sabadell**: TAE bonificada 3,58 % frente a 3,67 % en la fuente de octubre.
3. **Bankinter**: TIN 3,20 % a 20 años frente a 2,85 % a 25 años en Rastreator.
4. **Unicaja**: el aumento de junio de 2026 no coincide con las cifras de julio a septiembre.
5. **Abanca** y **Caja de Ingenieros**: sin confirmar si el tipo es con o sin vinculación.
6. **Seguros de vinculación**: solo Sabadell, Bankinter, Santander e Ibercaja publican un coste de seguros en su web y se usa ese dato. En el resto el importe es una estimación de 300 €/año. Banca March, Openbank, BBVA, CaixaBank, Unicaja y Cajamar exigen seguros pero no publican su prima en la página consultada. MyInvestor no exige seguros.
7. **Verificación**: 11 entidades con cifras de su web oficial (Ibercaja, Banca March, Sabadell, Openbank, BBVA, Santander, CaixaBank, MyInvestor, Bankinter, Unicaja y Abanca); Kutxabank, Caja de Ingenieros, imagin y Cajamar solo con comparador, porque su web no se pudo leer.
7. **Euríbor del BCE**: comprobar las claves de `scripts/update-data.mjs` cuando haya acceso.
8. **Logotipos**: CaixaBank usa un icono CC0 de simple-icons; la marca sigue siendo de CaixaBank. El resto usa monograma. No hay fotos.
9. **Activar GitHub Pages** (rama `main`, carpeta raíz).
10. **Revisar el texto legal**: la web se presenta como informativa, no como intermediario de crédito.

## Referencias consultadas

- Comparadores de referencia: OCU, Rankia, HelpMyCash, Rastreator, iAhorro, Credimarket.
- Calculadoras open source revisadas: solo la fórmula de cuota francesa. El código de la maqueta copiada se ha descartado.
- Serie de tipos del BCE: `MIR` (tipos de interés bancarios) y `FM` (Euríbor).
