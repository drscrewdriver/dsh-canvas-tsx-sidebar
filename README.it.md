# dsh-canvas-tsx-sidebar

[简体中文](README.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [Italiano](README.it.md) | [Русский](README.ru.md) | [Español](README.es.md)

Plugin web DSH (DeepSeek Harness) — **plugin consumer di dsh-better-sidebar**.

Analizza **staticamente** i file `*.canvas.tsx` del Qoder Canvas presenti nel workspace in pagine strutturate e li renderizza nella barra laterale destra di DSH.

> **Pipeline puramente statica**: il sorgente dei canvas non viene mai eseguito. Niente `eval`, niente `new Function`, niente bundler, niente iframe sandbox.
> Il parsing avviene lato browser con un leggero parser a discesa ricorsiva sviluppato internamente (zero dipendenze di parsing).

Questo repository include anche uno **Skill**: `skills/writing-qoder-canvas/`, che insegna agli LLM a scrivere questo formato. Vedi [Integrazione dello Skill](#integrazione-dello-skill-insegnare-agli-llm-a-scrivere-canvastsx).

**Perimetro di compatibilità**: **linea DSH 0.2.0** (questa linea) — `engines.dsh` è `>=0.2.0-rc.1 <0.2.1-0`, base testata: dsh-client-locale 0.2.0-rc.1, pubblicazione tramite il dist-tag npm **`dsh-0.2.0`**. 0.2.0 è puramente additivo per tutte le API dell'host usate da questo plugin (consuma solo `register(ns, locale, dict)` / `bind(ns)` di dsh-client-locale; la superficie di export client è identica a quella di 0.1.7-rc.2) — la linea di supporto viene quindi spostata in blocco in avanti, senza branch di compatibilità a runtime. **Scegliete sempre la versione del plugin in base alla versione di DSH** (non usate `latest` alla cieca su host vecchi: le `engines` del vecchio host non risultano soddisfatte e la preverifica di avvio lo disattiva in silenzio; anche i range caret non attraversano le minor dell'host):

| Host DSH | Ultima versione del plugin | dist-tag di installazione |
|---|---|---|
| 0.2.0 | **0.5.0** (latest) | `dsh-0.2.0` |
| 0.1.7 | 0.4.0 | `dsh-0.1.7` |
| 0.1.5 | 0.3.2 | `dsh-0.1.5` |
| 0.1.2 | 0.2.2 | `dsh-0.1.2` |
| 0.1.1 e precedenti | non supportato (la linea 0.1.2 ha come limite inferiore 0.1.2-rc.1) | — |

(al 2026-09-30; le linee precedenti sono servite da `compat/0.1.7` e dai branch congelati `compat/0.1.5` e `archive/release/0.1.2`.)

---

## Prerequisiti

- DSH `dsh web` funziona correttamente
- [dsh-better-sidebar](https://www.npmjs.com/package/dsh-better-sidebar) è installato (`>=0.19.1`)

Senza better-sidebar il plugin resta **completamente inerte**: le due registrazioni vengono silenziosamente saltate, senza alcun impatto sulle altre funzionalità di DSH.

## Installazione

### Metodo A (consigliato, CLI ufficiale)

```sh
# scegliete il dist-tag in base alla versione dell'host DSH (consigliato, niente latest alla cieca)
dsh plugin --profile <profile> add dsh-canvas-tsx-sidebar@dsh-0.2.0   # linea DSH 0.2.0 (0.5.0)
dsh plugin --profile <profile> add dsh-canvas-tsx-sidebar@dsh-0.1.7   # linea DSH 0.1.7 (0.4.0)
dsh plugin --profile <profile> add dsh-canvas-tsx-sidebar@dsh-0.1.5   # linea DSH 0.1.5 (0.3.2)
dsh plugin --profile <profile> add dsh-canvas-tsx-sidebar@dsh-0.1.2   # linea DSH 0.1.2 (0.2.2)
# alternativa: tarball locale (questa linea: dsh-canvas-tsx-sidebar-0.5.0.tgz)
dsh plugin --profile <profile> add <dsh-canvas-tsx-sidebar-0.5.0.tgz>
```

`dsh` aggiunge questo pacchetto a `dsh.profile.bundles`; all'avvio il `cordis.patch.yml` incluso nel pacchetto inserisce la voce del loader, e il bundle client viene registrato e distribuito secondo `entry.name`.

### Metodo B (manuale, alternativa)

1. Copiare il pacchetto in `~/.dsh/profiles/<profile>/node_modules/dsh-canvas-tsx-sidebar`
   (oppure aggiungere `"dsh-canvas-tsx-sidebar": "link:<percorso-del-plugin>"` tra le `dependencies` del `package.json` del profilo);
2. aggiungere la riga seguente a `~/.dsh/profiles/<profile>/cordis.patch.yml`:

   ```yaml
   - insert:
       - id: dsh-canvas-tsx-sidebar
         name: dsh-canvas-tsx-sidebar
   ```

3. eseguire `pnpm install` nella directory del profilo.

> ⚠️ **Scegliere il metodo A oppure il metodo B, non registrare due volte.**

### Attivazione

4. **Riavviare `dsh web`** — l'aggiunta di un bundle richiede un ricaricamento lato host (solo le modifiche al client di un plugin **già montato** beneficiano dell'hot reload);
5. hard refresh del browser (Ctrl+Shift+R).

Lo stato del mount può essere riverificato con `pwsh -NoProfile -File ./scripts/mount-check.ps1`.

## Utilizzo

Due punti di ingresso:

| Punto di ingresso | Attivazione | Comportamento |
|---|---|---|
| **Visualizzatore di file** (presa in carico) | Aprire un qualsiasi `.tsx` nell'albero dei file | `.canvas.tsx` → pagina strutturata + commutatore `Anteprima/Codice`; altri `.tsx` → vista del sorgente |
| **Scheda** | menu `+` della barra laterale destra → **Report Canvas** | inserimento manuale di un percorso da visualizzare, senza dover prima aprire il file nell'editor |

Il visualizzatore di file può essere disattivato nelle impostazioni della card Side; una volta disattivato, quel tipo di file torna al visualizzatore di codice integrato.

Aprire **un** file renderizza **quello** file — il plugin non esegue la scansione del workspace.

### Perché il visualizzatore di file deve rivendicare tutti i .tsx

`exts: ['tsx']` è l'unico modo praticabile per la rivendica, al prezzo di rivendicare anche i `.tsx` che non sono canvas. Le prove provengono tutte dal codice sorgente di better-sidebar e da verifiche reali nell'ecosistema:

| # | Vincolo | Prova |
|---|---|---|
| L1 | `extOf()` prende solo l'ultimo segmento di estensione → `extOf('a.canvas.tsx') === 'tsx'` | `src/client/paths.ts:80-85` |
| L2 | `exts: ['tsx']` rivendica **tutti** i `.tsx` del workspace, e priority 0 sopraffà il CodeMirror del `code` integrato (-100) | `service.ts:847-875` |
| L3 | `detect` viene invocato solo quando i byte di `head` sono disponibili, e `head` proviene solo da un `fs.read` binario — un `.tsx` testuale non raggiunge mai quel ramo | `service.ts:860` |
| L4 | dopo la rivendica del descriptor, `component` deve renderizzare, **nessuna API di delega/fallback** | `EditorHost.tsx:349,486` |
| L5 | il plugin di ecosistema `dsh-code-nav` ha `tsx` già nel proprio `LANG_EXT` e rivendica con `priority: 10` | `dsh-code-nav/src/lang-registry.js` |

→ Il riconoscimento di `.canvas.tsx` può avvenire solo all'interno del componente proprietario. Di conseguenza: **il visualizzatore rivendica tutti i `.tsx`** (i canvas vanno alla pagina, il resto al sorgente), e la **scheda** resta come secondo punto di ingresso che non passa dalla rivendica dei file.

## Integrazione dello Skill: insegnare agli LLM a scrivere .canvas.tsx

`skills/writing-qoder-canvas/` è uno Skill **autocontenuto e interamente trasportabile**:

```
skills/writing-qoder-canvas/
  SKILL.md                      # condizioni di attivazione, scheletro del file, cinque regole di ferro, elenco dei segnali d'allarme
  references/components.md      # i 38 tag davvero renderizzati + le prop di ciascuno (verifica automatica)
  references/expressions.md     # le regole chiuse del parser statico: quali valori sopravvivono
  references/layout.md          # scrivere per una sidebar da ~400px (non per un'anteprima da 960px)
  examples/status-report.canvas.tsx   # un modello renderizzabile, zero degradazioni garantite dai test
```

### Perché non mentirà

La documentazione tende a divergere, quindi ogni affermazione qui è ancorata al sorgente (`tests/skill.spec.ts`):

- l'elenco dei supporti in `components.md` deve essere **esattamente uguale, voce per voce**, ai tag `case` di `render.tsx` (38, ordine compreso);
- nessun nome presente nell'elenco dei «non supportati» può comparire nel renderer;
- `examples/status-report.canvas.tsx` deve renderizzarsi **senza alcuna degradazione** — nessun avviso `unsupported`, nessun riquadro tratteggiato per componenti sconosciuti.

Se documentazione e capacità reali divergono, `pnpm test` fallisce.

### Come installarlo in DSH

DSH scopre gli Skill in un insieme fisso di root, e uno Skill deve trovarsi **esattamente a un livello di profondità**: `<root>/<name>/SKILL.md`.
I `**/SKILL.md` annidati non vengono scoperti (il provider osserva ogni root con chokidar, `depth: 1`).

| rank | Origine | Percorso |
|---|---|---|
| 100 | `project-dsh` | `<projectRoot>/.dsh/skills` |
| 200 | `project-agents` | `<projectRoot>/.agents/skills` |
| 300 | `custom` | `customSkillDirs` della configurazione DSH |
| 400 | `user-dsh` | `~/.dsh/skills` |
| 500 | `user-agents` | `~/.agents/skills` |
| 600 | `bundled` | `$DSH_BUNDLED_SKILL_DIR` |

```powershell
# predefinito: installazione in ~/.agents/skills tramite junction (nessuna copia, nessuna deriva)
pwsh -NoProfile -File ./scripts/install-skill.ps1

# installazione altrove; -Copy crea una vera copia indipendente e trasportabile (deriva; rieseguire dopo le modifiche)
pwsh -NoProfile -File ./scripts/install-skill.ps1 -Target UserDsh
pwsh -NoProfile -File ./scripts/install-skill.ps1 -Path D:\some\skills -Copy

# disinstallazione
pwsh -NoProfile -File ./scripts/install-skill.ps1 -Uninstall
```

Il provider osserva le root, **non serve riavviare `dsh web`**: una volta installato, lo Skill compare nel catalogo degli skill della sessione successiva.

**Per impostazione predefinita junction invece della copia**, perché la copia tende a divergere — questo workspace ha già pagato su `memport` lo scotto di «tre copie mai sincronizzate». La junction mantiene la copia nel repository come unica fonte autorevole.

> `skills/` **non è tra i `files[]` del `package.json`**: è un asset del repository, non un artefatto pubblicato su npm.

## Vincoli di versione

Su `dsh-better-sidebar@0.19.0 / 0.19.1` il path seed di `openTab({ path })` viene dirottato all'editor di file e **le schede di tipo componente non vengono montate** (upstream #632, risolto dalla 0.19.2). Per questo il plugin **non dipende dal path seed**: risolve da sé il file di destinazione tramite `/sidebar/api` (`session.cwd` → `fs.tree` → `fs.read`) — una soluzione valida allo stesso modo su 0.19.2+.

## Skin e temi

**Il guscio del plugin** (schede, card impostazioni, pulsanti) consuma solo i token `--dsw-alias-*` di DSH e segue automaticamente tutte le skin e le modalità chiara/scura.

**Il sottoalbero dei documenti canvas è l'eccezione, ed è voluto**: un `.canvas.tsx` descrive un foglio a impaginazione fissa i cui colori decide l'autore; ricolorare in base alla skin altererebbe l'aspetto stesso del report. Per questo `styles.ts` usa valori di colore letterali e **ogni selettore è confinato sotto `.dsh-canvas-doc`**, senza sversamenti nell'UI host (`tests/render.spec.tsx` presidia lo scope, `tests/purity.spec.ts` presidia la superficie di registrazione).

## Limitazioni note

- Il parsing è affidato a un **parser leggero sviluppato internamente**, senza la precisione di un compilatore. Generici, decorator e chiamate arbitrarie non vengono modellati e vengono sempre degradati, ma **non viene mai sollevato un errore**.
- L'analisi dei valori segue un **insieme chiuso di regole** (dettagli in `skills/writing-qoder-canvas/references/expressions.md`).
  Supportati: letterali, asserzioni `as const` / `as T`, `const` letterali a livello di modulo e in testa al corpo di funzione,
  proiezioni `ARR.map(x => letterale)` su array statici, `canvasImage('letterale')`.
  Non supportati (**nessuna valutazione**): espressioni condizionali, chiamate di funzione, catene di membri, interpolazione di template, aritmetica, `new`, `await`,
  `const` in blocchi annidati, dati da `import` tra moduli.
  - un **nodo figlio** non letterale → renderizzato come barra di degradazione in linea, il frammento originale resta visibile;
  - una **proprietà** non letterale → la proprietà viene scartata, il nome registrato nell'`unresolved` dell'IR, le altre proprietà renderizzate normalmente.
- I tag in minuscolo vengono sempre trasmessi così come sono come HTML nativo; solo i componenti **in maiuscolo e non mappati** vengono renderizzati come riquadro tratteggiato con nome.
- Le schede vengono renderizzate **in sola lettura**.
- **Il parser è più tollerante di un compilatore**: il Qoder SDK chiede agli autori di correggere le diagnostiche con il «Canvas TypeScript check» dell'IDE, ma i file reali non sono sempre puliti. Davanti a TSX non valido questo plugin **non segnala errori e non si interrompe**, degrada solo il nodo interessato.
  Le diagnostiche autorevoli si possono vedere con `node scripts/syntax-oracle.cjs <file.canvas.tsx>`.

  > Verifica reale: alla riga 46 del campione incluso `cmp-cloud-sdk-report.canvas.tsx`,
  > `{'created': ...}` è TSX non valido (TypeScript riporta **TS1005 + TS1381** — operatore spread nudo).
  > Il plugin degrada quel punto in un marcatore in linea e renderizza normalmente le restanti 147 righe.

## Semantica degli spazi bianchi in JSX

I nodi figlio di testo vengono ripiegati seguendo rigorosamente la semantica di `cleanJSXElementLiteralChild` di React:

- **l'indentazione iniziale viene sempre rimossa** su ogni riga diversa dalla prima;
- **gli spazi finali dell'ultima riga vengono conservati** — quello spazio è portante: separa il testo dal contenitore di espressione immediatamente successivo
  (es. lo spazio in `…somma (0 + {'created': ...})…`; senza, i due segmenti si incollerebbero).

## Sviluppo

```sh
pnpm install
pnpm typecheck     # tsc (con la verifica zero dipendenze Node lato solo client)
pnpm test          # vitest
pnpm build         # tsc dts + tsdown (metà host + bundle client)
pnpm run audit:bundle   # audit dei veri artefatti di build
```

## Script di sviluppo

| Script | Uso |
|---|---|
| `scripts/dump-ir.ts` | Esporta la struttura IR / JSON / fixture golden di un file (`--write`) |
| `scripts/syntax-oracle.cjs` | Stabilisce con il **vero compilatore TypeScript** se un file sorgente è TSX valido (`typescript` resta una devDependency e non entra nel bundle) |
| `scripts/audit-bundle.cjs` | Audit dei veri artefatti di build: fughe di moduli integrati, re-parser, `eval`, registrazioni fuori ambito |
| `scripts/mount-check.ps1` | Verifica/ripara il mount del profilo (ASCII puro, compatibile con Windows PowerShell 5.1) |
| `scripts/install-skill.ps1` | Installa `skills/writing-qoder-canvas` in una root di skill DSH (predefinito: junction) |
| `scripts/component-census.cjs` | Censimento autonomo dei componenti (senza tabella di componenti codificata, sensibile al multi-riga) |
| `scripts/corpus-stats.ts` / `format-economics.ts` / `audit-corpus.ts` / `corpus-gaps.ts` | Statistiche del corpus e misure reali di economia del formato (fonte dei numeri di `docs/canvas-format-rules.md`) |
