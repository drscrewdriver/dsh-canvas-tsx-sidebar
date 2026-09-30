# dsh-canvas-tsx-sidebar

[简体中文](README.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [Italiano](README.it.md) | [Русский](README.ru.md) | [Español](README.es.md)

Plugin web DSH (DeepSeek Harness) — **plugin consommateur de dsh-better-sidebar**.

Il analyse **statiquement** les `*.canvas.tsx` du Qoder Canvas présents dans l'espace de travail en pages structurées, puis les affiche dans la barre latérale droite de DSH.

> **Pipeline purement statique** : le code source des canvas n'est jamais exécuté. Pas d'`eval`, pas de `new Function`, pas de bundler, pas d'iframe sandboxée.
> L'analyse est réalisée côté navigateur par un parseur à descente récursive léger développé en interne (zéro dépendance de parseur).

Ce dépôt embarque également un **Skill** : `skills/writing-qoder-canvas/`, qui apprend aux LLM à écrire ce format. Voir [Intégration du Skill](#intégration-du-skill--apprendre-aux-llm-à-écrire-du-canvastsx).

**Périmètre de compatibilité** : **ligne DSH 0.2.0** (cette ligne) — `engines.dsh` vaut `>=0.2.0-rc.1 <0.2.1-0`, base testée : dsh-client-locale 0.2.0-rc.1, publication via le dist-tag npm **`dsh-0.2.0`**. 0.2.0 est purement additif pour toutes les API d'hôte utilisées par ce plugin (il ne consomme que `register(ns, locale, dict)` / `bind(ns)` de dsh-client-locale ; la surface d'export client est identique à celle de 0.1.7-rc.2) — la ligne de support est donc décalée en bloc vers l'avant, sans branche de compatibilité à l'exécution. **Choisissez toujours la version du plugin selon la version de DSH** (n'utilisez pas `latest` aveuglément sur un hôte ancien : les `engines` de l'ancien hôte ne sont plus satisfaites et la prévérification de démarrage le désactive en silence ; les plages caret ne traversent pas non plus les minor de l'hôte) :

| Hôte DSH | Dernière version du plugin | dist-tag d'installation |
|---|---|---|
| 0.2.0 | **0.5.0** (latest) | `dsh-0.2.0` |
| 0.1.7 | 0.4.0 | `dsh-0.1.7` |
| 0.1.5 | 0.3.2 | `dsh-0.1.5` |
| 0.1.2 | 0.2.2 | `dsh-0.1.2` |
| 0.1.1 et antérieurs | non pris en charge (la ligne 0.1.2 a pour borne inférieure 0.1.2-rc.1) | — |

(au 2026-09-30 ; les lignes anciennes sont servies par `compat/0.1.7` ainsi que les branches gelées `compat/0.1.5` et `archive/release/0.1.2`.)

---

## Prérequis

- DSH `dsh web` fonctionne correctement
- [dsh-better-sidebar](https://www.npmjs.com/package/dsh-better-sidebar) est installé (`>=0.19.1`)

Sans better-sidebar, le plugin reste **totalement inerte** : les deux enregistrements sont silencieusement ignorés, sans impact sur les autres fonctionnalités de DSH.

## Installation

### Méthode A (recommandée, CLI officiel)

```sh
# choisissez le dist-tag selon la version de l'hôte DSH (recommandé, pas de latest aveugle)
dsh plugin --profile <profile> add dsh-canvas-tsx-sidebar@dsh-0.2.0   # ligne DSH 0.2.0 (0.5.0)
dsh plugin --profile <profile> add dsh-canvas-tsx-sidebar@dsh-0.1.7   # ligne DSH 0.1.7 (0.4.0)
dsh plugin --profile <profile> add dsh-canvas-tsx-sidebar@dsh-0.1.5   # ligne DSH 0.1.5 (0.3.2)
dsh plugin --profile <profile> add dsh-canvas-tsx-sidebar@dsh-0.1.2   # ligne DSH 0.1.2 (0.2.2)
# alternative : tarball local (cette ligne : dsh-canvas-tsx-sidebar-0.5.0.tgz)
dsh plugin --profile <profile> add <dsh-canvas-tsx-sidebar-0.5.0.tgz>
```

`dsh` ajoute ce paquet à `dsh.profile.bundles` ; au démarrage, le `cordis.patch.yml` fourni avec le paquet insère l'entrée du loader, et le bundle client est enregistré puis distribué selon `entry.name`.

### Méthode B (manuelle, alternative)

1. Copiez le paquet dans `~/.dsh/profiles/<profile>/node_modules/dsh-canvas-tsx-sidebar`
   (ou ajoutez `"dsh-canvas-tsx-sidebar": "link:<chemin-du-plugin>"` dans les `dependencies` du `package.json` du profil) ;
2. ajoutez la ligne suivante à `~/.dsh/profiles/<profile>/cordis.patch.yml` :

   ```yaml
   - insert:
       - id: dsh-canvas-tsx-sidebar
         name: dsh-canvas-tsx-sidebar
   ```

3. exécutez `pnpm install` dans le répertoire du profil.

> ⚠️ **Choisissez la méthode A ou la méthode B, n'enregistrez pas deux fois.**

### Activation

4. **Redémarrez `dsh web`** — l'ajout d'un bundle nécessite un rechargement côté hôte (seules les modifications du client d'un plugin **déjà monté** sont rechargées à chaud) ;
5. rechargement forcé du navigateur (Ctrl+Shift+R).

Vous pouvez revérifier l'état du montage avec `pwsh -NoProfile -File ./scripts/mount-check.ps1`.

## Utilisation

Deux points d'entrée :

| Point d'entrée | Déclenchement | Comportement |
|---|---|---|
| **Visionneuse de fichiers** (prise en charge) | Ouvrir n'importe quel `.tsx` dans l'arborescence de fichiers | `.canvas.tsx` → page structurée + bascule `Aperçu/Code` ; autres `.tsx` → vue du code source |
| **Onglet** | menu `+` de la barre latérale droite → **Rapport Canvas** | saisie manuelle d'un chemin à consulter, sans devoir d'abord ouvrir le fichier dans l'éditeur |

La visionneuse de fichiers peut être désactivée dans les réglages de la carte Side ; une fois désactivée, ce type de fichier retombe sur la visionneuse de code intégrée.

Ouvrir **un** fichier donné affiche **ce** fichier — le plugin ne scanne pas l'espace de travail.

### Pourquoi la visionneuse de fichiers doit revendiquer tous les .tsx

`exts: ['tsx']` est la seule façon viable de revendiquer, au prix de capturer aussi les `.tsx` qui ne sont pas des canvas. Toutes les preuves proviennent du code source de better-sidebar et de vérifications réelles dans l'écosystème :

| # | Contrainte | Preuve |
|---|---|---|
| L1 | `extOf()` ne prend que le dernier segment d'extension → `extOf('a.canvas.tsx') === 'tsx'` | `src/client/paths.ts:80-85` |
| L2 | `exts: ['tsx']` revendique **tous** les `.tsx` de l'espace de travail, et priority 0 écrase le CodeMirror du `code` intégré (-100) | `service.ts:847-875` |
| L3 | `detect` n'est appelé que lorsque les octets de `head` sont disponibles, et `head` provient uniquement d'un `fs.read` binaire — un `.tsx` textuel n'atteint jamais cette branche | `service.ts:860` |
| L4 | une fois le descriptor revendiqué, `component` doit s'afficher, **sans API de délégation/repli** | `EditorHost.tsx:349,486` |
| L5 | le plugin d'écosystème `dsh-code-nav` a un `LANG_EXT` qui **contient déjà `tsx`** et revendique avec `priority: 10` | `dsh-code-nav/src/lang-registry.js` |

→ La détection d'un `.canvas.tsx` ne peut se faire que dans le composant propriétaire. Par conséquent : **la visionneuse revendique tous les `.tsx`** (les canvas passent en page, le reste en code source), et l'**onglet** est conservé comme second point d'entrée qui ne passe pas par la revendication de fichiers.

## Intégration du Skill : apprendre aux LLM à écrire du .canvas.tsx

`skills/writing-qoder-canvas/` est un Skill **autonome et entièrement transportable** :

```
skills/writing-qoder-canvas/
  SKILL.md                      # conditions de déclenchement, squelette de fichier, cinq règles de fer, liste des signaux d'alerte
  references/components.md      # les 38 balises réellement rendues + les props de chacune (vérification machine)
  references/expressions.md     # les règles fermées du parseur statique : quelles valeurs survivent
  references/layout.md          # écrire pour une barre latérale de ~400px (pas pour un aperçu de 960px)
  examples/status-report.canvas.tsx   # un modèle rendable, zéro dégradation garantie par les tests
```

### Pourquoi il ne mentira pas

La documentation finit par diverger, donc chaque assertion ci-dessous est ancrée dans le code source (`tests/skill.spec.ts`) :

- la liste des éléments pris en charge dans `components.md` doit être **strictement égale**, élément par élément, aux balises `case` de `render.tsx` (38, ordre compris) ;
- aucun nom figurant dans la liste des « non pris en charge » ne doit apparaître dans le moteur de rendu ;
- `examples/status-report.canvas.tsx` doit se rendre **sans aucune dégradation** — aucun indicateur `unsupported`, aucun cadre en pointillés de composant inconnu.

Si la documentation et les capacités réelles divergent, `pnpm test` échoue.

### Comment l'installer dans DSH

DSH découvre les Skills dans un ensemble fixe de roots, et un Skill doit se trouver **exactement à un niveau de profondeur** : `<root>/<name>/SKILL.md`.
Les `**/SKILL.md` imbriqués ne sont pas découverts (le provider surveille chaque root avec chokidar, `depth: 1`).

| rank | Source | Chemin |
|---|---|---|
| 100 | `project-dsh` | `<projectRoot>/.dsh/skills` |
| 200 | `project-agents` | `<projectRoot>/.agents/skills` |
| 300 | `custom` | `customSkillDirs` de la configuration DSH |
| 400 | `user-dsh` | `~/.dsh/skills` |
| 500 | `user-agents` | `~/.agents/skills` |
| 600 | `bundled` | `$DSH_BUNDLED_SKILL_DIR` |

```powershell
# par défaut : installation dans ~/.agents/skills via junction (sans copie, sans dérive)
pwsh -NoProfile -File ./scripts/install-skill.ps1

# installation ailleurs ; -Copy crée une véritable copie indépendante (elle dérive, relancer après modification)
pwsh -NoProfile -File ./scripts/install-skill.ps1 -Target UserDsh
pwsh -NoProfile -File ./scripts/install-skill.ps1 -Path D:\some\skills -Copy

# désinstallation
pwsh -NoProfile -File ./scripts/install-skill.ps1 -Uninstall
```

Le provider surveille les roots, **pas besoin de redémarrer `dsh web`** : une fois installé, le Skill apparaît dans le catalogue de skills de la session suivante.

**Une junction par défaut plutôt qu'une copie**, car la copie finit par dériver — ce workspace a déjà payé le prix sur `memport` avec « trois copies jamais synchronisées ». La junction fait de la copie dans le dépôt l'unique source de vérité.

> `skills/` **ne figure pas dans les `files[]` du `package.json`** : c'est un actif du dépôt, pas un artefact npm publié.

## Contraintes de version

Sur `dsh-better-sidebar@0.19.0 / 0.19.1`, le path seed de `openTab({ path })` est détourné vers l'éditeur de fichiers et **l'onglet de type composant ne se monte pas** (amont #632, corrigé à partir de 0.19.2). Ce plugin ne dépend donc **pas du path seed** : il résout lui-même le fichier cible via `/sidebar/api` (`session.cwd` → `fs.tree` → `fs.read`) — une approche tout aussi valable sur 0.19.2+.

## Habillages et thèmes

**L'enveloppe du plugin** (onglets, carte de réglages, boutons) ne consomme que les jetons `--dsw-alias-*` de DSH et suit automatiquement tous les habillages ainsi que les modes clair/sombre.

**Le sous-arbre des documents canvas est une exception, et c'est voulu** : un `.canvas.tsx` décrit une feuille à mise en page fixe dont les couleurs sont choisies par l'auteur ; recolorer selon l'habillage changerait l'apparence même du rapport. C'est pourquoi `styles.ts` utilise des valeurs de couleur littérales et **chaque sélecteur est confiné sous `.dsh-canvas-doc`**, sans fuite vers l'UI hôte (`tests/render.spec.tsx` garde le périmètre, `tests/purity.spec.ts` garde la surface d'enregistrement).

## Limitations connues

- L'analyse repose sur un **parseur léger développé en interne**, sans précision de compilateur. Génériques, décorateurs et appels arbitraires ne sont pas modélisés et sont systématiquement dégradés, mais **une erreur n'est jamais levée**.
- L'analyse des valeurs suit un **ensemble fermé de règles** (détails dans `skills/writing-qoder-canvas/references/expressions.md`).
  Pris en charge : littéraux, assertions `as const` / `as T`, `const` littéraux au niveau module et en tête de corps de fonction,
  projections `ARR.map(x => littéral)` sur des tableaux statiques, `canvasImage('littéral')`.
  Non pris en charge (**aucune évaluation**) : expressions conditionnelles, appels de fonctions, chaînes de membres, interpolation de gabarits, arithmétique, `new`, `await`,
  `const` dans des blocs imbriqués, données issues d'`import` inter-modules.
  - un **nœud enfant** non littéral → rendu sous forme de bande de dégradation en ligne, le fragment original restant visible ;
  - une **propriété** non littérale → la propriété est abandonnée, son nom est consigné dans le `unresolved` de l'IR, les autres propriétés étant rendues normalement.
- Les balises en minuscules sont toujours transmises telles quelles comme HTML natif ; seuls les composants **en majuscules et non mappés** sont rendus sous forme de cadre en pointillés nominatif.
- Les onglets sont rendus **en lecture seule**.
- **Le parseur est plus tolérant qu'un compilateur** : le SDK Qoder exige que les auteurs corrigent les diagnostics via le « Canvas TypeScript check » de l'IDE, mais les fichiers réels ne sont pas toujours propres. Face à un TSX illégal, ce plugin **ne lève pas d'erreur et ne s'interrompt pas**, il dégrade uniquement le nœud concerné.
  Les diagnostics faisant autorité sont consultables via `node scripts/syntax-oracle.cjs <file.canvas.tsx>`.

  > Vérification réelle : à la ligne 46 de l'échantillon fourni `cmp-cloud-sdk-report.canvas.tsx`,
  > `{'created': ...}` constitue du TSX illégal (TypeScript signale **TS1005 + TS1381** — opérateur de spread nu).
  > Le plugin dégrade cet endroit en un marqueur en ligne et rend normalement les 147 autres lignes.

## Sémantique des espaces en JSX

Les nœuds enfants texte sont repliés strictement selon la sémantique `cleanJSXElementLiteralChild` de React :

- **l'indentation de tête est systématiquement retirée** sur toute ligne autre que la première ;
- **les espaces de fin de la dernière ligne sont conservés** — cet espace est porteur : il sépare le texte du conteneur d'expression qui suit immédiatement
  (ex. l'espace dans `…addition (0 + {'created': ...})…` ; sans lui, les deux segments se colleraient).

## Développement

```sh
pnpm install
pnpm typecheck     # tsc (avec la vérification zéro dépendance Node côté client seul)
pnpm test          # vitest
pnpm build         # tsc dts + tsdown (moitié hôte + bundle client)
pnpm run audit:bundle   # audit des artefacts de build réels
```

## Scripts de développement

| Script | Usage |
|---|---|
| `scripts/dump-ir.ts` | Exporte le plan IR / JSON / fixtures de référence d'un fichier (`--write`) |
| `scripts/syntax-oracle.cjs` | Détermine avec le **vrai compilateur TypeScript** si un fichier source est un TSX valide (`typescript` reste une devDependency, il n'entre pas dans le bundle) |
| `scripts/audit-bundle.cjs` | Audit des artefacts de build réels : fuites de modules intégrés, re-parseurs, `eval`, enregistrements hors périmètre |
| `scripts/mount-check.ps1` | Vérifie/répare le montage du profil (ASCII pur, compatible Windows PowerShell 5.1) |
| `scripts/install-skill.ps1` | Installe `skills/writing-qoder-canvas` dans un root de skills DSH (junction par défaut) |
| `scripts/component-census.cjs` | Recensement autonome des composants (sans table de composants codée en dur, sensible au multi-ligne) |
| `scripts/corpus-stats.ts` / `format-economics.ts` / `audit-corpus.ts` / `corpus-gaps.ts` | Statistiques de corpus et mesures concrètes d'économie du format (source des chiffres de `docs/canvas-format-rules.md`) |
