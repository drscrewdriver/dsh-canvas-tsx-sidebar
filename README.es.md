# dsh-canvas-tsx-sidebar

[简体中文](README.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [Italiano](README.it.md) | [Русский](README.ru.md) | [Español](README.es.md)

Plugin web de DSH (DeepSeek Harness) — **plugin consumidor de dsh-better-sidebar**.

Analiza **estáticamente** los `*.canvas.tsx` del Qoder Canvas del espacio de trabajo en páginas estructuradas y los renderiza en la barra lateral derecha de DSH.

> **Pipeline puramente estático**: el código fuente de los canvas no se ejecuta. Sin `eval`, sin `new Function`, sin bundler, sin iframe sandbox.
> El análisis lo realiza en el navegador un parser ligero de descenso recursivo desarrollado internamente (cero dependencias de parser).

Este repositorio incluye además un **Skill**: `skills/writing-qoder-canvas/`, que enseña a los LLM a escribir este formato. Ver [Integración del Skill](#integración-del-skill-enseñar-a-los-llm-a-escribir-canvastsx).

**Alcance de compatibilidad**: **línea DSH 0.2.0** (esta línea) — `engines.dsh` es `>=0.2.0-rc.1 <0.2.1-0`, base probada: dsh-client-locale 0.2.0-rc.1, publicación mediante el dist-tag de npm **`dsh-0.2.0`**. 0.2.0 es puramente aditivo para todas las API del host que usa este plugin (solo consume `register(ns, locale, dict)` / `bind(ns)` de dsh-client-locale; la superficie de exportación del cliente es idéntica a la de 0.1.7-rc.2), por lo que la línea de soporte se desplaza en bloque hacia delante sin necesidad de rama de compatibilidad en tiempo de ejecución. **Elija siempre la versión del plugin según la versión de DSH** (no use `latest` a ciegas en hosts antiguos: no se cumplen las `engines` del host antiguo y la preverificación de arranque lo desactiva en silencio; los rangos caret tampoco cruzan minor del host):

| Host DSH | Última versión del plugin | dist-tag de instalación |
|---|---|---|
| 0.2.0 | **0.5.0** (latest) | `dsh-0.2.0` |
| 0.1.7 | 0.4.0 | `dsh-0.1.7` |
| 0.1.5 | 0.3.2 | `dsh-0.1.5` |
| 0.1.2 | 0.2.2 | `dsh-0.1.2` |
| 0.1.1 y anteriores | no soportado (la línea 0.1.2 tiene como límite inferior 0.1.2-rc.1) | — |

(a fecha de 2026-09-30; las líneas antiguas las atienden `compat/0.1.7` y las ramas congeladas `compat/0.1.5` y `archive/release/0.1.2`.)

---

## Requisitos previos

- DSH `dsh web` funcionando correctamente
- [dsh-better-sidebar](https://www.npmjs.com/package/dsh-better-sidebar) instalado (`>=0.19.1`)

Sin better-sidebar el plugin queda **totalmente inerte**: los dos registros se omiten en silencio, sin afectar al resto de funciones de DSH.

## Instalación

### Método A (recomendado, CLI oficial)

```sh
# elija el dist-tag según la versión del host DSH (recomendado, no use latest a ciegas)
dsh plugin --profile <profile> add dsh-canvas-tsx-sidebar@dsh-0.2.0   # línea DSH 0.2.0 (0.5.0)
dsh plugin --profile <profile> add dsh-canvas-tsx-sidebar@dsh-0.1.7   # línea DSH 0.1.7 (0.4.0)
dsh plugin --profile <profile> add dsh-canvas-tsx-sidebar@dsh-0.1.5   # línea DSH 0.1.5 (0.3.2)
dsh plugin --profile <profile> add dsh-canvas-tsx-sidebar@dsh-0.1.2   # línea DSH 0.1.2 (0.2.2)
# alternativa: tarball local (esta línea: dsh-canvas-tsx-sidebar-0.5.0.tgz)
dsh plugin --profile <profile> add <dsh-canvas-tsx-sidebar-0.5.0.tgz>
```

`dsh` añade este paquete a `dsh.profile.bundles`; al arrancar, el `cordis.patch.yml` incluido en el paquete inserta la entrada del loader, y el bundle del cliente se registra y distribuye según `entry.name`.

### Método B (manual, alternativo)

1. Copiar el paquete en `~/.dsh/profiles/<profile>/node_modules/dsh-canvas-tsx-sidebar`
   (o añadir `"dsh-canvas-tsx-sidebar": "link:<ruta-del-plugin>"` en las `dependencies` del `package.json` del perfil);
2. añadir esta línea a `~/.dsh/profiles/<profile>/cordis.patch.yml`:

   ```yaml
   - insert:
       - id: dsh-canvas-tsx-sidebar
         name: dsh-canvas-tsx-sidebar
   ```

3. ejecutar `pnpm install` en el directorio del perfil.

> ⚠️ **Elija el método A o el método B, no registre dos veces.**

### Puesta en marcha

4. **Reiniciar `dsh web`** — añadir un bundle exige recargar en el lado del host (solo los cambios de cliente de un plugin **ya montado** se recargan en caliente);
5. recarga dura del navegador (Ctrl+Shift+R).

El estado del montaje se puede reverificar con `pwsh -NoProfile -File ./scripts/mount-check.ps1`.

## Uso

Dos puntos de entrada:

| Punto de entrada | Activación | Comportamiento |
|---|---|---|
| **Visor de archivos** (toma de control) | Abrir cualquier `.tsx` en el árbol de archivos | `.canvas.tsx` → página estructurada + conmutador `Vista previa/Código`; otros `.tsx` → vista del código fuente |
| **Pestaña** | menú `+` de la barra lateral derecha → **Informe Canvas** | escribir una ruta a mano para verla, sin abrir antes el archivo en el editor |

El visor de archivos se puede desactivar en los ajustes de la tarjeta Side; al desactivarlo, ese tipo de archivo vuelve al visor de código integrado.

Abrir **un** archivo renderiza **ese** archivo — el plugin no escanea el espacio de trabajo.

### Por qué el visor de archivos debe reclamar todos los .tsx

`exts: ['tsx']` es la única forma viable de reclamar, al precio de reclamar también los `.tsx` que no son canvas. Todas las pruebas provienen del código fuente de better-sidebar y de comprobaciones reales del ecosistema:

| # | Restricción | Prueba |
|---|---|---|
| L1 | `extOf()` toma solo el último segmento de extensión → `extOf('a.canvas.tsx') === 'tsx'` | `src/client/paths.ts:80-85` |
| L2 | `exts: ['tsx']` reclama **todos** los `.tsx` del espacio de trabajo, y priority 0 aplasta el CodeMirror del `code` integrado (-100) | `service.ts:847-875` |
| L3 | `detect` solo se llama cuando hay bytes de `head` disponibles, y `head` viene solo de un `fs.read` binario — un `.tsx` textual nunca llega a esa rama | `service.ts:860` |
| L4 | tras el reclamo del descriptor, `component` debe renderizarse, **sin API de delegación/retorno** | `EditorHost.tsx:349,486` |
| L5 | el plugin del ecosistema `dsh-code-nav` ya incluye `tsx` en su `LANG_EXT` y reclama con `priority: 10` | `dsh-code-nav/src/lang-registry.js` |

→ El reconocimiento de `.canvas.tsx` solo puede hacerse dentro del componente propio. Por eso: **el visor reclama todos los `.tsx`** (los canvas van a la página, el resto al código fuente), y la **pestaña** se conserva como segunda entrada que no pasa por el reclamo de archivos.

## Integración del Skill: enseñar a los LLM a escribir .canvas.tsx

`skills/writing-qoder-canvas/` es un Skill **autocontenido y completamente transportable**:

```
skills/writing-qoder-canvas/
  SKILL.md                      # condiciones de activación, esqueleto del archivo, cinco reglas de hierro, lista de señales de alerta
  references/components.md      # los 38 tags que de verdad se renderizan + las prop de cada uno (verificación automática)
  references/expressions.md     # las reglas cerradas del parser estático: qué valores sobreviven
  references/layout.md          # escribir para una barra lateral de ~400px (no para una vista previa de 960px)
  examples/status-report.canvas.tsx   # un modelo renderizable, con cero degradaciones garantizadas por los tests
```

### Por qué no mentirá

La documentación se desvía, así que aquí cada afirmación está anclada al código fuente (`tests/skill.spec.ts`):

- la lista de soportados de `components.md` debe ser **exactamente igual, elemento por elemento**, a los tags `case` de `render.tsx` (38, incluido el orden);
- ningún nombre de la lista de «no soportados» puede aparecer en el renderer;
- `examples/status-report.canvas.tsx` debe renderizarse **sin ninguna degradación** — sin avisos `unsupported`, sin cuadros discontinuos de componentes desconocidos.

Si la documentación y las capacidades reales divergen, `pnpm test` falla.

### Cómo instalarlo en DSH

DSH descubre los Skill en un conjunto fijo de roots, y un Skill debe estar **exactamente a un nivel de profundidad**: `<root>/<name>/SKILL.md`.
Los `**/SKILL.md` anidados no se descubren (el provider vigila cada root con chokidar, `depth: 1`).

| rank | Origen | Ruta |
|---|---|---|
| 100 | `project-dsh` | `<projectRoot>/.dsh/skills` |
| 200 | `project-agents` | `<projectRoot>/.agents/skills` |
| 300 | `custom` | `customSkillDirs` de la configuración de DSH |
| 400 | `user-dsh` | `~/.dsh/skills` |
| 500 | `user-agents` | `~/.agents/skills` |
| 600 | `bundled` | `$DSH_BUNDLED_SKILL_DIR` |

```powershell
# por defecto: instala en ~/.agents/skills mediante junction (sin copias, sin deriva)
pwsh -NoProfile -File ./scripts/install-skill.ps1

# instalar en otro sitio; -Copy crea una copia real independiente (deriva; volver a ejecutar tras los cambios)
pwsh -NoProfile -File ./scripts/install-skill.ps1 -Target UserDsh
pwsh -NoProfile -File ./scripts/install-skill.ps1 -Path D:\some\skills -Copy

# desinstalación
pwsh -NoProfile -File ./scripts/install-skill.ps1 -Uninstall
```

El provider vigila los roots, **no hace falta reiniciar `dsh web`**: tras instalar, el Skill aparece en el catálogo de skills de la siguiente sesión.

**Por defecto junction en lugar de copia**, porque la copia deriva — este espacio de trabajo ya aprendió la lección con `memport` y sus «tres copias nunca sincronizadas». La junction hace que la copia del repositorio sea siempre la única fuente autorizada.

> `skills/` **no está en los `files[]` del `package.json`**: es un activo del repositorio, no un artefacto publicado en npm.

## Restricciones de versión

En `dsh-better-sidebar@0.19.0 / 0.19.1`, el path seed de `openTab({ path })` se desvía al editor de archivos y **la pestaña de tipo componente no se monta** (upstream #632, corregido a partir de 0.19.2). Por eso este plugin **no depende del path seed**: resuelve por su cuenta el archivo de destino mediante `/sidebar/api` (`session.cwd` → `fs.tree` → `fs.read`) — una solución igual de válida en 0.19.2+.

## Skins y temas

**La carcasa del plugin** (pestañas, tarjeta de ajustes, botones) solo consume los tokens `--dsw-alias-*` de DSH y sigue automáticamente todos los skins y el modo claro/oscuro.

**El subárbol de documentos canvas es la excepción, y a propósito**: un `.canvas.tsx` describe una hoja de maquetación fija cuyo color decide el autor; recolorear según el skin cambiaría el aspecto del propio informe. Por eso `styles.ts` usa valores de color literales y **cada selector queda confinado bajo `.dsh-canvas-doc`**, sin fugas hacia la UI del host (`tests/render.spec.tsx` custodia el ámbito, `tests/purity.spec.ts` custodia la superficie de registro).

## Limitaciones conocidas

- El análisis corre a cargo de un **parser ligero desarrollado internamente**, sin precisión de compilador. Genéricos, decoradores y llamadas arbitrarias no se modelan y siempre se degradan, pero **nunca se lanza un error**.
- El análisis de valores sigue un **conjunto cerrado de reglas** (detalle en `skills/writing-qoder-canvas/references/expressions.md`).
  Soportados: literales, aserciones `as const` / `as T`, `const` literales a nivel de módulo y al inicio del cuerpo de una función,
  proyecciones `ARR.map(x => literal)` sobre arrays estáticos, `canvasImage('literal')`.
  No soportados (**no se evalúan**): expresiones condicionales, llamadas a funciones, cadenas de miembros, interpolación de plantillas, aritmética, `new`, `await`,
  `const` dentro de bloques anidados, datos de `import` entre módulos.
  - un **nodo hijo** no literal → se renderiza como barra de degradación en línea, el fragmento original queda visible;
  - una **propiedad** no literal → la propiedad se descarta, su nombre queda registrado en el `unresolved` del IR, y el resto de propiedades se renderizan con normalidad.
- Los tags en minúscula pasan siempre tal cual como HTML nativo; solo los componentes **en mayúscula y sin mapear** se renderizan como cuadro discontinuo con nombre.
- Las pestañas se renderizan **en solo lectura**.
- **El parser es más tolerante que un compilador**: el Qoder SDK exige a los autores corregir los diagnósticos con el «Canvas TypeScript check» del IDE, pero los archivos reales no siempre están limpios. Ante un TSX ilegal este plugin **no da error ni se interrumpe**, solo degrada el nodo problemático.
  Los diagnósticos con autoridad se pueden ver con `node scripts/syntax-oracle.cjs <file.canvas.tsx>`.

  > Comprobado en la práctica: la línea 46 del ejemplo incluido en el repositorio `cmp-cloud-sdk-report.canvas.tsx`,
  > `{'created': ...}`, es TSX ilegal (TypeScript reporta **TS1005 + TS1381** — operador spread desnudo).
  > El plugin degrada ese punto a una marca en línea y renderiza con normalidad las otras 147 líneas.

## Semántica de los espacios en blanco en JSX

Los nodos hijos de texto se pliegan estrictamente según la semántica de `cleanJSXElementLiteralChild` de React:

- **la sangría inicial de toda línea que no sea la primera se elimina siempre**;
- **los espacios finales de la última línea se conservan** — ese espacio es estructural: separa el texto del contenedor de expresión que viene justo después
  (ej.: el espacio en `…suma (0 + {'created': ...})…`; si se quita, los dos segmentos se pegarían).

## Desarrollo

```sh
pnpm install
pnpm typecheck     # tsc (incluye la verificación de cero dependencias de Node solo en el cliente)
pnpm test          # vitest
pnpm build         # tsc dts + tsdown (mitad host + bundle de cliente)
pnpm run audit:bundle   # auditoría de los artefactos reales de build
```

## Scripts de desarrollo

| Script | Uso |
|---|---|
| `scripts/dump-ir.ts` | Exporta el esquema IR / JSON / fixtures dorados de un archivo (`--write`) |
| `scripts/syntax-oracle.cjs` | Determina con el **compilador TypeScript real** si un archivo fuente es TSX válido (`typescript` sigue siendo devDependency y no entra en el bundle) |
| `scripts/audit-bundle.cjs` | Auditoría de los artefactos reales de build: fugas de módulos integrados, re-parsers, `eval`, registros fuera de ámbito |
| `scripts/mount-check.ps1` | Comprueba/repara el montaje del perfil (ASCII puro, compatible con Windows PowerShell 5.1) |
| `scripts/install-skill.ps1` | Instala `skills/writing-qoder-canvas` en un root de skills de DSH (por defecto junction) |
| `scripts/component-census.cjs` | Censo autónomo de componentes (sin tabla de componentes codificada a mano, consciente del multi-línea) |
| `scripts/corpus-stats.ts` / `format-economics.ts` / `audit-corpus.ts` / `corpus-gaps.ts` | Estadísticas del corpus y mediciones reales de la economía del formato (fuente de las cifras de `docs/canvas-format-rules.md`) |
