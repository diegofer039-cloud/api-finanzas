# Chart Redesign — Migración a Chart.js + mejora visual

## Resumen

Reemplazar la implementación manual de Canvas 2D por Chart.js v4 con plugin de zoom, mejorando el diseño visual, la interactividad y reduciendo código mantenido manualmente (~400 líneas eliminadas).

## Stack

- [Chart.js v4](https://www.chartjs.org/) — librería de gráficos
- [chartjs-plugin-zoom v2.2](https://github.com/chartjs/chartjs-plugin-zoom) — zoom/pan
- CDN vía jsDelivr (sin build step)

## Dependencias

```html
<script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
<script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-zoom@2.2.0/dist/chartjs-plugin-zoom.min.js"></script>
```

El plugin se auto-registra en el bundle browser, no requiere `Chart.register()`.

## Arquitectura

- Función `renderChart()` reemplaza `drawChart()` completa
- Instancia global `window._chartInstance` para `destroy()` y recreación
- `getChartData()` permanece igual (retorna `{ values, volumes, labels }`)
- Se ignora `volumes` (barras de actividad eliminadas)
- `updateChartControls()` se mantiene, llama `renderChart()` al cambiar vista
- Event listeners de mouse/wheel/zoom manual se eliminan (Chart.js maneja todo)

## Configuración visual

| Propiedad | Valor |
|---|---|
| `type` | `'line'` |
| `tension` | `0.35` (curva suave) |
| `pointRadius` | `0` |
| `pointHoverRadius` | `5` |
| `borderWidth` | `3` |
| `borderColor` | `'#00e676'` (o `'#ff5252'` si último valor < 0) |
| `fill` | `true` + plugin custom gradient (30% → 0%) |
| `animation.duration` | `1200` |
| `animation.easing` | `'easeOutQuart'` |
| `legend.display` | `false` |
| `scales.x.grid.display` | `false` |
| `scales.y.grid.color` | `'rgba(255,255,255,0.06)'` |
| `scales.y.grid.display` | `true` |
| `scales.y.ticks.callback` | formato moneda `es-CO` |
| `scales.x.ticks.color` | `'rgba(255,255,255,0.22)'` |
| `scales.y.ticks.color` | `'rgba(255,255,255,0.4)'` |

## Plugin: gradient fill

Se registra un plugin custom `chartAreaGradient` que en hook `beforeDraw` pinta el gradiente bajo la línea usando los ejes del chart. El gradiente va del color de la línea con 30% de opacidad a 0% transparente.

## Plugin: zoom

```js
plugins: {
  zoom: {
    pan: { enabled: true, mode: 'x', threshold: 10 },
    zoom: {
      wheel: { enabled: true },
      pinch: { enabled: true },
      mode: 'x',
    },
    limits: {
      x: { minRange: 2 },  // mínimo 2 puntos visibles
    },
  },
}
```

- Aparece botón "Reset zoom" (`chart.resetZoom()`) solo cuando el zoom ha sido aplicado
- El botón se muestra/oculta escuchando el evento `'zoom'` y `'pan'` del plugin

## Tooltip

```js
tooltip: {
  mode: 'index',
  intersect: false,
  backgroundColor: 'rgba(8,8,16,0.94)',
  titleFont: { weight: '600', size: 11 },
  bodyFont: { size: 11 },
  padding: 10,
  cornerRadius: 8,
  displayColors: false,
  callbacks: {
    label: (ctx) => formateo moneda,
  },
}
```

## Comportamiento responsive

- `responsive: true`
- `maintainAspectRatio: false`
- Chart.js maneja resize automáticamente via `ResizeObserver`
- Se elimina el handler `window resize` manual y el `dpr` scaling manual

## Eliminaciones

Archivo `app.js`:
- Eliminar: `drawChart()` completo (líneas ~454-817)
- Eliminar: `catmullRomSpline()` (~430-446)
- Eliminar: `chartAnimId`, `chartZoom`, `_chartMoveHandler`, `_chartOutHandler`, `_chartWheelHandler`, `_chartDrawing`
- Eliminar: `window resize` listener asociado al chart

Archivo `index.html`:
- Reemplazar `<canvas id="line-chart">` por el mismo canvas (se reusa)
- Eliminar `<div id="chart-empty">` (Chart.js maneja datasets vacíos)

## Archivos modificados

- `api-finanzas/frontend/index.html` — +2 scripts CDN
- `api-finanzas/frontend/app.js` — reemplazar `drawChart()` por `renderChart()`, eliminar ~400 líneas
- `api-finanzas/frontend/style.css` — ajustar altura `.chart-wrap` (de 240px a 300px)
