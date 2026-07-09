---
name: Finanzas Personales
description: Panel de control financiero personal — oscuro, preciso, minimalista
colors:
  primary: "#22c55e"
  primary-glow: rgba(34, 197, 94, 0.25)
  green: "#10b981"
  red: "#ef4444"
  amber: "#f59e0b"
  cyan: "#06b6d4"
  ink: "#f0f2f5"
  ink-secondary: "#94a3b8"
  ink-tertiary: "#64748b"
  ink-muted: "#334155"
  surface-base: "#02040a"
  surface-elevated: "#0a0d16"
  surface-card: "#111522"
  surface-hover: "#1a1f30"
  border-subtle: rgba(255, 255, 255, 0.06)
  border-hover: rgba(255, 255, 255, 0.1)
typography:
  body:
    fontFamily: "'Fira Sans', system-ui, -apple-system, sans-serif"
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "'Fira Sans', system-ui, -apple-system, sans-serif"
    fontSize: 11px
    fontWeight: 500
    letterSpacing: 0.3px
  mono:
    fontFamily: "'Fira Code', 'Cascadia Code', monospace"
    fontSize: 13px
    fontWeight: 600
    fontVariantNumeric: tabular-nums
rounded:
  xs: 4px
  sm: 6px
  md: 10px
  lg: 14px
  xl: 20px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  xxl: 48px
components:
  btn-primary:
    backgroundColor: "#22c55e"
    textColor: "#ffffff"
    rounded: 6px
    padding: 9px 22px
    typography: "{typography.body}"
  btn-primary-hover:
    backgroundColor: "#22c55e"
    textColor: "#ffffff"
    rounded: 6px
    padding: 9px 22px
  btn-ghost:
    backgroundColor: transparent
    textColor: "#94a3b8"
    rounded: 6px
    padding: 6px 12px
    border: 1px solid rgba(255, 255, 255, 0.06)
  btn-danger:
    backgroundColor: "#ef4444"
    textColor: "#ffffff"
    rounded: 6px
    padding: 9px 22px
  input:
    backgroundColor: "#111522"
    textColor: "#f0f2f5"
    rounded: 6px
    padding: 9px 12px
    border: 1px solid rgba(255, 255, 255, 0.06)
  card:
    backgroundColor: "#111522"
    textColor: "#f0f2f5"
    rounded: 14px
    padding: 18px 20px
    border: 1px solid rgba(255, 255, 255, 0.06)
---

# Design System: Finanzas Personales

## 1. Overview

**Creative North Star: "El Panel de Control"**

Un panel de control financiero que funciona como la cabina de un avión: cada instrumento muestra una métrica precisa, cada control responde con feedback inmediato, y el diseño desaparece para dejar solo los datos. No hay concesiones decorativas; cada píxel tiene un trabajo.

La paleta es oscura de principio a fin — no por estética, sino porque el contenido financiero (números, tablas, gráficos) necesita el máximo contraste posible contra el fondo. Las superficies se distinguen por sutiles cambios de luminosidad, no por sombras. El acento verde (`#22c55e`) se usa con moderación: solo para el balance positivo, el botón primario, y el estado activo de navegación. Su rareza es lo que le da peso.

Este sistema rechaza explícitamente: gradientes decorativos, glassmorphism, side-stripe borders, tipografía superpuesta sobre imágenes, y cualquier patrón de SaaS genérico que añada ruido visual sin aportar información.

**Key Characteristics:**
- Oscuro profundo, no gris oscuro: el fondo base es `#02040a` (near-black)
- Una sola fuente sans (Fira Sans) más una mono (Fira Code) para números
- Sin sombras: la profundidad se construye con capas de color
- Animaciones precisas y breves (≤300ms), con curvas exponenciales suaves
- Los números usan tabular-nums para que no bailen al cambiar

## 2. Colors

La paleta es intencionalmente estrecha. Un acento (verde), tres colores semánticos (rojo, ámbar, cian), y una rampa de grises fríos sobre fondo near-black.

### Primary
- **Verde Terminal** (`#22c55e`, oklch 0.64 0.2 150): El acento único. Botón primario, saldo positivo, estado activo del sidebar, glow del goal-bar. No se usa en más del 10% de la pantalla.

### Neutral
- **Ink** (`#f0f2f5`): Texto principal y valores numéricos. Contraste 15:1 contra el fondo.
- **Ink Secondary** (`#94a3b8`): Metadatos, labels, descripciones secundarias.
- **Ink Tertiary** (`#64748b`): Placeholder, marcas de agua, texto deshabilitado.
- **Ink Muted** (`#334155`): Límite inferior de legibilidad; usado solo para fondos de proyección.
- **Surface Base** (`#02040a`): Fondo principal de la app. Casi negro absoluto.
- **Surface Elevated** (`#0a0d16`): Sidebar, toggle groups, goal projection backgrounds.
- **Surface Card** (`#111522`): Contenedores: cards, forms, transacciones, chart, toast.
- **Surface Hover** (`#1a1f30`): Hover de cards, inputs en foco, hover de side-btn.
- **Border Subtle** (rgba 255 255 255 / 0.06): Bordes por defecto de todas las superficies.
- **Border Hover** (rgba 255 255 255 / 0.1): Bordes en hover/foco.

