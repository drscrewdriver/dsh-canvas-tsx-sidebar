window.__ModuleLoader__.load({
	id: "dsh-canvas-tsx-sidebar",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		//#region src/client/canvas/lex.ts
		const SPACE = /* @__PURE__ */ new Set([
			" ",
			"	",
			"\n",
			"\r",
			"\f",
			"\v"
		]);
		const ESCAPES = {
			n: "\n",
			t: "	",
			r: "\r",
			b: "\b",
			f: "\f",
			v: "\v",
			0: "\0"
		};
		/** True for a JavaScript identifier start character. */
		function isIdentStart(c) {
			return c >= "a" && c <= "z" || c >= "A" && c <= "Z" || c === "_" || c === "$";
		}
		/** True for a JavaScript identifier continuation character. */
		function isIdentPart(c) {
			return isIdentStart(c) || c >= "0" && c <= "9";
		}
		/**
		* Skip whitespace and comments starting at `i`.
		* @returns the index of the next significant character (may be `src.length`).
		*/
		function skipTrivia(src, i) {
			let at = i;
			for (;;) {
				while (at < src.length && SPACE.has(src[at])) at++;
				if (src[at] === "/" && src[at + 1] === "/") {
					at += 2;
					while (at < src.length && src[at] !== "\n") at++;
					continue;
				}
				if (src[at] === "/" && src[at + 1] === "*") {
					const close = src.indexOf("*/", at + 2);
					at = close === -1 ? src.length : close + 2;
					continue;
				}
				return at;
			}
		}
		/** Read a JavaScript identifier at `i`, or null when there is none. */
		function readIdent(src, i) {
			if (i >= src.length || !isIdentStart(src[i])) return null;
			let at = i + 1;
			while (at < src.length && isIdentPart(src[at])) at++;
			return {
				value: src.slice(i, at),
				end: at
			};
		}
		/**
		* Read a JSX tag name at `i`. Wider than a JS identifier: JSX permits `-`
		* (web components), `:` (namespaces) and `.` (member expressions).
		*/
		function readJsxTagName(src, i) {
			if (i >= src.length) return null;
			const first = src[i];
			if (!isIdentStart(first) && first !== "-") return null;
			let at = i;
			while (at < src.length) {
				const c = src[at];
				if (isIdentPart(c) || c === "-" || c === ":" || c === ".") at++;
				else break;
			}
			return {
				value: src.slice(i, at),
				end: at
			};
		}
		/**
		* Read a quoted literal starting at `i`.
		* @returns null when `src[i]` does not open a quote.
		*/
		function readQuoted(src, i) {
			const quote = src[i];
			if (quote !== "\"" && quote !== "'" && quote !== "`") return null;
			const start = i;
			let at = i + 1;
			let value = "";
			let hasSubstitution = false;
			while (at < src.length) {
				const c = src[at];
				if (c === "\\") {
					const next = src[at + 1];
					if (next === void 0) break;
					const mapped = ESCAPES[next];
					value += mapped === void 0 ? next : mapped;
					at += 2;
					continue;
				}
				if (c === quote) return {
					value,
					end: at + 1,
					raw: src.slice(start, at + 1),
					hasSubstitution,
					terminated: true
				};
				if (quote === "`" && c === "$" && src[at + 1] === "{") {
					hasSubstitution = true;
					const close = matchDelimiter(src, at + 1, "{", "}");
					if (close === null) break;
					at = close;
					continue;
				}
				if (quote !== "`" && (c === "\n" || c === "\r")) break;
				value += c;
				at++;
			}
			return {
				value,
				end: at,
				raw: src.slice(start, at),
				hasSubstitution,
				terminated: false
			};
		}
		/**
		* Given `src[at] === open`, return the index just past its matching `close`,
		* honouring nested delimiters, string literals and comments.
		* @returns null when the delimiter never closes.
		*/
		function matchDelimiter(src, at, open, close) {
			if (src[at] !== open) return null;
			let depth = 0;
			let i = at;
			while (i < src.length) {
				const c = src[i];
				if (c === "\"" || c === "'" || c === "`") {
					const q = readQuoted(src, i);
					if (q === null || !q.terminated) return null;
					i = q.end;
					continue;
				}
				if (c === "/" && (src[i + 1] === "/" || src[i + 1] === "*")) {
					const next = skipTrivia(src, i);
					if (next <= i) return null;
					i = next;
					continue;
				}
				if (c === open) depth++;
				else if (c === close) {
					depth--;
					if (depth === 0) return i + 1;
				}
				i++;
			}
			return null;
		}
		/**
		* Indices of every `sep` character at nesting depth zero in `src[from,to)`.
		* Strings, comments and bracketed groups are skipped wholesale.
		*/
		function topLevelSeparators(src, from, to, sep) {
			const cuts = [];
			let i = from;
			while (i < to) {
				const c = src[i];
				if (c === "\"" || c === "'" || c === "`") {
					const q = readQuoted(src, i);
					i = q === null ? i + 1 : Math.max(q.end, i + 1);
					continue;
				}
				if (c === "/" && (src[i + 1] === "/" || src[i + 1] === "*")) {
					const next = skipTrivia(src, i);
					i = next > i ? next : i + 1;
					continue;
				}
				if (c === "(" || c === "[" || c === "{") {
					const after = matchDelimiter(src, i, c, c === "(" ? ")" : c === "[" ? "]" : "}");
					i = after === null ? i + 1 : after;
					continue;
				}
				if (c === sep) {
					cuts.push(i);
					i++;
					continue;
				}
				i++;
			}
			return cuts;
		}
		/**
		* Collapse JSX text children exactly the way React does
		* (`cleanJSXElementLiteralChild`), so multi-line Chinese paragraphs render
		* without stray indentation or hard-wrapped newlines.
		* @param raw - the literal text between two JSX constructs.
		*/
		function collapseJsxText(raw) {
			const lines = raw.split(/\r\n|\n|\r/);
			let lastNonEmpty = 0;
			for (let i = 0; i < lines.length; i++) if (/[^ \t]/.test(lines[i])) lastNonEmpty = i;
			let out = "";
			for (let i = 0; i < lines.length; i++) {
				const isFirst = i === 0;
				const isLast = i === lines.length - 1;
				const isLastNonEmpty = i === lastNonEmpty;
				let line = lines[i].replace(/\t/g, " ");
				if (!isFirst) line = line.replace(/^ +/, "");
				if (!isLast) line = line.replace(/ +$/, "");
				if (line !== "") {
					if (!isLastNonEmpty) line += " ";
					out += line;
				}
			}
			return out;
		}
		//#endregion
		//#region src/client/canvas/value.ts
		/**
		* Static value resolution.
		*
		* Extends the plain literal parser with a CLOSED set of syntactic forms that
		* real canvas files use and that can be resolved without executing anything:
		*
		*   1. `undefined` / `null`            -> `null` (a keyword, not an expression)
		*   2. `EXPR as const` / `EXPR as T`   -> `EXPR`  (a pure TS assertion: erased at runtime)
		*   3. `NAME` where `const NAME = <resolvable>`  (module-scope symbol table)
		*   4. `ARR.map(() => LIT)`            -> LIT repeated arr.length times
		*      `ARR.map(p => [p.a, p.b])`      -> tuple projection over a static array
		*   5. `canvasImage('lit')`            -> `'lit'` (the SDK documents this as
		*      "use one direct string literal: a local ./file, HTTP(S) URL, or Data URL")
		*
		* Rules 3-5 are NOT evaluation: each is a syntactic rewrite with a fixed,
		* checkable shape. There is no `eval`, no `new Function`, and no arbitrary
		* call evaluation. Anything outside this closed set stays `UNSUPPORTED`, and
		* the renderer degrades that one node.
		*
		* Rationale for the extension: a corpus audit of 41 real canvas files found
		* ~35 `rows`, ~26 `src`, ~16 `rowTone` and ~10 `items` props hitting the
		* "non-literal" path — i.e. tables, metric grids and screenshots rendering
		* EMPTY on 21 of 41 files. Every one of those forms is in the closed set above.
		*/
		/** Sentinel for "not resolvable under the closed rule set". */
		const UNSUPPORTED = Symbol("unsupported");
		/** Recursion ceiling for const chains. */
		const MAX_DEPTH = 12;
		/** The one SDK helper we unwrap, since it is documented as an identity. */
		const CANVAS_IMAGE = "canvasImage";
		/** Split `[from,to)` at the given cut indices into `[start,end)` ranges. */
		function segments(from, to, cuts) {
			const out = [];
			let start = from;
			for (const cut of cuts) {
				out.push([start, cut]);
				start = cut + 1;
			}
			out.push([start, to]);
			return out;
		}
		/**
		* Find a top-level `=` that introduces an initialiser (not `==`, `=>`, `<=`, …).
		* @returns the index, or null.
		*/
		function findInitialiserEquals(src, from) {
			let i = from;
			while (i < src.length) {
				const c = src[i];
				if (c === "\"" || c === "'" || c === "`") {
					const q = readQuoted(src, i);
					i = q === null ? i + 1 : Math.max(q.end, i + 1);
					continue;
				}
				if (c === "/" && (src[i + 1] === "/" || src[i + 1] === "*")) {
					const next = skipTrivia(src, i);
					i = next > i ? next : i + 1;
					continue;
				}
				if (c === "(" || c === "[" || c === "{" || c === "<") {
					const close = c === "(" ? ")" : c === "[" ? "]" : c === "{" ? "}" : null;
					if (close !== null) {
						const after = matchDelimiter(src, i, c, close);
						if (after !== null) {
							i = after;
							continue;
						}
					}
					i++;
					continue;
				}
				if (c === "=") {
					const prev = src[i - 1];
					const next = src[i + 1];
					if (prev !== "=" && prev !== "!" && prev !== "<" && prev !== ">" && next !== "=" && next !== ">") return i;
				}
				i++;
			}
			return null;
		}
		/**
		* Skip whitespace and comments, including NEWLINES.
		*
		* `lex.ts`'s `skipTrivia` deliberately stops at a line break (JSX whitespace
		* semantics depend on it), so statement scanning needs its own reader.
		*/
		function skipBlank(src, from) {
			let i = from;
			for (;;) {
				const c = src[i];
				if (c === void 0) return i;
				if (/\s/.test(c)) {
					i++;
					continue;
				}
				if (c === "/" && (src[i + 1] === "/" || src[i + 1] === "*")) {
					const next = skipTrivia(src, i);
					if (next > i) {
						i = next;
						continue;
					}
				}
				return i;
			}
		}
		/** Characters that make the NEXT line a continuation of the current expression. */
		const CONTINUES_AFTER = /* @__PURE__ */ new Set([
			".",
			",",
			")",
			"]",
			"}",
			"+",
			"-",
			"*",
			"/",
			"%",
			"&",
			"|",
			"^",
			"?",
			"=",
			"<",
			">",
			":"
		]);
		/** Characters that mean the expression is still open when they END a line. */
		const CONTINUES_BEFORE = /* @__PURE__ */ new Set([
			".",
			",",
			"+",
			"-",
			"*",
			"/",
			"%",
			"&",
			"|",
			"^",
			"!",
			"?",
			"=",
			"<",
			">",
			":",
			"(",
			"[",
			"{"
		]);
		/**
		* Index just past the statement starting at `from`.
		*
		* Terminated by `;` OR by a line break that is not an expression continuation —
		* real canvas files are written both ways, and a file that omits semicolons
		* would otherwise fold every following `const` into the first initialiser.
		*/
		function findStatementEnd(src, from) {
			let i = from;
			let lastSignificant = from;
			while (i < src.length) {
				const c = src[i];
				if (c === "\"" || c === "'" || c === "`") {
					const q = readQuoted(src, i);
					i = q === null ? i + 1 : Math.max(q.end, i + 1);
					lastSignificant = i;
					continue;
				}
				if (c === "/" && (src[i + 1] === "/" || src[i + 1] === "*")) {
					const next = skipTrivia(src, i);
					i = next > i ? next : i + 1;
					continue;
				}
				if (c === "(" || c === "[" || c === "{") {
					const after = matchDelimiter(src, i, c, c === "(" ? ")" : c === "[" ? "]" : "}");
					if (after !== null) {
						i = after;
						lastSignificant = i;
						continue;
					}
					i++;
					continue;
				}
				if (c === ";") return i;
				if (c === "\n" && lastSignificant > from) {
					const before = src[lastSignificant - 1];
					const after = src[skipBlank(src, i)];
					if (!(before !== void 0 && CONTINUES_BEFORE.has(before) || after !== void 0 && CONTINUES_AFTER.has(after))) return lastSignificant;
					i++;
					continue;
				}
				if (!/\s/.test(c)) lastSignificant = i + 1;
				i++;
			}
			return lastSignificant;
		}
		/**
		* Strip a trailing `as const` / `as SomeType` assertion.
		* @returns the expression text with the assertion removed, or null if absent.
		*/
		function stripAsAssertion(raw) {
			const s = raw;
			let i = 0;
			while (i < s.length) {
				const c = s[i];
				if (c === "\"" || c === "'" || c === "`") {
					const q = readQuoted(s, i);
					i = q === null ? i + 1 : Math.max(q.end, i + 1);
					continue;
				}
				if (c === "(" || c === "[" || c === "{") {
					const after = matchDelimiter(s, i, c, c === "(" ? ")" : c === "[" ? "]" : "}");
					if (after !== null) {
						i = after;
						continue;
					}
					i++;
					continue;
				}
				if (/\s/.test(s[i - 1] ?? "") && s.startsWith("as", i) && /\s/.test(s[i + 2] ?? "")) {
					const head = s[skipTrivia(s, i + 2)];
					if (head !== void 0 && /[A-Za-z_$({[]/.test(head)) {
						const prefix = s.slice(0, i).trim();
						return prefix === "" ? null : prefix;
					}
				}
				i++;
			}
			return null;
		}
		/**
		* Collect `const NAME = <initialiser>` bindings in `src[from, to)`.
		*
		* Only declarations at THAT level are taken: any bracketed group is skipped
		* wholesale, so consts nested inside blocks are ignored (hoisting them would
		* require real scoping analysis).
		*/
		function collectConstsInRange(src, from, to, out) {
			let i = from;
			while (i < to) {
				const c = src[i];
				if (c === "\"" || c === "'" || c === "`") {
					const q = readQuoted(src, i);
					i = q === null ? i + 1 : Math.max(q.end, i + 1);
					continue;
				}
				if (c === "/" && (src[i + 1] === "/" || src[i + 1] === "*")) {
					const next = skipTrivia(src, i);
					i = next > i ? next : i + 1;
					continue;
				}
				if (c === "{" || c === "(" || c === "[") {
					const after = matchDelimiter(src, i, c, c === "(" ? ")" : c === "[" ? "]" : "}");
					if (after === null || after > to) break;
					i = after;
					continue;
				}
				const keyword = /^(const|let|var)\b/.exec(src.slice(i, i + 6));
				if (keyword !== null && (i === 0 || !isIdentPart(src[i - 1]))) {
					let j = skipTrivia(src, i + keyword[0].length);
					const name = readIdent(src, j);
					if (name !== null) {
						j = name.end;
						const eq = findInitialiserEquals(src, j);
						if (eq !== null && eq < to) {
							const initStart = skipTrivia(src, eq + 1);
							const initEnd = findStatementEnd(src, initStart);
							out.set(name.value, src.slice(initStart, initEnd));
							i = initEnd;
							continue;
						}
					}
				}
				i++;
			}
		}
		/**
		* Collect module-level `const NAME = <initialiser>` bindings.
		*/
		function collectModuleConsts(src) {
			const out = /* @__PURE__ */ new Map();
			collectConstsInRange(src, 0, src.length, out);
			return out;
		}
		/**
		* Locate the default export function's body range.
		*
		* Needed because real canvas files declare their data tables INSIDE the
		* component (`const techStack = […]` before the `return`) just as often as at
		* module scope. Those initialisers are equally static.
		*/
		function findDefaultExportBody(src) {
			const marker = /\bexport\s+default\b/.exec(src);
			if (marker === null) return null;
			let i = skipTrivia(src, marker.index + marker[0].length);
			if (src.startsWith("function", i) && !isIdentPart(src[i + 8] ?? "")) {
				i = skipTrivia(src, i + 8);
				if (src[i] === "*") i = skipTrivia(src, i + 1);
				const name = readIdent(src, i);
				if (name !== null) i = skipTrivia(src, name.end);
			}
			if (src[i] !== "(") return null;
			const paramsEnd = matchDelimiter(src, i, "(", ")");
			if (paramsEnd === null) return null;
			i = skipTrivia(src, paramsEnd);
			if (!src.startsWith("function", marker.index + marker[0].length) && src[i] === "=" && src[i + 1] === ">") i = skipTrivia(src, i + 2);
			if (src[i] === ":") {
				let j = skipTrivia(src, i + 1);
				if (src[j] === "{") {
					const typeEnd = matchDelimiter(src, j, "{", "}");
					if (typeEnd !== null) {
						const afterType = skipTrivia(src, typeEnd);
						if (src[afterType] === "{") j = afterType;
					}
				} else while (j < src.length && src[j] !== "{") {
					const c = src[j];
					if (c === "(" || c === "[") {
						const close = matchDelimiter(src, j, c, c === "(" ? ")" : "]");
						if (close === null) break;
						j = close;
						continue;
					}
					j++;
				}
				i = j;
			}
			if (src[i] !== "{") return null;
			const bodyEnd = matchDelimiter(src, i, "{", "}");
			if (bodyEnd === null) return null;
			return [i + 1, bodyEnd - 1];
		}
		/**
		* Collect consts declared directly in the default export's body.
		* Merged over module-level consts (a body declaration shadows the outer one).
		*/
		function collectFunctionConsts(src) {
			const out = /* @__PURE__ */ new Map();
			const body = findDefaultExportBody(src);
			if (body === null) return out;
			collectConstsInRange(src, body[0], body[1], out);
			return out;
		}
		/** `ARR.map(PARAM => BODY)` shape, resolved against a static array. */
		function tryMapProjection(raw, ctx) {
			const s = raw.trim();
			const mapAt = s.indexOf(".map");
			if (mapAt <= 0) return UNSUPPORTED;
			const receiver = s.slice(0, mapAt).trim();
			let j = skipTrivia(s, mapAt + 4);
			if (s[j] !== "(") return UNSUPPORTED;
			const callClose = matchDelimiter(s, j, "(", ")");
			if (callClose === null || callClose !== s.length) return UNSUPPORTED;
			const args = s.slice(j + 1, callClose - 1);
			const arrowAt = args.indexOf("=>");
			if (arrowAt === -1) return UNSUPPORTED;
			const paramRaw = args.slice(0, arrowAt).trim().replace(/^\(/, "").replace(/\)$/, "").trim();
			const bodyRaw = args.slice(arrowAt + 2).trim();
			const source = resolveValue(receiver, ctx);
			if (source === UNSUPPORTED || !Array.isArray(source)) return UNSUPPORTED;
			if (paramRaw === "") {
				const value = resolveValue(bodyRaw, ctx);
				if (value === UNSUPPORTED) return UNSUPPORTED;
				return source.map(() => value);
			}
			const body = bodyRaw.trim();
			const isTuple = body.startsWith("[") && (matchDelimiter(body, 0, "[", "]") ?? -1) === body.length;
			const picked = (isTuple ? segments(1, body.length - 1, topLevelSeparators(body, 1, body.length - 1, ",")).map(([a, b]) => body.slice(a, b).trim()) : [body]).map((item) => {
				if (item === "") return null;
				const m = /^([A-Za-z_$][\w$]*)\s*\.\s*([A-Za-z_$][\w$]*)$/.exec(item);
				if (m !== null && m[1] === paramRaw) return m[2];
				const literal = resolveValue(item, {
					...ctx,
					depth: ctx.depth + 1
				});
				return literal === UNSUPPORTED ? void 0 : JSON.stringify(literal);
			});
			if (picked.some((p) => p === void 0)) return UNSUPPORTED;
			const out = [];
			for (const element of source) {
				if (element === null || typeof element !== "object" || Array.isArray(element)) return UNSUPPORTED;
				const record = element;
				const row = [];
				for (const pick of picked) {
					if (pick === null) continue;
					if (pick.startsWith("\"")) row.push(JSON.parse(pick));
					else if (!(pick in record)) return UNSUPPORTED;
					else row.push(record[pick]);
				}
				out.push(isTuple ? row : row[0]);
			}
			return out;
		}
		/**
		* Resolve one expression's source text to a value, or `UNSUPPORTED`.
		* Total: never throws, never evaluates.
		*/
		function resolveValue(raw, ctx) {
			if (ctx.depth > MAX_DEPTH) return UNSUPPORTED;
			const s = raw.trim();
			if (s === "") return UNSUPPORTED;
			const stripped = stripAsAssertion(s);
			if (stripped !== null) return resolveValue(stripped, ctx);
			if (s === "undefined" || s === "null") return null;
			if (s === "true") return true;
			if (s === "false") return false;
			const quoted = readQuoted(s, 0);
			if (quoted !== null) {
				if (quoted.terminated && quoted.end === s.length && !quoted.hasSubstitution) return quoted.value;
				return UNSUPPORTED;
			}
			if (/^-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(s)) return Number(s);
			if (s.startsWith("[")) {
				const close = matchDelimiter(s, 0, "[", "]");
				if (close === null || close !== s.length) return UNSUPPORTED;
				const out = [];
				for (const [a, b] of segments(1, s.length - 1, topLevelSeparators(s, 1, s.length - 1, ","))) {
					const seg = s.slice(a, b).trim();
					if (seg === "") continue;
					const value = resolveValue(seg, {
						...ctx,
						depth: ctx.depth + 1
					});
					if (value === UNSUPPORTED) return UNSUPPORTED;
					out.push(value);
				}
				return out;
			}
			if (s.startsWith("{")) {
				const close = matchDelimiter(s, 0, "{", "}");
				if (close === null || close !== s.length) return UNSUPPORTED;
				const out = {};
				for (const [a, b] of segments(1, s.length - 1, topLevelSeparators(s, 1, s.length - 1, ","))) {
					const seg = s.slice(a, b);
					if (seg.trim() === "") continue;
					const colons = topLevelSeparators(seg, 0, seg.length, ":");
					if (colons.length !== 1) return UNSUPPORTED;
					const keyRaw = seg.slice(0, colons[0]).trim();
					const valRaw = seg.slice(colons[0] + 1).trim();
					let key;
					const kq = readQuoted(keyRaw, 0);
					if (kq !== null && kq.terminated && kq.end === keyRaw.length) key = kq.value;
					else if (/^[A-Za-z_$][\w$]*$/.test(keyRaw)) key = keyRaw;
					else return UNSUPPORTED;
					const value = resolveValue(valRaw, {
						...ctx,
						depth: ctx.depth + 1
					});
					if (value === UNSUPPORTED) return UNSUPPORTED;
					out[key] = value;
				}
				return out;
			}
			if (s.startsWith(`${CANVAS_IMAGE}(`)) {
				const open = s.indexOf("(");
				const close = matchDelimiter(s, open, "(", ")");
				if (close === null || close !== s.length) return UNSUPPORTED;
				return resolveValue(s.slice(open + 1, close - 1), {
					...ctx,
					depth: ctx.depth + 1
				});
			}
			if (s.includes(".map")) {
				const projected = tryMapProjection(s, ctx);
				if (projected !== UNSUPPORTED) return projected;
				return UNSUPPORTED;
			}
			const ident = readIdent(s, 0);
			if (ident !== null && ident.end === s.length) {
				if (ctx.imports.has(ident.value)) return UNSUPPORTED;
				const init = ctx.consts.get(ident.value);
				if (init === void 0) return UNSUPPORTED;
				if (init.trim() === s) return UNSUPPORTED;
				return resolveValue(init, {
					...ctx,
					depth: ctx.depth + 1
				});
			}
			return UNSUPPORTED;
		}
		/** Build a resolver bound to one source file. */
		function createResolver(src, importedNames) {
			const consts = collectModuleConsts(src);
			for (const [name, init] of collectFunctionConsts(src)) consts.set(name, init);
			const ctx = {
				consts,
				imports: importedNames,
				depth: 0
			};
			return (raw) => resolveValue(raw, ctx);
		}
		//#endregion
		//#region src/client/canvas/extract.ts
		/**
		* Static `.canvas.tsx` extractor: source text -> IR.
		*
		* A hand-rolled recursive-descent parser over the primitives in `lex.ts`,
		* with values going through `value.ts`'s closed-rule static resolver.
		*
		* Fidelity contract:
		* - Values resolve only through the CLOSED rule set in `value.ts` (literals,
		*   `undefined`/`null`, `as` assertions, module-level literal consts, `.map()`
		*   projections over static arrays, `canvasImage('lit')`). Nothing is executed.
		* - A non-literal CHILD becomes an `unsupported` node.
		* - A non-literal PROP is dropped and its name recorded in `unresolved`, so the
		*   rest of the element still renders.
		*
		* Known precision ceiling (documented in README): generics, decorators and
		* arbitrary calls are not modelled. They degrade; they never throw.
		*/
		/** The one module specifier whose exports we normalise. */
		const CANVAS_MODULE = "qoder/canvas";
		/** Source ceiling. Files above this are rejected outright rather than parsed slowly. */
		const MAX_SOURCE_BYTES = 2097152;
		/** Extract `<Name>` into the exported name it maps to. */
		function normaliseTag(raw, imports) {
			if (raw === "") return "";
			const first = raw[0];
			if (first === first.toLowerCase() && first !== first.toUpperCase()) return raw;
			return imports[raw] ?? raw;
		}
		/** Split `[from,to)` at the given cut indices into `[start,end)` ranges. */
		function splitSegments(from, to, cuts) {
			const out = [];
			let start = from;
			for (const cut of cuts) {
				out.push([start, cut]);
				start = cut + 1;
			}
			out.push([start, to]);
			return out;
		}
		/** Parse one import specifier (`Name` or `Name as Alias`). */
		function parseSpecifier(segment) {
			const parts = segment.trim().split(/\s+/).filter(Boolean);
			if (parts.length === 1) return {
				local: parts[0],
				exported: parts[0]
			};
			if (parts.length === 3 && parts[1] === "as") return {
				local: parts[2],
				exported: parts[0]
			};
			return null;
		}
		/**
		* Collect named imports from `qoder/canvas`.
		* Aliases are folded away so the IR always carries the EXPORT name.
		*/
		function parseCanvasImports(src) {
			const map = {};
			for (const { local, exported, module } of eachNamedImport(src)) if (module === CANVAS_MODULE) map[local] = exported;
			return map;
		}
		/** Every named-import binding in the file, with its source module. */
		function* eachNamedImport(src) {
			let i = 0;
			while (i < src.length) {
				const at = src.indexOf("import", i);
				if (at === -1) return;
				if (at > 0 && isIdentPart(src[at - 1])) {
					i = at + 6;
					continue;
				}
				let j = skipTrivia(src, at + 6);
				if (src.startsWith("type", j) && !isIdentPart(src[j + 4] ?? "")) j = skipTrivia(src, j + 4);
				if (src[j] !== "{") {
					i = at + 6;
					continue;
				}
				const close = matchDelimiter(src, j, "{", "}");
				if (close === null) return;
				let k = skipTrivia(src, close);
				if (!src.startsWith("from", k)) {
					i = at + 6;
					continue;
				}
				k = skipTrivia(src, k + 4);
				const q = readQuoted(src, k);
				if (q === null || !q.terminated) {
					i = at + 6;
					continue;
				}
				for (const [a, b] of splitSegments(j + 1, close - 1, topLevelSeparators(src, j + 1, close - 1, ","))) {
					const spec = parseSpecifier(src.slice(a, b));
					if (spec !== null) yield {
						...spec,
						module: q.value
					};
				}
				i = q.end;
			}
		}
		/**
		* Every locally bound import name. These must never be resolved through the
		* module-const table — their values live in another file.
		*/
		function collectImportedNames(src) {
			const out = /* @__PURE__ */ new Set();
			for (const { local } of eachNamedImport(src)) out.add(local);
			return out;
		}
		/** Collect children until the matching close tag. */
		function parseChildren(src, imports, resolve, at, parentTag) {
			const children = [];
			let i = at;
			let textStart = i;
			const flushText = (upto) => {
				if (upto <= textStart) return;
				const value = collapseJsxText(src.slice(textStart, upto));
				if (value !== "") children.push({
					kind: "text",
					value
				});
			};
			while (i < src.length) {
				const c = src[i];
				if (c === "<") {
					if (src[i + 1] === "/") {
						flushText(i);
						let j = skipTrivia(src, i + 2);
						let closeName = "";
						if (src[j] === ">") closeName = "";
						else {
							const cn = readJsxTagName(src, j);
							if (cn === null) return null;
							closeName = cn.value;
							j = cn.end;
						}
						const gt = skipTrivia(src, j);
						if (src[gt] !== ">") return null;
						if (closeName !== (parentTag === null ? "" : parentTag)) return null;
						return {
							children,
							end: gt + 1
						};
					}
					flushText(i);
					const el = parseElement(src, imports, resolve, i);
					if (el === null) return null;
					children.push(el.node);
					i = el.end;
					textStart = i;
					continue;
				}
				if (c === "{") {
					const close = matchDelimiter(src, i, "{", "}");
					if (close === null) return null;
					flushText(i);
					const expr = src.slice(i + 1, close - 1);
					const trimmed = expr.trim();
					const isComment = trimmed.startsWith("/*") || trimmed.startsWith("//");
					if (trimmed !== "" && !isComment) {
						const value = resolve(expr);
						if (value === UNSUPPORTED) children.push({
							kind: "unsupported",
							reason: "non-literal child expression",
							snippet: trimmed.slice(0, 160)
						});
						else if (typeof value === "string" || typeof value === "number") children.push({
							kind: "text",
							value: String(value)
						});
						else children.push({
							kind: "unsupported",
							reason: "non-text child value",
							snippet: trimmed.slice(0, 160)
						});
					}
					i = close;
					textStart = i;
					continue;
				}
				i++;
			}
			return null;
		}
		/** Parse one `<...>` element (or fragment) starting at `at`. */
		function parseElement(src, imports, resolve, at) {
			let i = at + 1;
			if (src[i] === ">") {
				const inner = parseChildren(src, imports, resolve, i + 1, null);
				if (inner === null) return null;
				return {
					node: {
						kind: "element",
						tag: "",
						props: {},
						children: inner.children
					},
					end: inner.end
				};
			}
			const name = readJsxTagName(src, i);
			if (name === null) return null;
			i = name.end;
			const props = {};
			const unresolved = [];
			for (;;) {
				i = skipTrivia(src, i);
				const c = src[i];
				if (c === void 0) return null;
				if (c === "/" && src[i + 1] === ">") return {
					node: finish(normaliseTag(name.value, imports), props, unresolved, []),
					end: i + 2
				};
				if (c === ">") {
					const inner = parseChildren(src, imports, resolve, i + 1, name.value);
					if (inner === null) return null;
					return {
						node: finish(normaliseTag(name.value, imports), props, unresolved, inner.children),
						end: inner.end
					};
				}
				if (c === "{") {
					const close = matchDelimiter(src, i, "{", "}");
					if (close === null) return null;
					unresolved.push(src.slice(i + 1, close - 1).trim().slice(0, 60) || "...");
					i = close;
					continue;
				}
				const attr = readJsxTagName(src, i);
				if (attr === null) return null;
				i = skipTrivia(src, attr.end);
				if (src[i] !== "=") {
					props[attr.value] = true;
					continue;
				}
				i = skipTrivia(src, i + 1);
				const ch = src[i];
				if (ch === "\"" || ch === "'") {
					const q = readQuoted(src, i);
					if (q === null || !q.terminated) return null;
					props[attr.value] = q.value;
					i = q.end;
					continue;
				}
				if (ch === "{") {
					const close = matchDelimiter(src, i, "{", "}");
					if (close === null) return null;
					const value = resolve(src.slice(i + 1, close - 1));
					if (value === UNSUPPORTED) unresolved.push(attr.value);
					else props[attr.value] = value;
					i = close;
					continue;
				}
				return null;
			}
		}
		/** Build an element node, omitting `unresolved` when it is empty. */
		function finish(tag, props, unresolved, children) {
			return unresolved.length === 0 ? {
				kind: "element",
				tag,
				props,
				children
			} : {
				kind: "element",
				tag,
				props,
				children,
				unresolved: [...unresolved]
			};
		}
		/**
		* Locate the JSX root of the default export.
		* @returns the index of the opening `<`, or null.
		*/
		function findJsxRoot(src) {
			const marker = /\bexport\s+default\b/.exec(src);
			if (marker === null) return null;
			const re = /\breturn\b/g;
			re.lastIndex = marker.index + marker[0].length;
			let m;
			while ((m = re.exec(src)) !== null) {
				const after = skipTrivia(src, m.index + 6);
				if (src[after] === "<") return after;
				if (src[after] === "(") {
					if (matchDelimiter(src, after, "(", ")") === null) continue;
					const inner = skipTrivia(src, after + 1);
					if (src[inner] === "<") return inner;
				}
			}
			return null;
		}
		/**
		* Parse a `.canvas.tsx` source into IR.
		* @param source - the file's text.
		*/
		function extractCanvas(source) {
			if (source.length > 2097152) return {
				ok: false,
				error: {
					code: "too-large",
					message: `source is ${source.length} chars, above the ${MAX_SOURCE_BYTES} ceiling`
				}
			};
			const root = findJsxRoot(source);
			if (root === null) return {
				ok: false,
				error: {
					code: /export\s+default/.test(source) ? "no-jsx-root" : "no-default-export",
					message: "no JSX root found on the default export"
				}
			};
			const parsed = parseElement(source, parseCanvasImports(source), createResolver(source, collectImportedNames(source)), root);
			if (parsed === null) return {
				ok: false,
				error: {
					code: "unterminated",
					message: "the JSX tree never closed"
				}
			};
			return {
				ok: true,
				root: parsed.node
			};
		}
		//#endregion
		//#region src/client/canvas/styles.ts
		/**
		* Stylesheet for a rendered canvas document.
		*
		* Two deliberate departures from the plugin's own rules, both because this
		* subtree is a *document*, not plugin chrome:
		*
		* 1. **Literal colours, not `--dsw-alias-*` tokens.** A `.canvas.tsx` encodes a
		*    fixed paper layout; re-tinting it per skin would change what the report
		*    looks like, which is exactly what the author did not ask for. The tokens
		*    stay mandatory for the tab shell around it.
		* 2. **Every selector is scoped under `.dsh-canvas-doc`.** The document tree
		*    lands inside the DSH sidebar, so bare `.card` / `.table` / `.grid` rules
		*    would leak into the host UI. `*` and `img` are the two that must be
		*    rewritten rather than prefixed.
		*
		* Kept as a string (not a CSS module) so the same source drives both the
		* sidebar subtree and the standalone `.rendered.html` export.
		*/
		/** Root class of a rendered document. */
		const CANVAS_ROOT_CLASS = "dsh-canvas-doc";
		/** Scoped stylesheet; inject once per document. */
		const CANVAS_CSS = `
.dsh-canvas-doc, .dsh-canvas-doc * { box-sizing: border-box; margin: 0; padding: 0; }
.dsh-canvas-doc img { max-width: 100%; height: auto; }
.dsh-canvas-doc {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  color: #111827;
  line-height: 1.6;
  font-size: 14px;
  text-align: left;
}

/* ── page + shell ─────────────────────────────────────────────────────── */
.dsh-canvas-doc .page-wrap {
  max-width: 780px; margin: 0 auto; padding: 20px;
  /* Enable container queries so grids respond to sidebar width, not viewport. */
  container-type: inline-size;
}
.dsh-canvas-doc .report-shell {
  background: #fff; border-radius: 8px; border: 1px solid #d1d5db;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06); padding: 20px 24px; overflow: hidden;
}

/* ── layout ───────────────────────────────────────────────────────────── */
.dsh-canvas-doc .stack { display: flex; flex-direction: column; }
.dsh-canvas-doc .grid {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  /* Also a container, so a grid nested in a grid measures its own track. */
  container-type: inline-size;
}
.dsh-canvas-doc .row { display: flex; gap: 12px; }
.dsh-canvas-doc .column { flex: 1; min-width: 0; }

/*
 * Container queries — the fix for "the 4 stat blocks never collapse".
 *
 * An @media query measures the VIEWPORT. A narrow sidebar inside a wide window
 * never triggers it, so a columns={4} grid stayed 4-up no matter how little
 * room it actually had. @container measures an element's own inline size.
 *
 * Which element is the container matters. .page-wrap is the document's width
 * authority, so a top-level grid measures the real content column. .grid is
 * ALSO a container so a grid nested inside another grid measures its own track
 * (half the page-wrap) rather than the full page width.
 *
 * Thresholds account for the padding the layout eats before a track sees any
 * width: page-wrap 20px x2 + report-shell 20/24px. A 4-track grid needs ~118px
 * per track to keep a Stat label on one line, so it collapses once the
 * container drops below 560px — 4 -> 2 directly, never through 3.
 */
@container (max-width: 560px) {
  .dsh-canvas-doc .grid-4 { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
}
@container (max-width: 440px) {
  .dsh-canvas-doc .grid-3,
  .dsh-canvas-doc .grid-4 { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
}
@container (max-width: 300px) {
  .dsh-canvas-doc .grid-2,
  .dsh-canvas-doc .grid-3,
  .dsh-canvas-doc .grid-4 { grid-template-columns: minmax(0, 1fr) !important; }
}
/* Fallback for engines without container query support (pre-2023 browsers). */
@media (max-width: 560px) { .dsh-canvas-doc .grid-4 { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; } }
@media (max-width: 440px) { .dsh-canvas-doc .grid-3, .dsh-canvas-doc .grid-4 { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; } }

/* ── headings + text ──────────────────────────────────────────────────── */
.dsh-canvas-doc .h1 { font-size: 1.5rem; font-weight: 700; color: #111827; margin-bottom: 8px; line-height: 1.3; }
.dsh-canvas-doc .h2 { font-size: 1.25rem; font-weight: 600; color: #111827; margin: 24px 0 6px 0; line-height: 1.3; }
.dsh-canvas-doc .h3 { font-size: 1.1rem; font-weight: 600; color: #111827; margin: 16px 0 4px 0; }
.dsh-canvas-doc .text { font-size: 0.875rem; color: #374151; }
.dsh-canvas-doc .text-secondary { color: #6b7280; }
/* The SDK's tone union has four emphasis steps, not two. The "primary" step is
   the document foreground itself, so it is deliberately unpainted. */
.dsh-canvas-doc .text-tertiary { color: #9ca3af; }
.dsh-canvas-doc .text-quaternary { color: #d1d5db; }
.dsh-canvas-doc .text-small, .dsh-canvas-doc .text-sm { font-size: 0.75rem; }
.dsh-canvas-doc .p { font-size: 0.875rem; color: #374151; line-height: 1.6; margin-bottom: 12px; }

/* ── section ──────────────────────────────────────────────────────────── */
.dsh-canvas-doc .report-section { margin-bottom: 24px; }
.dsh-canvas-doc .section-header { margin-bottom: 12px; }
.dsh-canvas-doc .section-title { font-size: 1.1rem; font-weight: 600; color: #111827; border-bottom: 2px solid #e5e7eb; padding-bottom: 6px; }
.dsh-canvas-doc .section-desc { font-size: 0.875rem; color: #6b7280; margin-top: 4px; }

/* ── stat + metrics ───────────────────────────────────────────────────── */
.dsh-canvas-doc .stat { text-align: center; padding: 12px 8px; border: 1px solid #e5e7eb; border-radius: 8px; background: #fafafa; }
.dsh-canvas-doc .stat-value { font-size: 1.5rem; font-weight: 700; color: #111827; }
.dsh-canvas-doc .stat-label { font-size: 0.75rem; color: #6b7280; margin-bottom: 4px; }
.dsh-canvas-doc .metrics-grid { display: grid; gap: 16px; margin-bottom: 16px; }
.dsh-canvas-doc .metric-card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; text-align: center; }
.dsh-canvas-doc .metric-value { font-size: 1.5rem; font-weight: 700; color: #111827; }
.dsh-canvas-doc .metric-label { font-size: 0.75rem; color: #6b7280; margin-top: 4px; }

/* ── table ────────────────────────────────────────────────────────────── */
.dsh-canvas-doc .table-wrap { overflow-x: auto; margin-bottom: 16px; border: 1px solid #e5e7eb; border-radius: 8px; }
.dsh-canvas-doc .table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
.dsh-canvas-doc .th { padding: 8px 12px; text-align: left; font-weight: 600; border-bottom: 2px solid #e5e7eb; background: #f9fafb; }
.dsh-canvas-doc .td { padding: 8px 12px; border-bottom: 1px solid #f3f4f6; }
.dsh-canvas-doc .tr-success, .dsh-canvas-doc .tr-positive { background: #f0fdf4; }
.dsh-canvas-doc .tr-success .td, .dsh-canvas-doc .tr-positive .td { border-bottom-color: #bbf7d0; }
.dsh-canvas-doc .tr-warning, .dsh-canvas-doc .tr-caution { background: #fffbeb; }
.dsh-canvas-doc .tr-warning .td, .dsh-canvas-doc .tr-caution .td { border-bottom-color: #fde68a; }
.dsh-canvas-doc .tr-danger, .dsh-canvas-doc .tr-critical { background: #fef2f2; }
.dsh-canvas-doc .tr-danger .td, .dsh-canvas-doc .tr-critical .td { border-bottom-color: #fecaca; }
.dsh-canvas-doc .tr-accent, .dsh-canvas-doc .tr-info { background: #eff6ff; }
.dsh-canvas-doc .tr-info .td { border-bottom-color: #bfdbfe; }
.dsh-canvas-doc .tr-muted { background: #f9fafb; }
.dsh-canvas-doc .tr-neutral { background: #f3f4f6; }
.dsh-canvas-doc .tr-neutral .td { border-bottom-color: #e5e7eb; }

/* ── card ─────────────────────────────────────────────────────────────── */
.dsh-canvas-doc .card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px 20px; margin-bottom: 16px; background: #fff; }
.dsh-canvas-doc .card-header { font-weight: 600; margin-bottom: 8px; }
.dsh-canvas-doc .card-subtitle { font-size: 0.875rem; color: #6b7280; margin-bottom: 8px; }

/* ── callout + banner ─────────────────────────────────────────────────── */
.dsh-canvas-doc .callout, .dsh-canvas-doc .banner { border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; font-size: 0.875rem; }
.dsh-canvas-doc .callout-info { border-left: 4px solid #3b82f6; background: #eff6ff; }
.dsh-canvas-doc .callout-success, .dsh-canvas-doc .callout-positive { border-left: 4px solid #22c55e; background: #f0fdf4; }
.dsh-canvas-doc .callout-warning, .dsh-canvas-doc .callout-caution { border-left: 4px solid #f59e0b; background: #fffbeb; }
.dsh-canvas-doc .callout-danger, .dsh-canvas-doc .callout-critical { border-left: 4px solid #ef4444; background: #fef2f2; }
.dsh-canvas-doc .callout-neutral { border-left: 4px solid #6b7280; background: #f9fafb; }
.dsh-canvas-doc .callout-title { font-weight: 600; margin-bottom: 4px; display: flex; align-items: center; gap: 6px; }
.dsh-canvas-doc .callout-icon { font-size: 1rem; line-height: 1; }
.dsh-canvas-doc .callout-body { color: #374151; }

/* ── pill / tag / badge / code ────────────────────────────────────────── */
.dsh-canvas-doc .pill { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem; font-weight: 500; margin-right: 4px; }
/* The "added" / "deleted" values are the diff semantics of the shared Tone
   union; they reuse the success/danger palette so a diff pill and a status
   pill agree. The "primary" value gets its own indigo so it cannot be
   confused with "info". */
.dsh-canvas-doc .pill-primary { background: #e0e7ff; color: #3730a3; }
.dsh-canvas-doc .pill-green, .dsh-canvas-doc .pill-success, .dsh-canvas-doc .pill-added { background: #dcfce7; color: #166534; }
.dsh-canvas-doc .pill-red, .dsh-canvas-doc .pill-danger, .dsh-canvas-doc .pill-deleted { background: #fee2e2; color: #991b1b; }
.dsh-canvas-doc .pill-yellow, .dsh-canvas-doc .pill-warning { background: #fef9c3; color: #854d0e; }
.dsh-canvas-doc .pill-blue, .dsh-canvas-doc .pill-info { background: #dbeafe; color: #1e40af; }
.dsh-canvas-doc .pill-gray, .dsh-canvas-doc .pill-neutral { background: #f3f4f6; color: #374151; }
.dsh-canvas-doc .tag { display: inline-flex; align-items: center; padding: 2px 10px; border-radius: 4px; font-size: 0.75rem; font-weight: 500; }
.dsh-canvas-doc .tag-success, .dsh-canvas-doc .tag-added { background: #dcfce7; color: #166534; }
.dsh-canvas-doc .tag-danger, .dsh-canvas-doc .tag-deleted { background: #fee2e2; color: #991b1b; }
.dsh-canvas-doc .tag-warning { background: #fef9c3; color: #854d0e; }
.dsh-canvas-doc .tag-info { background: #dbeafe; color: #1e40af; }
.dsh-canvas-doc .tag-primary { background: #e0e7ff; color: #3730a3; }
.dsh-canvas-doc .tag-neutral { background: #f3f4f6; color: #374151; }
.dsh-canvas-doc .badge { display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 500; background: #f3f4f6; color: #374151; }
.dsh-canvas-doc .code { font-family: 'SF Mono', Monaco, Consolas, monospace; font-size: 0.8125rem; background: #f3f4f6; padding: 2px 6px; border-radius: 4px; }
.dsh-canvas-doc .pre { font-family: 'SF Mono', Monaco, Consolas, monospace; font-size: 0.8125rem; background: #1e1e1e; color: #d4d4d4; padding: 16px; border-radius: 8px; overflow-x: auto; margin-bottom: 16px; white-space: pre-wrap; }
.dsh-canvas-doc .link { color: #2563eb; text-decoration: none; }
.dsh-canvas-doc .link:hover { text-decoration: underline; }

/* ── timeline ─────────────────────────────────────────────────────────── */
.dsh-canvas-doc .timeline { border-left: 2px solid #e5e7eb; padding-left: 20px; margin-bottom: 16px; }
.dsh-canvas-doc .timeline-item { margin-bottom: 16px; position: relative; }
.dsh-canvas-doc .timeline-dot { position: absolute; left: -25px; top: 4px; width: 10px; height: 10px; border-radius: 50%; background: #3b82f6; border: 2px solid #fff; box-shadow: 0 0 0 2px #e5e7eb; }
.dsh-canvas-doc .timeline-time { font-size: 0.75rem; color: #6b7280; margin-bottom: 2px; }
.dsh-canvas-doc .timeline-title { font-size: 0.9375rem; font-weight: 600; color: #111827; margin-bottom: 4px; }
.dsh-canvas-doc .timeline-desc { font-size: 0.8125rem; color: #6b7280; line-height: 1.5; }

/* ── key/value + steps ────────────────────────────────────────────────── */
.dsh-canvas-doc .kv-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f3f4f6; font-size: 0.875rem; }
.dsh-canvas-doc .kv-label { color: #6b7280; }
.dsh-canvas-doc .kv-value { color: #111827; font-weight: 500; }
.dsh-canvas-doc .steps { margin-bottom: 16px; }
.dsh-canvas-doc .step { display: flex; gap: 12px; margin-bottom: 8px; }
.dsh-canvas-doc .step-num { width: 24px; height: 24px; border-radius: 50%; background: #3b82f6; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 600; flex-shrink: 0; }
.dsh-canvas-doc .step-text { font-size: 0.875rem; color: #374151; padding-top: 2px; }

.dsh-canvas-doc .divider { border: none; border-top: 1px solid #e5e7eb; margin: 24px 0; }

/* ── images ───────────────────────────────────────────────────────────── */
.dsh-canvas-doc .canvas-image { margin: 0 0 16px 0; max-width: 100%; overflow: hidden; }
.dsh-canvas-doc .canvas-image img { display: block; width: 100%; max-width: 100%; max-height: 500px; object-fit: contain; border-radius: 8px; border: 1px solid #e5e7eb; background: #f9fafb; }
.dsh-canvas-doc .img-caption { font-size: 0.8125rem; color: #6b7280; margin-top: 6px; text-align: left; }
.dsh-canvas-doc .canvas-image-placeholder { margin: 0 0 16px 0; max-width: 100%; }
.dsh-canvas-doc .img-placeholder-box { background: #f3f4f6; border: 1px dashed #d1d5db; border-radius: 8px; padding: 32px; text-align: center; color: #6b7280; font-size: 0.875rem; }

/* ── evidence methodology ─────────────────────────────────────────────── */
.dsh-canvas-doc .evidence-methodology { border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 16px; background: #fafbfc; }
.dsh-canvas-doc .evi-title { font-size: 1rem; font-weight: 600; color: #111827; margin-bottom: 8px; }
.dsh-canvas-doc .evi-summary { font-size: 0.875rem; color: #374151; margin-bottom: 12px; padding: 8px 12px; background: #f0fdf4; border-radius: 6px; border-left: 3px solid #22c55e; }
.dsh-canvas-doc .evi-overview { font-size: 0.8125rem; color: #6b7280; margin-bottom: 12px; }
.dsh-canvas-doc .evi-meta { margin-bottom: 12px; }
.dsh-canvas-doc .evi-group { margin-bottom: 12px; }
.dsh-canvas-doc .evi-group-title { font-size: 0.8125rem; font-weight: 600; color: #374151; margin-bottom: 6px; padding-bottom: 4px; border-bottom: 1px solid #e5e7eb; }
.dsh-canvas-doc .evi-item { display: flex; justify-content: space-between; padding: 4px 0; font-size: 0.8125rem; }
.dsh-canvas-doc .evi-item-label { color: #6b7280; flex: 1; }
.dsh-canvas-doc .evi-item-value { color: #16a34a; font-weight: 500; text-align: right; flex: 1; }
.dsh-canvas-doc .evi-accounting { font-size: 0.8125rem; color: #6b7280; margin-top: 8px; padding-top: 8px; border-top: 1px solid #e5e7eb; font-style: italic; }

/* ── fidelity notices ─────────────────────────────────────────────────── */
.dsh-canvas-doc .unsupported { background: #fef3c7; border: 1px solid #fbbf24; border-radius: 4px; padding: 2px 6px; font-size: 0.8125rem; color: #92400e; font-family: monospace; }
.dsh-canvas-doc .unknown-component { border: 1px dashed #d1d5db; border-radius: 4px; padding: 8px; margin-bottom: 8px; max-width: 100%; overflow: hidden; }
.dsh-canvas-doc .unknown-component::before { content: "⚠ " attr(data-tag); font-size: 0.75rem; color: #9ca3af; display: block; margin-bottom: 4px; }
`.trim();
		`
html, body { margin: 0; padding: 0; }
body { background: #f5f5f5; overflow-x: hidden; }
`.trim();
		//#endregion
		//#region src/client/canvas/render.tsx
		/**
		* IR -> React tree.
		*
		* This is the single rendering implementation. It backs both the sidebar tab
		* (live React subtree) and the standalone `.rendered.html` export (via
		* `react-dom/server`), so the two can never drift.
		*
		* Ported from the earlier `scripts/render-with-images.ts` prototype. Two things
		* changed in the move:
		*
		* - **Images are URL-resolved, not base64-embedded.** `props.src` now carries
		*   the literal path from the source (the `canvasImage()` identity rule plus the
		*   statement-scanning fix make it resolve), so the caller decides how to fetch
		*   it — `mediaUrl(scope, path)` in the sidebar, a data URI in the export.
		*   The order-matching regex hack the prototype needed is gone.
		* - **Strings became elements.** No `innerHTML`, so there is no escaping step
		*   and no injection surface.
		*
		* Unsupported subtrees render as a visible notice (fidelity rule, spec §2.5):
		* we degrade one node and never guess.
		*/
		/** Read a prop as a string; `null`/absent becomes `''`. */
		function str(value) {
			if (value === null || value === void 0) return "";
			if (typeof value === "string") return value;
			if (typeof value === "number" || typeof value === "boolean") return String(value);
			return "";
		}
		/** Read a prop as a number, falling back when it is absent or non-numeric. */
		function num(value, fallback) {
			return typeof value === "number" && Number.isFinite(value) ? value : fallback;
		}
		/** Read a prop as an array of records, tolerating anything else. */
		function records(value) {
			if (!Array.isArray(value)) return [];
			return value.filter((item) => item !== null && typeof item === "object" && !Array.isArray(item));
		}
		/** Read a prop as a flat array. */
		function list(value) {
			return Array.isArray(value) ? value : [];
		}
		/**
		* Project a canvas `style={{…}}` literal onto React's style shape.
		*
		* Only scalar entries survive; anything nested is dropped rather than guessed.
		*/
		function inlineStyle(value) {
			if (value === null || typeof value !== "object" || Array.isArray(value)) return void 0;
			const out = {};
			for (const [key, entry] of Object.entries(value)) if (typeof entry === "string" || typeof entry === "number") out[key] = entry;
			return Object.keys(out).length === 0 ? void 0 : out;
		}
		/** Join class names, dropping empties. */
		function cx(...parts) {
			return parts.filter((p) => typeof p === "string" && p !== "").join(" ");
		}
		/** `tone` -> callout/banner glyph. */
		const TONE_ICON = {
			info: "ℹ️",
			warning: "⚠️",
			caution: "⚠️",
			danger: "🔴",
			critical: "🔴",
			success: "✅",
			positive: "✅",
			neutral: "•"
		};
		/** `tone` -> `Stat` value colour. Covers the whole SDK `Tone` union. */
		const STAT_COLOR = {
			success: "#16a34a",
			ok: "#16a34a",
			added: "#16a34a",
			danger: "#dc2626",
			deleted: "#dc2626",
			warning: "#d97706",
			info: "#2563eb",
			primary: "#2563eb",
			neutral: "#111827"
		};
		/** `state` -> timeline dot colour. */
		const TIMELINE_DOT = {
			completed: "#3b82f6",
			done: "#3b82f6",
			current: "#f59e0b",
			active: "#f59e0b",
			pending: "#d1d5db",
			upcoming: "#d1d5db"
		};
		/** `gap` prop -> CSS length. */
		function gapOf(value) {
			if (value === "section") return "24px";
			if (value === "component") return "12px";
			return typeof value === "number" ? `${value}px` : "8px";
		}
		/** Render a list of nodes. */
		function renderNodes(nodes, options = {}) {
			return nodes.map((child, index) => (0, react.createElement)(react.Fragment, { key: index }, renderNode(child, options)));
		}
		/** Render one node. */
		function renderNode(node, options = {}) {
			if (node.kind === "text") return node.value;
			if (node.kind === "unsupported") return (0, react.createElement)("span", { className: "unsupported" }, node.snippet ?? "…");
			const tag = node.tag === "" ? "div" : node.tag;
			const props = node.props;
			const kids = () => renderNodes(node.children, options);
			switch (tag) {
				case "ReportShell": return (0, react.createElement)("div", { className: "report-shell" }, kids());
				case "Stack": return (0, react.createElement)("div", {
					className: "stack",
					style: {
						display: "flex",
						flexDirection: "column",
						gap: gapOf(props.gap)
					}
				}, kids());
				case "Grid": {
					const cols = num(props.columns, 2);
					const gap = typeof props.gap === "number" ? `${props.gap}px` : "16px";
					return (0, react.createElement)("div", {
						className: cx("grid", `grid-${cols}`),
						style: {
							gridTemplateColumns: `repeat(${cols}, 1fr)`,
							gap
						}
					}, kids());
				}
				case "Row": {
					const align = props.align === "center" ? "center" : props.align === "end" ? "flex-end" : "flex-start";
					return (0, react.createElement)("div", {
						className: "row",
						style: {
							display: "flex",
							gap: "12px",
							alignItems: align
						}
					}, kids());
				}
				case "Column": return (0, react.createElement)("div", {
					className: "column",
					style: {
						flex: 1,
						minWidth: 0
					}
				}, kids());
				case "ReportSection": return (0, react.createElement)("section", { className: "report-section" }, (0, react.createElement)("div", { className: "section-header" }, (0, react.createElement)("h2", { className: "section-title" }, str(props.title)), props.description === void 0 || props.description === null ? null : (0, react.createElement)("p", { className: "section-desc" }, str(props.description))), (0, react.createElement)("div", { className: "section-body" }, kids()));
				case "H1": return (0, react.createElement)("h1", { className: "h1" }, kids());
				case "H2": return (0, react.createElement)("h2", { className: "h2" }, kids());
				case "H3": return (0, react.createElement)("h3", { className: "h3" }, kids());
				case "Text": {
					const tone = str(props.tone);
					const size = str(props.size);
					return (0, react.createElement)("span", { className: cx("text", tone && `text-${tone}`, size && `text-${size}`) }, kids());
				}
				case "P": return (0, react.createElement)("p", { className: "p" }, kids());
				case "Pill": return (0, react.createElement)("span", { className: cx("pill", `pill-${str(props.color) || str(props.tone) || "gray"}`) }, kids());
				case "Tag": return (0, react.createElement)("span", { className: cx("tag", `tag-${str(props.tone) || "neutral"}`) }, kids());
				case "Badge": return (0, react.createElement)("span", { className: "badge" }, kids());
				case "Code": return (0, react.createElement)("code", { className: "code" }, kids());
				case "Pre": return (0, react.createElement)("pre", { className: "pre" }, (0, react.createElement)("code", null, kids()));
				case "Link": return (0, react.createElement)("a", {
					className: "link",
					href: str(props.href) || "#"
				}, kids());
				case "Table": {
					const columns = records(props.columns);
					const explicit = records(props.data);
					const data = explicit.length > 0 ? explicit : records(props.rows);
					const headers = list(props.headers);
					let colDefs;
					let rowData;
					if (columns.length > 0 && data.length > 0) {
						colDefs = columns.map((c) => ({
							label: str(c.label) || str(c.title) || str(c.key),
							key: str(c.key)
						}));
						rowData = data;
					} else if (headers.length > 0) {
						colDefs = headers.map((h, i) => ({
							label: str(h),
							key: `_${i}`
						}));
						rowData = list(props.rows).map((row) => {
							const record = {};
							list(row).forEach((cell, i) => {
								record[`_${i}`] = cell;
							});
							return record;
						});
					} else return kids();
					const toneRaw = props.rowTone;
					const rowTones = Array.isArray(toneRaw) ? toneRaw.map((t) => str(t)) : typeof toneRaw === "string" ? rowData.map(() => toneRaw) : [];
					return (0, react.createElement)("div", { className: "table-wrap" }, (0, react.createElement)("table", { className: "table" }, (0, react.createElement)("thead", null, (0, react.createElement)("tr", null, colDefs.map((col, i) => (0, react.createElement)("th", {
						key: i,
						className: "th"
					}, col.label)))), (0, react.createElement)("tbody", null, rowData.map((row, ri) => (0, react.createElement)("tr", {
						key: ri,
						className: cx("tr", rowTones[ri] && `tr-${rowTones[ri]}`)
					}, colDefs.map((col, ci) => (0, react.createElement)("td", {
						key: ci,
						className: "td"
					}, str(row[col.key]))))))));
				}
				case "Stat": {
					const tone = str(props.tone);
					return (0, react.createElement)("div", { className: "stat" }, (0, react.createElement)("div", { className: "stat-label" }, str(props.label)), (0, react.createElement)("div", {
						className: "stat-value",
						style: { color: STAT_COLOR[tone] ?? "#111827" }
					}, str(props.value)));
				}
				case "MetricsGrid": {
					const metrics = records(props.metrics).length > 0 ? records(props.metrics) : records(props.items);
					const minWidth = num(props.columns, num(props.cols, 3)) <= 3 ? "200px" : "240px";
					return (0, react.createElement)("div", {
						className: "metrics-grid",
						style: { gridTemplateColumns: `repeat(auto-fit, minmax(${minWidth}, 1fr))` }
					}, metrics.map((metric, i) => (0, react.createElement)("div", {
						key: i,
						className: "metric-card"
					}, (0, react.createElement)("div", { className: "metric-value" }, str(metric.value)), (0, react.createElement)("div", { className: "metric-label" }, str(metric.label)))));
				}
				case "Timeline": {
					const items = records(props.items).length > 0 ? records(props.items) : records(props.events);
					return (0, react.createElement)("div", { className: "timeline" }, items.map((item, i) => {
						const when = str(item.timestamp) || str(item.time);
						const description = str(item.description);
						const state = str(item.state);
						return (0, react.createElement)("div", {
							key: i,
							className: "timeline-item"
						}, (0, react.createElement)("div", {
							className: "timeline-dot",
							style: { background: TIMELINE_DOT[state] ?? "#d1d5db" }
						}), (0, react.createElement)("div", { className: "timeline-content" }, when === "" ? null : (0, react.createElement)("div", { className: "timeline-time" }, when), (0, react.createElement)("div", { className: "timeline-title" }, str(item.title)), description === "" ? null : (0, react.createElement)("div", { className: "timeline-desc" }, description)));
					}));
				}
				case "KeyValue": {
					const items = records(props.items).length > 0 ? records(props.items) : records(props.data);
					if (items.length > 0) return (0, react.createElement)(react.Fragment, null, items.map((item, i) => (0, react.createElement)("div", {
						key: i,
						className: "kv-row"
					}, (0, react.createElement)("span", { className: "kv-label" }, str(item.label)), (0, react.createElement)("span", { className: "kv-value" }, str(item.value)))));
					return (0, react.createElement)("div", { className: "kv-row" }, (0, react.createElement)("span", { className: "kv-label" }, str(props.label)), (0, react.createElement)("span", { className: "kv-value" }, kids()));
				}
				case "Card": return (0, react.createElement)("div", { className: "card" }, props.subtitle === void 0 || props.subtitle === null ? null : (0, react.createElement)("p", { className: "card-subtitle" }, str(props.subtitle)), kids());
				case "CardHeader": return (0, react.createElement)("div", { className: "card-header" }, props.title === void 0 || props.title === null ? null : (0, react.createElement)("div", { className: "card-header-title" }, str(props.title)), kids());
				case "CardBody": return (0, react.createElement)("div", { className: "card-body" }, kids());
				case "Callout":
				case "Banner": {
					const tone = str(props.tone) || str(props.type) || "info";
					const icon = TONE_ICON[tone] ?? "ℹ️";
					return (0, react.createElement)("div", { className: cx(tag === "Banner" ? "banner" : "callout", `callout-${tone}`) }, props.title === void 0 || props.title === null ? null : (0, react.createElement)("div", { className: "callout-title" }, (0, react.createElement)("span", { className: "callout-icon" }, icon), " ", str(props.title)), (0, react.createElement)("div", { className: "callout-body" }, kids()));
				}
				case "Separator":
				case "Divider": return (0, react.createElement)("hr", { className: "divider" });
				case "Steps": return (0, react.createElement)("div", { className: "steps" }, records(props.items).map((item, i) => (0, react.createElement)("div", {
					key: i,
					className: "step"
				}, (0, react.createElement)("div", { className: "step-num" }, i + 1), (0, react.createElement)("div", { className: "step-text" }, str(item.text)))));
				case "EvidenceMethodology": {
					const metadata = records(props.metadata);
					const groups = records(props.groups);
					const accounting = str(props.accounting);
					const overview = str(props.overview);
					const summary = str(props.summary);
					const title = str(props.title);
					return (0, react.createElement)("div", { className: "evidence-methodology" }, title === "" ? null : (0, react.createElement)("h3", { className: "evi-title" }, title), summary === "" ? null : (0, react.createElement)("div", { className: "evi-summary" }, summary), overview === "" ? null : (0, react.createElement)("div", { className: "evi-overview" }, (0, react.createElement)("strong", null, "验证流程："), overview), metadata.length === 0 ? null : (0, react.createElement)("table", { className: "table evi-meta" }, (0, react.createElement)("thead", null, (0, react.createElement)("tr", null, (0, react.createElement)("th", { className: "th" }, "模块"), (0, react.createElement)("th", { className: "th" }, "结果"))), (0, react.createElement)("tbody", null, metadata.map((item, i) => (0, react.createElement)("tr", {
						key: i,
						className: "tr tr-success"
					}, (0, react.createElement)("td", { className: "td" }, str(item.label)), (0, react.createElement)("td", { className: "td" }, str(item.value)))))), groups.map((group, gi) => (0, react.createElement)("div", {
						key: gi,
						className: "evi-group"
					}, (0, react.createElement)("div", { className: "evi-group-title" }, str(group.title)), records(group.items).map((item, ii) => (0, react.createElement)("div", {
						key: ii,
						className: "evi-item"
					}, (0, react.createElement)("span", { className: "evi-item-label" }, str(item.label)), (0, react.createElement)("span", { className: "evi-item-value" }, str(item.value)))))), accounting === "" ? null : (0, react.createElement)("div", { className: "evi-accounting" }, (0, react.createElement)("strong", null, "审计说明："), accounting));
				}
				case "img": {
					const alt = str(props.alt) || str(props.title) || "截图";
					const ref = str(props.src);
					const resolved = ref === "" ? void 0 : options.resolveImage === void 0 ? ref : options.resolveImage(ref);
					const style = inlineStyle(props.style);
					if (resolved === void 0) return (0, react.createElement)("figure", { className: "canvas-image-placeholder" }, (0, react.createElement)("div", { className: "img-placeholder-box" }, `📷 ${alt}`), (0, react.createElement)("figcaption", { className: "img-caption" }, ref === "" ? "(图片未嵌入)" : `${ref} (未找到)`));
					return (0, react.createElement)("figure", { className: "canvas-image" }, (0, react.createElement)("img", {
						src: resolved,
						alt,
						style,
						loading: "lazy"
					}), (0, react.createElement)("figcaption", { className: "img-caption" }, alt));
				}
				case "br": return (0, react.createElement)("br");
				case "span": return (0, react.createElement)("span", { style: inlineStyle(props.style) }, kids());
				case "div": return (0, react.createElement)("div", { style: inlineStyle(props.style) }, kids());
				case "strong": return (0, react.createElement)("strong", null, kids());
				case "em": return (0, react.createElement)("em", null, kids());
				case "code": return (0, react.createElement)("code", { className: "code" }, kids());
				default:
					if (node.tag !== "" && node.tag[0] === node.tag[0]?.toLowerCase() && node.tag[0] !== node.tag[0]?.toUpperCase()) return (0, react.createElement)(node.tag, { style: inlineStyle(props.style) }, kids());
					return (0, react.createElement)("div", {
						className: "unknown-component",
						"data-tag": node.tag || "(Fragment)"
					}, kids());
			}
		}
		/**
		* A whole canvas document: scoping root -> centred page -> paper shell.
		*
		* The shell is added here only when the source does not already provide one.
		* Files rooted at `<Stack>` (a real pattern in the corpus) would otherwise
		* render with no card at all.
		*/
		function CanvasDocument(props) {
			const { root, options } = props;
			const hasShell = root.kind === "element" && root.tag === "ReportShell";
			return (0, react.createElement)("div", {
				className: CANVAS_ROOT_CLASS,
				"data-dsh-canvas": "document"
			}, (0, react.createElement)("div", { className: "page-wrap" }, hasShell ? renderNode(root, options) : (0, react.createElement)("div", { className: "report-shell" }, renderNode(root, options))));
		}
		//#endregion
		//#region src/client/canvas/stylesheet.ts
		/**
		* The one place that owns the document stylesheet's identity and installation.
		*
		* Both surfaces — the file viewer and the sidebar tab — render the same
		* document, so they must share a single `<style>` element. They are separate
		* React trees that can mount in either order, so "install once per page" cannot
		* be tracked with a local flag; the DOM is the only shared state.
		*
		* Installation is content-addressed rather than first-wins. Under client-plugin
		* HMR the module is re-evaluated with new CSS while the DOM keeps the element
		* from the previous revision, so a naive `if (existing) return` guard pins the
		* page to the stale stylesheet until a full reload — a CSS edit would appear to
		* do nothing. Comparing the current text and rewriting on a mismatch makes an
		* edit land on the next render.
		*/
		/** Stylesheet id — shared by every surface so duplicates cannot stack. */
		const STYLE_ID = "dsh-canvas-tsx-sidebar/styles";
		/**
		* Install the document stylesheet, or refresh it in place when its bytes are
		* stale.
		*
		* The element is deliberately never removed: doing so would flash every other
		* mounted canvas surface, and the content check already makes a re-run a no-op.
		*/
		function ensureCanvasStyles() {
			if (typeof document === "undefined") return;
			const existing = document.getElementById(STYLE_ID);
			if (existing === null) {
				const style = document.createElement("style");
				style.id = STYLE_ID;
				style.textContent = CANVAS_CSS;
				document.head.appendChild(style);
				return;
			}
			if (existing.textContent !== CANVAS_CSS) existing.textContent = CANVAS_CSS;
		}
		//#endregion
		//#region src/client/canvas/paths.ts
		/**
		* Path helpers for the canvas renderer.
		*
		* These are deliberate mirrors of better-sidebar's own client-side helpers —
		* `src/client/paths.ts` and the media-destination logic in
		* `src/client/markdown-images.ts` — kept local because we consume that package
		* over the wire instead of importing it (see `sidebar-api.ts` for why).
		*
		* Mirroring matters more than it looks. `isAbsolutePath` must agree with the
		* host's notion of absolute, or a path the host would resolve verbatim gets
		* silently joined onto the cwd here. `isWithinWorkspace` mirrors the host's
		* `isWithin` (`fs-tree.ts`) so our containment decision matches the one the
		* media route makes.
		*
		* The one thing NOT copied is better-sidebar's willingness to serve absolute
		* paths outside the workspace: that is behind its `workspaceFence` setting,
		* which ships as `true` but is user-disableable, and its own docs warn that
		* while it is off "any same-origin script (including third-party consumer
		* plugins) can read/write outside the workspace through those routes". We are
		* such a plugin, so `isInsideWorkspace` below holds unconditionally.
		*/
		/**
		* Mirror of the host's absolute-path notion: POSIX roots, Windows drive
		* letters, and UNC shares in both `\\server\share` and `//server/share` form.
		* Deliberately a superset, exactly as the host's own client mirror is.
		*/
		function isAbsolutePath(path) {
			return path.startsWith("/") || /^[A-Za-z]:[\\/]/.test(path) || /^[\\/]{2}[^\\/]/.test(path);
		}
		/** True for a remote URL (`http:`, `data:`, …) but NOT a Windows drive path. */
		function isRemoteUrl(dest) {
			return /^[a-z][a-z0-9+.-]*:/i.test(dest) && !/^[A-Za-z]:[\\/]/.test(dest);
		}
		/** Last path segment of a '/'- or '\'-separated path. */
		function baseName$1(path) {
			const at = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
			return at === -1 ? path : path.slice(at + 1);
		}
		/**
		* Collapse `.`/`..` segments while PRESERVING the root form — a POSIX `/`,
		* a Windows drive (`C:\`), or a UNC `\\server\share` prefix.
		*
		* Preserving the root is the whole point: a naive join turns `C:/x.png` into
		* the harmless-looking relative `dir/C:/x.png`, which sails past any
		* containment check that only looks for a leading drive letter.
		*/
		function normalizeLocalPath(path) {
			const drive = /^([A-Za-z]:)[\\/]/.exec(path)?.[1];
			const parts = (drive !== void 0 ? path.slice(drive.length) : path).split(/[\\/]+/).filter((segment) => segment !== "" && segment !== ".");
			const out = [];
			for (const part of parts) {
				if (part === "..") {
					out.pop();
					continue;
				}
				out.push(part);
			}
			if (drive !== void 0) return `${drive}\\${out.join("\\")}`;
			const separator = path.startsWith("\\") ? "\\" : "/";
			return `${path.startsWith("/") ? "/" : path.startsWith("\\") ? "\\\\" : ""}${out.join(separator)}`;
		}
		/**
		* Whether `target` lies under `base` (or equals it), tolerant of separator
		* style and letter case. Mirrors the host's `isWithin`.
		*
		* Case-insensitivity is unconditional here, matching better-sidebar's own
		* client mirror: the client cannot reliably know the host's platform, and
		* over-matching only ever makes us MORE permissive about calling something
		* "inside", which the caller then re-checks against the real fence.
		*/
		function isWithinWorkspace(base, target) {
			const norm = (value) => value.replace(/[\\/]+/g, "/").replace(/\/$/, "");
			const b = norm(base).toLowerCase();
			const t = norm(target).toLowerCase();
			return t === b || t.startsWith(`${b}/`);
		}
		/**
		* Our containment policy: a relative path is fine (the host resolves it under
		* the session cwd), an absolute one must sit inside the workspace.
		*
		* Held unconditionally — see the module comment — so the tab cannot be turned
		* into an arbitrary-file reader by a host setting we do not control.
		*/
		function isInsideWorkspace(cwd, path) {
			if (!isAbsolutePath(path)) return true;
			if (cwd === void 0 || cwd === "") return false;
			return isWithinWorkspace(cwd, path);
		}
		/**
		* Resolve one `canvasImage()` reference against the canvas file's directory,
		* mirroring `resolveLocalMediaDest`'s local branch.
		*
		* @param dest - the reference literal from the source.
		* @param filePath - the canvas file's own path (relative or absolute).
		* @returns a canonical local path, the remote URL unchanged, or `undefined`
		*   when the reference is empty, an anchor, or unresolvable.
		*/
		function resolveMediaRef(dest, filePath) {
			const trimmed = dest.trim();
			if (trimmed === "" || trimmed.startsWith("#")) return void 0;
			if (isRemoteUrl(trimmed)) return trimmed;
			const slash = Math.max(filePath.lastIndexOf("/"), filePath.lastIndexOf("\\"));
			const directory = slash === -1 ? "" : filePath.slice(0, slash + 1);
			return normalizeLocalPath(isAbsolutePath(trimmed) ? trimmed : directory + trimmed);
		}
		//#endregion
		//#region src/client/canvas/sidebar-api.ts
		/** One host wire failure. */
		var SidebarApiError = class extends Error {
			code;
			constructor(code, message) {
				super(message);
				this.code = code;
				this.name = "SidebarApiError";
			}
		};
		/** True when the failure means better-sidebar is not serving us at all. */
		function isUnavailable(error) {
			if (!(error instanceof SidebarApiError)) return false;
			return error.code === "network" || error.code === "http" || error.code === "not-found";
		}
		/** True when the host's workspace fence refused the path. */
		function isOutsideWorkspace(error) {
			return error instanceof SidebarApiError && error.message.includes("outside workspace");
		}
		/** POST one method and unwrap the envelope. */
		async function call(method, payload, signal) {
			let response;
			try {
				response = await fetch(`/sidebar/api/${method}`, {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify(payload),
					signal
				});
			} catch (error) {
				if (error instanceof DOMException && error.name === "AbortError") throw error;
				throw new SidebarApiError("network", error instanceof Error ? error.message : String(error));
			}
			const parsed = await response.json().catch(() => null);
			if (!response.ok || parsed === null || parsed.ok !== true || parsed.value === void 0) throw new SidebarApiError(parsed?.error?.code ?? "http", parsed?.error?.message ?? `HTTP ${response.status}`);
			return parsed.value;
		}
		/** Build the scoped payload both calls share. */
		function scoped(scope, extra) {
			return {
				sessionId: scope.sessionId,
				...scope.cwd !== void 0 && scope.cwd !== "" ? { cwd: scope.cwd } : {},
				...scope.repoRoot !== void 0 && scope.repoRoot !== "" ? { repoRoot: scope.repoRoot } : {},
				...extra
			};
		}
		/**
		* Read one text file through the host's reader.
		*
		* `path` may be workspace-relative or absolute; the host resolves both. Note
		* that the host route fences RELATIVE traversal but not absolute paths (a probe
		* of the deployed host read `C:/Windows/win.ini` through it), so callers own
		* that check — see `isInsideWorkspace` in `CanvasReportTab`.
		*/
		async function fsReadText(scope, path, signal) {
			const value = await call("fs.read", scoped(scope, { path }), signal);
			if (value.kind !== "text" || typeof value.content !== "string") throw new SidebarApiError("binary", `${path} is not a text file`);
			return {
				content: value.content,
				truncated: value.truncated === true
			};
		}
		/**
		* Absolute URL of the media route for one path — how the document's
		* `<img src>` values are served without base64-encoding them into the tree.
		*
		* Returned ORIGIN-ABSOLUTE, matching better-sidebar's own `mediaUrl`: a
		* relative URL would break the moment the markup is rendered anywhere with a
		* different base (an iframe, a blob document), and their shared markdown
		* renderer only accepts absolute http(s) image URLs.
		*/
		function mediaUrl(scope, path) {
			const params = new URLSearchParams({
				sessionId: scope.sessionId,
				path
			});
			if (scope.cwd !== void 0 && scope.cwd !== "") params.set("cwd", scope.cwd);
			return `${typeof window === "undefined" ? "" : window.location.origin}/sidebar/file?${params.toString()}`;
		}
		//#endregion
		//#region src/client/CanvasReportTab.tsx
		/**
		* The sidebar tab body.
		*
		* Scope: point it at ONE `.canvas.tsx` and it renders that file. It is not a
		* workspace browser — no scanning, no discovery.
		*
		* Why the path comes from the user rather than from a file viewer registration:
		* better-sidebar's `matchFileViewer` compares `extOf(path)`, which takes the
		* LAST dot segment, so `exts: ['canvas.tsx']` can never match a file named
		* `report.canvas.tsx` (its ext is `'tsx'`). Claiming `exts: ['tsx']` would
		* hijack every TSX file in the workspace. And `detect(path, head)` cannot help:
		* `matchFileViewer` is first called with no `head` at all, and `head` is only
		* supplied for `kind === 'binary'` results — never for a `.tsx`. There is also
		* no delegation API back to the built-in code viewer. The tab is therefore the
		* only seam that can own a canvas-specific view, and `tab.path` is how a
		* specific file reaches it.
		*
		* Two contracts from the plugin guide are honoured throughout:
		*
		* 1. **Height contract (§10).** The tab body mounts inside a full-height column
		*    flex host whose `.paneBody` is a definite-height BLOCK scroll container.
		*    The root declares `height: 100%` + `min-height: 0`, and the scrolling
		*    element is an inner div — not the root.
		* 2. **`visible` pause (§9).** Nothing is fetched until the tab is the active
		*    one; an in-flight request is aborted when it stops being visible.
		*
		* Chrome colours are `--dsw-alias-*` tokens so every skin follows. The document
		* subtree deliberately keeps its own paper palette — see `styles.ts`.
		*/
		/** Read the persisted mode out of the tab's own meta blob. */
		function readMode(meta) {
			if (meta !== null && typeof meta === "object" && meta.mode === "code") return "code";
			return "preview";
		}
		/** Install the document stylesheet, refreshing a stale copy left by HMR. */
		function useDocumentStyles() {
			(0, react.useEffect)(() => {
				ensureCanvasStyles();
			}, []);
		}
		const ROOT_STYLE$1 = {
			display: "flex",
			flexDirection: "column",
			height: "100%",
			minHeight: 0,
			background: "var(--dsw-alias-bg-layer-1)",
			color: "var(--dsw-alias-label-primary)",
			font: "inherit",
			fontSize: 13
		};
		const BAR_STYLE$1 = {
			display: "flex",
			alignItems: "center",
			gap: 6,
			padding: "8px 12px",
			borderBottom: "1px solid var(--dsw-alias-border-secondary)",
			flexShrink: 0
		};
		const SCROLL_STYLE$1 = {
			flex: 1,
			minHeight: 0,
			overflow: "auto"
		};
		const INPUT_STYLE = {
			flex: 1,
			minWidth: 0,
			border: "1px solid var(--dsw-alias-border-secondary)",
			background: "var(--dsw-alias-bg-layer-2)",
			color: "var(--dsw-alias-label-primary)",
			borderRadius: 6,
			padding: "3px 8px",
			font: "inherit",
			fontSize: 12
		};
		const BUTTON_STYLE = {
			border: "1px solid var(--dsw-alias-border-secondary)",
			background: "var(--dsw-alias-bg-layer-2)",
			color: "var(--dsw-alias-label-primary)",
			borderRadius: 6,
			padding: "3px 10px",
			cursor: "pointer",
			font: "inherit",
			fontSize: 12,
			whiteSpace: "nowrap"
		};
		/** Segmented code/preview control: the container. */
		const SEGMENT_STYLE$1 = {
			display: "inline-flex",
			border: "1px solid var(--dsw-alias-border-secondary)",
			borderRadius: 6,
			overflow: "hidden",
			flexShrink: 0
		};
		/**
		* One segment, idle.
		*
		* `fontWeight` is declared on BOTH segments on purpose: React warns (and the
		* style can go stale) when a rerender REMOVES a longhand that a `font`
		* shorthand in the same object still sets. Declaring it everywhere means the
		* property is only ever replaced, never removed.
		*/
		const SEGMENT_OFF_STYLE$1 = {
			border: "none",
			background: "var(--dsw-alias-bg-layer-2)",
			color: "var(--dsw-alias-label-tertiary)",
			padding: "3px 10px",
			cursor: "pointer",
			font: "inherit",
			fontSize: 12,
			fontWeight: 400,
			whiteSpace: "nowrap"
		};
		/** One segment, active. */
		const SEGMENT_ON_STYLE$1 = {
			...SEGMENT_OFF_STYLE$1,
			background: "var(--dsw-alias-bg-layer-3, var(--dsw-alias-bg-layer-2))",
			color: "var(--dsw-alias-label-primary)",
			fontWeight: 600
		};
		/** The raw-source view. */
		const CODE_STYLE$1 = {
			margin: 0,
			padding: "10px 12px",
			fontFamily: "'SF Mono', Monaco, Consolas, monospace",
			fontSize: 12,
			lineHeight: 1.55,
			whiteSpace: "pre",
			tabSize: 2,
			color: "var(--dsw-alias-label-secondary)"
		};
		/** Centred message block used by every non-document state. */
		function Notice(props) {
			return (0, react.createElement)("div", { style: {
				margin: "0 auto",
				padding: 24,
				maxWidth: 460,
				textAlign: "center",
				color: "var(--dsw-alias-label-tertiary)",
				lineHeight: 1.7,
				fontSize: 12
			} }, (0, react.createElement)("div", { style: {
				marginBottom: 6,
				color: "var(--dsw-alias-label-secondary)"
			} }, props.title), props.detail === void 0 ? null : (0, react.createElement)("div", null, props.detail));
		}
		function CanvasReportTab(props) {
			const { t, scope, tab, service, visible = true } = props;
			useDocumentStyles();
			const seeded = tab?.path;
			/** What the user is typing. */
			const [draft, setDraft] = (0, react.useState)(seeded ?? "");
			/** What we are actually rendering — set only on a validated submit. */
			const [path, setPath] = (0, react.useState)(seeded);
			const [status, setStatus] = (0, react.useState)(seeded === void 0 ? "no-path" : "loading");
			const [parsed, setParsed] = (0, react.useState)(void 0);
			const [error, setError] = (0, react.useState)(void 0);
			/** The raw source, kept so the code view needs no second read. */
			const [source, setSource] = (0, react.useState)(void 0);
			/** Code or preview; persisted in `tab.meta` so it survives a reload. */
			const [mode, setMode] = (0, react.useState)(() => readMode(tab?.meta));
			(0, react.useEffect)(() => {
				if (seeded === void 0 || seeded === path) return;
				setDraft(seeded);
				setPath(seeded);
			}, [seeded, path]);
			(0, react.useEffect)(() => {
				if (!visible || path === void 0) return;
				const controller = new AbortController();
				setStatus("loading");
				setError(void 0);
				fsReadText(scope, path, controller.signal).then((file) => {
					if (controller.signal.aborted) return;
					setSource(file.content);
					setParsed(extractCanvas(file.content));
					setStatus("ready");
				}).catch((cause) => {
					if (controller.signal.aborted) return;
					setStatus("error");
					setError(describe(cause));
				});
				return () => controller.abort();
			}, [
				visible,
				scope,
				path
			]);
			const submit = (0, react.useCallback)(() => {
				const next = draft.trim();
				if (next === "") {
					setStatus("no-path");
					setPath(void 0);
					return;
				}
				if (!isInsideWorkspace(scope.cwd, next)) {
					setStatus("error");
					setError(t("error.outsideWorkspace"));
					return;
				}
				setPath(next);
				try {
					service?.updateTab(tab?.id ?? "", {
						path: next,
						title: baseName$1(next)
					});
				} catch {}
			}, [
				draft,
				scope.cwd,
				service,
				tab,
				t
			]);
			const resolveImage = (0, react.useCallback)((ref) => {
				if (isRemoteUrl(ref)) return ref;
				const candidate = resolveMediaRef(ref, path ?? "");
				if (candidate === void 0) return void 0;
				return isInsideWorkspace(scope.cwd, candidate) ? mediaUrl(scope, candidate) : void 0;
			}, [scope, path]);
			/** Flip code/preview and persist the choice on the tab. */
			const switchMode = (next) => {
				setMode(next);
				try {
					service?.updateTab(tab?.id ?? "", { meta: { mode: next } });
				} catch {}
			};
			const toggle = source === void 0 ? null : (0, react.createElement)("div", {
				style: SEGMENT_STYLE$1,
				role: "group",
				"aria-label": t("mode.label")
			}, ["preview", "code"].map((option) => (0, react.createElement)("button", {
				key: option,
				type: "button",
				style: mode === option ? SEGMENT_ON_STYLE$1 : SEGMENT_OFF_STYLE$1,
				"aria-pressed": mode === option,
				onClick: () => switchMode(option)
			}, t(option === "preview" ? "mode.preview" : "mode.code"))));
			const bar = (0, react.createElement)("div", { style: BAR_STYLE$1 }, (0, react.createElement)("input", {
				style: INPUT_STYLE,
				value: draft,
				spellCheck: false,
				placeholder: t("input.placeholder"),
				"aria-label": t("input.placeholder"),
				onChange: (event) => setDraft(event.target.value),
				onKeyDown: (event) => {
					if (event.key === "Enter") submit();
				}
			}), (0, react.createElement)("button", {
				type: "button",
				style: BUTTON_STYLE,
				onClick: submit
			}, t("action.open")), toggle);
			let body;
			if (status === "no-path") body = (0, react.createElement)(Notice, {
				title: t("state.noPath"),
				detail: t("state.noPathHint")
			});
			else if (status === "loading") body = (0, react.createElement)(Notice, { title: t("state.loading") });
			else if (status === "error") body = (0, react.createElement)(Notice, {
				title: t("state.error"),
				detail: error
			});
			else if (mode === "code" && source !== void 0) body = (0, react.createElement)("pre", { style: CODE_STYLE$1 }, source);
			else if (parsed !== void 0 && !parsed.ok) body = (0, react.createElement)(Notice, {
				title: t("state.parseFailed"),
				detail: `${parsed.error.code}: ${parsed.error.message}`
			});
			else if (parsed !== void 0 && parsed.ok) body = (0, react.createElement)(CanvasDocument, {
				root: parsed.root,
				options: { resolveImage }
			});
			else body = (0, react.createElement)(Notice, { title: t("state.loading") });
			return (0, react.createElement)("div", {
				style: ROOT_STYLE$1,
				"data-dsh-canvas-tsx": "root"
			}, bar, (0, react.createElement)("div", { style: SCROLL_STYLE$1 }, body));
		}
		/** Turn a thrown value into something worth showing a user. */
		function describe(cause) {
			if (isUnavailable(cause)) return "better-sidebar is not serving the fs API.";
			if (isOutsideWorkspace(cause)) return "The path is outside the session workspace.";
			if (cause instanceof SidebarApiError) return `${cause.code}: ${cause.message}`;
			return cause instanceof Error ? cause.message : String(cause);
		}
		//#endregion
		//#region src/client/canvas/canvas-viewer.tsx
		/**
		* File viewer: renders `.canvas.tsx` as a live document in the sidebar's
		* native editor surface, with a code/preview toggle.
		*
		* Registration: `apply()` registers this viewer for `exts: ['tsx']` at a
		* priority above the catch-all `code` viewer. For a `.canvas.tsx` file the
		* user gets a rendered document with a toggle; for other `.tsx` files they
		* get a monospace source view. Both can be disabled in the Side card
		* settings page without restarting.
		*
		* Why we do our own `fsRead` instead of piggy-backing on the host's read:
		* `FileViewerProps` does not carry the file content — the host reads it and
		* passes `mode`/`setMode` instead. The second round-trip is acceptable
		* because the host caches the read.
		*/
		/** Viewer id — also the settings toggle key (`viewersEnabled[id]`). */
		const VIEWER_ID = "dsh-canvas-tsx:viewer";
		/** Bare file name of any path spelling. */
		function baseName(path) {
			const at = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
			return at === -1 ? path : path.slice(at + 1);
		}
		const ROOT_STYLE = {
			height: "100%",
			minHeight: 0,
			overflow: "auto",
			display: "flex",
			flexDirection: "column",
			background: "var(--dsw-alias-bg-layer-1)",
			color: "var(--dsw-alias-label-primary)",
			fontSize: 13
		};
		const BAR_STYLE = {
			display: "flex",
			alignItems: "center",
			gap: 6,
			padding: "8px 12px",
			borderBottom: "1px solid var(--dsw-alias-border-secondary)",
			flexShrink: 0
		};
		const SCROLL_STYLE = {
			flex: 1,
			minHeight: 0,
			overflow: "auto"
		};
		const SEGMENT_STYLE = {
			display: "inline-flex",
			border: "1px solid var(--dsw-alias-border-secondary)",
			borderRadius: 6,
			overflow: "hidden",
			flexShrink: 0
		};
		const SEGMENT_OFF_STYLE = {
			border: "none",
			background: "var(--dsw-alias-bg-layer-2)",
			color: "var(--dsw-alias-label-tertiary)",
			padding: "3px 10px",
			cursor: "pointer",
			font: "inherit",
			fontSize: 12,
			fontWeight: 400,
			whiteSpace: "nowrap"
		};
		const SEGMENT_ON_STYLE = {
			...SEGMENT_OFF_STYLE,
			background: "var(--dsw-alias-bg-layer-3, var(--dsw-alias-bg-layer-2))",
			color: "var(--dsw-alias-label-primary)",
			fontWeight: 600
		};
		const CODE_STYLE = {
			margin: 0,
			padding: "10px 12px",
			fontFamily: "'SF Mono', Monaco, Consolas, monospace",
			fontSize: 12,
			lineHeight: 1.55,
			whiteSpace: "pre",
			tabSize: 2,
			color: "var(--dsw-alias-label-secondary)"
		};
		const NOTICE_STYLE = {
			margin: "auto",
			padding: 24,
			textAlign: "center",
			color: "var(--dsw-alias-label-tertiary)",
			lineHeight: 1.7,
			fontSize: 12
		};
		/**
		* File viewer for `.canvas.tsx` files.
		*
		* The viewer checks the source: if `extractCanvas` succeeds, the user gets a
		* rendered document and a code/preview toggle. If it fails (non-canvas `.tsx`
		* or a parse error), the raw source is shown in a monospace block. This is an
		* honest degradation — the source is always available — and the user can
		* disable the entire viewer in settings if the plain-text fallback is too
		* disruptive for non-canvas files.
		*/
		function CanvasFileViewer(props) {
			const { scope, path } = props;
			const [viewMode, setViewMode] = (0, react.useState)("preview");
			const [status, setStatus] = (0, react.useState)("loading");
			const [source, setSource] = (0, react.useState)("");
			const [parsed, setParsed] = (0, react.useState)(void 0);
			const [error, setError] = (0, react.useState)(void 0);
			(0, react.useEffect)(() => {
				ensureCanvasStyles();
			}, []);
			(0, react.useEffect)(() => {
				const controller = new AbortController();
				setStatus("loading");
				setError(void 0);
				fsReadText(scope, path, controller.signal).then((file) => {
					if (controller.signal.aborted) return;
					setSource(file.content);
					setParsed(extractCanvas(file.content));
					setStatus("ready");
				}).catch((cause) => {
					if (controller.signal.aborted) return;
					setStatus("error");
					setError(isUnavailable(cause) ? "better-sidebar is not serving the fs API." : cause instanceof SidebarApiError ? `${cause.code}: ${cause.message}` : cause instanceof Error ? cause.message : String(cause));
				});
				return () => controller.abort();
			}, [scope, path]);
			const isCanvas = parsed !== void 0 && parsed.ok;
			const resolveImage = (0, react.useCallback)((ref) => {
				if (isRemoteUrl(ref)) return ref;
				const candidate = resolveMediaRef(ref, path);
				if (candidate === void 0) return void 0;
				return isInsideWorkspace(scope.cwd, candidate) ? mediaUrl(scope, candidate) : void 0;
			}, [scope, path]);
			const toggle = !isCanvas || source === "" ? null : (0, react.createElement)("div", {
				style: SEGMENT_STYLE,
				role: "group",
				"aria-label": "Display mode"
			}, ["preview", "code"].map((mode) => (0, react.createElement)("button", {
				key: mode,
				type: "button",
				style: viewMode === mode ? SEGMENT_ON_STYLE : SEGMENT_OFF_STYLE,
				"aria-pressed": viewMode === mode,
				onClick: () => setViewMode(mode)
			}, mode === "preview" ? "预览" : "代码")));
			const bar = (0, react.createElement)("div", { style: BAR_STYLE }, (0, react.createElement)("span", { style: {
				fontSize: 12,
				color: "var(--dsw-alias-label-tertiary)",
				overflow: "hidden",
				textOverflow: "ellipsis",
				whiteSpace: "nowrap"
			} }, baseName(path)), toggle);
			let body;
			if (status === "loading") body = (0, react.createElement)("div", { style: NOTICE_STYLE }, "读取中…");
			else if (status === "error") body = (0, react.createElement)("div", { style: NOTICE_STYLE }, (0, react.createElement)("div", { style: {
				fontWeight: 600,
				marginBottom: 6
			} }, "读取失败"), error);
			else if (parsed !== void 0 && !parsed.ok) body = (0, react.createElement)("pre", { style: CODE_STYLE }, source);
			else if (parsed?.ok && viewMode === "preview") body = (0, react.createElement)(CanvasDocument, {
				root: parsed.root,
				options: { resolveImage }
			});
			else body = (0, react.createElement)("pre", { style: CODE_STYLE }, source);
			return (0, react.createElement)("div", { style: ROOT_STYLE }, bar, (0, react.createElement)("div", { style: SCROLL_STYLE }, body));
		}
		//#endregion
		//#region src/client/CanvasIcon.tsx
		/**
		* Tab glyph.
		*
		* Skin contract (guide §12): plugin-drawn glyphs must take their colour from
		* the `--dsw-alias-*` tokens — no colour literals anywhere in this file. The
		* `tests/theme.spec.ts` guard scans this module for exactly that.
		*/
		/**
		* A page-with-chart mark for the Canvas report tab.
		* @param size - square edge in px (host passes its own tab-icon size).
		*/
		function CanvasIcon(size) {
			return (0, react.createElement)("svg", {
				width: size,
				height: size,
				viewBox: "0 0 16 16",
				fill: "none",
				"aria-hidden": "true",
				focusable: "false",
				style: {
					display: "block",
					flex: "none"
				}
			}, (0, react.createElement)("path", {
				d: "M3.5 2h6.2L13 5.3V12a2 2 0 0 1-2 2H3.5a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z",
				stroke: "var(--dsw-alias-label-tertiary)",
				strokeWidth: 1.2,
				strokeLinejoin: "round"
			}), (0, react.createElement)("path", {
				d: "M9.4 2.2v3.2h3.3",
				stroke: "var(--dsw-alias-label-tertiary)",
				strokeWidth: 1.2,
				strokeLinejoin: "round"
			}), (0, react.createElement)("path", {
				d: "M4.6 10.6v-2.1M7.2 10.6V7.2M9.8 10.6V8.9",
				stroke: "var(--dsw-alias-state-business-primary)",
				strokeWidth: 1.4,
				strokeLinecap: "round"
			}));
		}
		//#endregion
		//#region src/client/locales.ts
		/**
		* Plugin-owned i18n dictionary.
		*
		* Consumer plugins must NOT reach into better-sidebar's internal `t()` or its
		* `betterSidebar` dictionary namespace (guide §10). We therefore register our
		* own namespace through the DSH `locale` service, exactly as the reference
		* consumer plugin `dsh-code-nav` does (`ctx.locale.register(NS, { zh, en })`).
		*/
		/** Our own namespace, kept short and package-scoped. */
		const NS = "dsh-canvas-tsx-sidebar";
		const dictionaries = {
			zh: {
				"tab.title": "Canvas 报告",
				"tab.desc": "把 .canvas.tsx 报告渲染成 HTML 页面",
				"input.placeholder": ".canvas.tsx 路径，例如 try/report.canvas.tsx",
				"action.open": "打开",
				"mode.label": "显示方式",
				"mode.preview": "预览",
				"mode.code": "代码",
				"state.noPath": "尚未指定文件",
				"state.noPathHint": "在上方输入 .canvas.tsx 的路径后回车，即可在此渲染为 HTML 页面。",
				"state.loading": "正在读取…",
				"state.error": "读取失败",
				"state.parseFailed": "解析失败",
				"error.outsideWorkspace": "该绝对路径不在当前会话工作区内，已拒绝读取。请改用相对工作区的路径。",
				"viewer.title": "Canvas 报告"
			},
			en: {
				"tab.title": "Canvas Report",
				"tab.desc": "Render a .canvas.tsx report as an HTML page",
				"input.placeholder": ".canvas.tsx path, e.g. try/report.canvas.tsx",
				"action.open": "Open",
				"mode.label": "Display mode",
				"mode.preview": "Preview",
				"mode.code": "Code",
				"state.noPath": "No file given",
				"state.noPathHint": "Type the path to a .canvas.tsx above and press Enter to render it here as an HTML page.",
				"state.loading": "Reading…",
				"state.error": "Read failed",
				"state.parseFailed": "Parse failed",
				"error.outsideWorkspace": "That absolute path is outside the session workspace, so it was refused. Use a workspace-relative path.",
				"viewer.title": "Canvas Report"
			}
		};
		//#endregion
		//#region src/client/index.tsx
		/**
		* Browser half: registers a Canvas report viewer and tab with better-sidebar.
		*
		* We register two entry points:
		*
		* 1. **File viewer** (`exts: ['tsx']`, priority 50): claims every `.tsx` the
		*    user opens. For `.canvas.tsx` it renders a live document with a
		*    code/preview toggle; for other `.tsx` it shows a monospace source view
		*    (a faithful fallback — the source is always available). The user can
		*    disable the viewer in the Side card settings, which restores the
		*    built-in code viewer.
		*
		* 2. **Tab** (`order: 60`, `single: true`): a manual-preview surface with a
		*    path input, useful for inspecting a canvas without opening it in the
		*    editor.
		*
		* Registration contract (docs/external-plugin-guide.md §3/§4):
		* - `inject` declares the services we need; Cordis activates us only once
		*   `betterSidebar` is published, so registration order is irrelevant.
		* - Every `register*` call rides `ctx.effect(fn, label)` so the returned
		*   disposer is revoked on fiber teardown (HMR / disable).
		* - We are a SOFT dependency: when better-sidebar is not installed the
		*   registration is skipped silently and the rest of the plugin is inert.
		*/
		/** Tab type id. Package-prefixed so it cannot collide with a built-in type. */
		const TAB_ID = "dsh-canvas-tsx:report";
		/** Services required before `apply` runs. */
		const inject = ["betterSidebar", "locale"];
		/** Narrow `ctx.locale` without asserting the whole context. */
		function localeOf(ctx) {
			const locale = ctx.locale;
			if (locale === void 0) return void 0;
			if (typeof locale.register !== "function" || typeof locale.bind !== "function") return void 0;
			return locale;
		}
		/**
		* Browser-face apply.
		* @param ctx - the client root context.
		*/
		function apply(ctx) {
			const locale = localeOf(ctx);
			if (locale !== void 0) for (const [tag, dict] of Object.entries(dictionaries)) ctx.effect(() => locale.register(NS, tag, dict), `dsh-canvas-tsx-sidebar: dictionary ${tag}`);
			/** Translate one of our keys; unknown namespaces/keys fall back to the key. */
			const t = (key) => {
				if (locale === void 0) return key;
				try {
					return locale.bind("dsh-canvas-tsx-sidebar")(key) || key;
				} catch {
					return key;
				}
			};
			const bar = ctx.betterSidebar;
			if (bar === void 0) return;
			ctx.effect(() => bar.registerTab({
				id: TAB_ID,
				title: () => t("tab.title"),
				description: () => t("tab.desc"),
				icon: (size) => CanvasIcon(size),
				order: 60,
				single: true,
				component: (props) => (0, react.createElement)(CanvasReportTab, {
					t,
					scope: props.scope,
					tab: props.tab,
					service: bar,
					visible: props.visible
				})
			}), "dsh-canvas-tsx-sidebar: tab");
			ctx.effect(() => bar.registerFileViewer({
				id: VIEWER_ID,
				title: () => t("viewer.title"),
				icon: (size) => CanvasIcon(size),
				exts: ["tsx"],
				priority: 50,
				fetchStrategy: "fsRead",
				component: (props) => (0, react.createElement)(CanvasFileViewer, {
					scope: props.scope,
					path: props.path,
					title: props.title
				})
			}), "dsh-canvas-tsx-sidebar: viewer");
		}
		//#endregion
		exports.TAB_ID = TAB_ID;
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map