### Semantic
- **Green** (`#10b981`): Indicador positivo (ingreso, on-track). Dot de tx-row ingreso.
- **Red** (`#ef4444`): Indicador negativo (gasto, off-track, error, delete). Botón danger.
- **Amber** (`#f59e0b`): Alertas, advertencias (uso futuro).
- **Cyan** (`#06b6d4`): Acento secundario en goal-card gradient.

### Named Rules
**The One Voice Rule.** El acento verde es el único color de llamada a la acción. Cualquier otro color que necesite atención usa rojo (error/peligro) o ámbar (advertencia). Cyan es solo decorativo en gradients de goal-card.

## 3. Typography

**Body Font:** Fira Sans (con system-ui, -apple-system, sans-serif como fallback)
**Mono Font:** Fira Code (con Cascadia Code, monospace como fallback)

**Character:** Fira Sans es una sans-serif humanista con un toque técnico — ni fría como una grotesk, ni redonda como una geométrica. Fira Code añade ligaduras de programación que refuerzan la sensación de "panel de control". La combinación es precisa sin ser quirúrgica.

### Hierarchy
- **Display** — no aplica. No hay hero headlines en esta app.
- **Headline** (600, 14px, 1.3): Títulos de sección ("Evolución anual", "Transacciones", "Metas de ahorro").
- **Title** (600, 15px, 1.3): Nombres de goals dentro de goal-card.
- **Body** (400, 13px, 1.5): Texto general, botones, labels de form. Max line length: 75ch.
- **Label** (500, 11px, 0.3px letter-spacing, uppercase): Labels de field, stat-label, headers de sidebar.
- **Mono/Number** (600, 13px-28px, tabular-nums, -0.5px letter-spacing): Todos los valores financieros. La variante tabular-nums evita que los números se muevan al cambiar.

### Named Rules
**The Mono Rule.** Todo valor monetario o porcentual usa Fira Code con font-variant-numeric: tabular-nums. Si no es un número, no va en mono.

## 4. Elevation

El sistema es **plano con bordes**. No se usan sombras (box-shadow) para crear profundidad. Las capas se distinguen exclusivamente por cambios en el color de fondo:

- `--surface-base` (#02040a): fondo, capa 0
- `--surface-elevated` (#0a0d16): capa 1 (sidebar, contenedores secundarios)
- `--surface-card` (#111522): capa 2 (cards, forms, transacciones)
- `--surface-hover` (#1a1f30): capa 3 (hover states)

La única excepción: el glow del acento (`--accent-glow`) se aplica como box-shadow en botones primarios y el indicador activo del sidebar — pero es un halo de color, no una sombra de profundidad.

### Named Rules
**The Flat-By-Default Rule.** Las superficies son planas en reposo. Sin sombras, sin gradientes de elevación. El hover state levanta el elemento con un cambio de color de fondo, no con una sombra.

## 5. Components

### Buttons
- **Shape:** Radius sm (6px). Esquinas sutilmente redondeadas, no agresivas.
- **Primary:** Fondo gradient `linear-gradient(135deg, var(--accent), #059669)`, texto blanco, weight 600. Box-shadow glow verde. Hover: translateY(-2px), glow aumenta. Active: scale(0.97).
- **Ghost/Small:** Borde sutil con texto secondary. Hover: borde más claro, texto pasa a ink. Active: scale(0.97).
- **Danger:** Fondo `#ef4444`, texto blanco. Hover: translateY(-2px) + shadow rojo. Active: scale(0.97).
- **Loading state:** Clase `.btn-loading` — spinner animado vía pseudo-elemento `::after`, texto oculto.
- **Success state:** Clase `.btn-success` — muestra SVG check, pointer-events none.

### Inputs & Forms
- **Shape:** Radius sm (6px). Fondo `--surface-card` con borde `--border-subtle`.
- **Focus:** Borde cambia a `--accent`, fondo pasa a `--surface-hover`.
- **Placeholder:** Color `--ink-tertiary` (#64748b), contrast ratio 4.5:1 contra fondo.
- **Error state:** Borde rojo, fondo `--red-subtle`, con focus ring rojo (`box-shadow 0 0 0 2px`). Mensaje `.field-error` en rojo con fade-in.
- **Toggle group:** Segmented control sin outline, fondo `--surface-elevated`, opción activa con fondo `--accent` y texto blanco.
- **Date inputs:** Calendar picker icon invertido (fondo oscuro).

### Cards & Containers
- **Corner Style:** Radius lg (14px).
- **Background:** `--surface-card` con borde `--border-subtle`.
- **Shadow Strategy:** Ninguno. La tarjeta se distingue por su color de fondo, no por sombra.
- **Border:** 1px solid `--border-subtle`. Hover: `--border-hover`.
- **Internal Padding:** 18px 20px (stat cards), 20px (goal cards), 18px 20px (tx-form).
- **Top accent bar:** Pseudo-elemento `::before` con gradient horizontal de 2px. Color según tipo: verde para balance/income, rojo para expense.

### Transaction Rows
- **Entry animation:** `@keyframes tx-in` — fade + translateY(8px), 0.3s ease-out.
- **Dot indicator:** Círculo de 7px. Verde (`--green`) con glow para ingresos. Rojo para gastos.
- **Amount:** Mono font, tabular-nums. Verde para positivo, rojo para negativo.
- **Editing state:** Borde `--accent`, fondo `--accent-subtle`, glow box-shadow.
- **Delete button:** Ghost hasta hover, donde se vuelve rojo con fondo `--red-subtle`.

### Sidebar Navigation
- **Style:** Anclada a la izquierda, 240px. Fondo `--surface-elevated` con borde derecho sutil.
- **Tabs:** Texto `--ink-secondary`. Hover: ligero background tint, texto pasa a `--ink`.
- **Active:** Fondo `--accent-subtle`, texto `--accent`. Indicador de 3px a la izquierda con gradient + glow.
- **Bottom section:** Separada por borde. Export button más pequeño, color más tenue.

### Goal Cards
- **Top bar:** Gradient `--accent` → `--cyan`, 2px.
- **Progress bar:** 6px altura, fondo `--surface-elevated`. Fill es gradient verde con transición width 0.8s ease-out.
- **Projection box:** Fondo `--surface-elevated`, borde sutil. Texto on-track en verde, off-track en rojo.
- **Actions:** Botones ghost pequeños, danger button se pone rojo en hover.

### Skeleton
- **Shimmer animation:** 1.5s ease-in-out infinite. Gradient de `--surface-card` a `--surface-hover` y vuelta.
- **Row skeleton:** 48px altura, radius md.
- **Card skeleton:** 100px altura, radius lg.

### Toast
- **Position:** Fixed bottom-right, z-index 10000. Columna, gap 8px.
- **Animation:** Slide-in desde la derecha (translateX(100%) → 0) con scale. 0.3s cubic-bezier.
- **Variants:** Icono circular con color de fondo semántico (success=green, error=red, info=accent).

### Confirm Modal
- **Dialog nativo** con backdrop blur (4px).
- **Content:** Card con shadow elevado, animation modal-in (scale 0.95 → 1, fade).
- **Actions:** Alineadas a la derecha, gap 8px.

### Empty State
- **Centered column:** 48px padding vertical. Icono circular con fondo hover.
- **Animation:** fade-in 0.35s.
- **Title:** 14px weight 600, color secondary. Desc: 12px tertiary, max-width 280px.

### Chart Card
- **Standard card shape** con chart-wrap de 300px height.
- **View toggle:** Segmented control AÑO / MES / SEMANA / DÍA.
- **Select/Date inputs:** Fondo elevated, tamaño 12px.

## 6. Do's and Don'ts

### Do:
- **Do** usar el acento verde escasamente (≤10% de la pantalla). Su rareza es su poder.
- **Do** usar Fira Code + tabular-nums para todo valor monetario o porcentual.
- **Do** usar las 5 capas de superficie para crear jerarquía visual.
- **Do** mantener botones pequeños y compactos (padding 9px 22px, font 13px).
- **Do** animar con `cubic-bezier(0.16, 1, 0.3, 1)` o `0.2s` para transiciones de estado.
- **Do** respetar `prefers-reduced-motion`: animaciones deben tener fallback a crossfade o instant.

### Don't:
- **Don't** usar sombras para crear profundidad. Usa capas de color.
- **Don't** usar side-stripe borders (border-left/right > 1px como acento). Usa la barra ::before o nada.
- **Don't** usar gradient text (background-clip: text). Un solo color sólido.
- **Don't** usar glassmorphism (backdrop-filter: blur decorativo).
- **Don't** usar el template hero-metric (número grande + label pequeño + gradiente). Los stat cards son planos.
- **Don't** usar cards idénticas con icono + heading + texto repetido.
- **Don't** usar tiny uppercase tracked eyebrow sobre cada sección. Un kicker deliberado sí, uno en cada sección no.
- **Don't** usar el verde (#22c55e) para nada que no sea positivo/financiero. El verde es dinero, no decoración.
- **Don't** mezclar Fira Sans con otra sans-serif similar. Una sans + una mono es suficiente.
- **Don't** usar placeholders claros (light gray) sobre fondo oscuro. Placeholder debe ser `--ink-tertiary` (#64748b) mínimo.
