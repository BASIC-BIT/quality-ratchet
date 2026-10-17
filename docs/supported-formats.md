# Supported duplication formats

The shared checker accepts 132 formats with explicit file routes. Native jscpd 5.0.12 accepts 224 grammar names, but many have no default extension or filename route. Configuration rejects unreachable names instead of silently selecting no source. The separate native inventory remains available for embedded-language identities and version checks.

The table preserves all 130 effective native extension formats. It includes 209 extensions, counting the added MDX route, plus Dockerfile, Makefile and GNUmakefile. Native jscpd itself has no default filename-only mappings. The shared scanner passes explicit extension and filename mappings through a tool-owned configuration. Native precedence assigns .vb to visual-basic, so vbnet cannot independently select a standalone file.

Files without a recognized route can still match native first-line shebang rules. Interpreter text selects python, javascript, ruby, bash, perl or php, in that order. A recognized extension or filename takes precedence. Matching is case-sensitive, including native .R. Shebang selection affects duplication only. Complexity and file size retain their eight JS/TS extensions.

## What the native tests prove

The native fixture test creates a separate copied pair for every extension and filename below and verifies a clone for each pair. Container fixtures use embedded code. All six shebang routes pass through real Git comparison and isolated snapshots. These are lexical detection tests, not language compiler or binary-document validation. In particular, excel-formula means scanning text with .xls/.xlsx suffixes. It does not decode a binary spreadsheet.

Markdown, MDX, Astro, Svelte and Vue can report clones under an embedded language name. Configuration selects container files and retains their embedded detections. Native grammar names without standalone routes remain available inside eligible containers. Pure normalization tests are separate from native detection tests.

## Known limits

- Prose-only Markdown is omitted by pinned jscpd 5.0.12. Its finder calculates prose tokens, then discards the file when the legacy display tokenizer has fewer than the configured minimum tokens. That tokenizer counts fenced content only. Prose is detectable in a document with enough fenced code. The report records `markdown-prose-requires-fenced-tokens` whenever Markdown is enabled. Eligible-file counts describe policy selection, not proof that every selected file contributed native tokens. This existing behavior is retained for v1 and deferred for an engine correction.
- Table layout alone is removed from findings. Prose and literal code remain eligible, subject to the Markdown limit above.
- The pinned normalization tokenizer lacks Razor, excel-formula and native fallback text grammars. Unlabeled fences use that text fallback. Their identities retain exact raw span content. Unchanged copies and both-endpoint rewrites are tested. Comment or whitespace edits can conservatively produce findings, and shortened raw spans need not match prior identities.
- Native source suppression markers are unsupported. A region the pinned JS/TS comment matcher would suppress causes an operational error. Its matcher recognizes comment-shaped text inside strings. Unpaired JS/TS markers do not suppress a region. Generic tokenizers suppress unpaired starts and drop orphan-end lines, so those inputs fail too. Markdown checks outer markers and fenced languages. Other container grammars reject marker text conservatively because they can delegate to generic tokenizers. Diagnostics contain paths, never source. The checker never rewrites source to bypass the engine.
- Execution has been checked on Windows with Node 24.18.0. Linux and the declared minimum Node version remain release-qualification work.

## Routes

| Configured format | Extensions                                       | Exact filenames       |
| ----------------- | ------------------------------------------------ | --------------------- |
| actionscript      | .as                                              | None                  |
| ada               | .ada                                             | None                  |
| antlr4            | .g4                                              | None                  |
| apex              | .cls, .trigger, .apex                            | None                  |
| apl               | .apl                                             | None                  |
| aspnet            | .asp, .aspx                                      | None                  |
| astro             | .astro                                           | None                  |
| awk               | .awk                                             | None                  |
| bash              | .sh, .ksh, .bash                                 | None                  |
| basic             | .bas                                             | None                  |
| bicep             | .bicep                                           | None                  |
| brainfuck         | .b, .bf                                          | None                  |
| c                 | .c, .z80                                         | None                  |
| c-header          | .h                                               | None                  |
| cfml              | .cfm                                             | None                  |
| cfscript          | .cfc                                             | None                  |
| clojure           | .cljs, .clj, .cljc, .cljx, .edn                  | None                  |
| cmake             | .cmake                                           | None                  |
| coffeescript      | .coffee                                          | None                  |
| cpp               | .cpp, .c++, .cc, .cxx                            | None                  |
| cpp-header        | .hpp, .h++, .hh, .hxx                            | None                  |
| crystal           | .cr                                              | None                  |
| csharp            | .cs                                              | None                  |
| css               | .css, .gss                                       | None                  |
| csv               | .csv                                             | None                  |
| d                 | .d                                               | None                  |
| dart              | .dart                                            | None                  |
| diff              | .diff, .patch                                    | None                  |
| docker            | None                                             | Dockerfile            |
| dot               | .dot, .gv                                        | None                  |
| eiffel            | .e                                               | None                  |
| elm               | .elm                                             | None                  |
| erlang            | .erl, .erlang                                    | None                  |
| excel-formula     | .xlsx, .xls                                      | None                  |
| fortran           | .f, .for, .f77, .f90                             | None                  |
| fsharp            | .fs                                              | None                  |
| gdscript          | .gd                                              | None                  |
| gettext           | .po                                              | None                  |
| gherkin           | .feature                                         | None                  |
| go                | .go                                              | None                  |
| graphql           | .graphql                                         | None                  |
| groovy            | .groovy, .gradle                                 | None                  |
| haml              | .haml                                            | None                  |
| handlebars        | .hb, .hbs, .handlebars                           | None                  |
| haskell           | .hs, .lhs                                        | None                  |
| haxe              | .hx, .hxml                                       | None                  |
| hcl               | .tf, .hcl                                        | None                  |
| idris             | .idr                                             | None                  |
| ignore            | .gitignore                                       | None                  |
| ini               | .ini                                             | None                  |
| java              | .java                                            | None                  |
| javascript        | .js, .es, .es6, .mjs, .cjs                       | None                  |
| json              | .json, .map, .jsonld                             | None                  |
| json5             | .json5                                           | None                  |
| jsx               | .jsx                                             | None                  |
| julia             | .jl                                              | None                  |
| kotlin            | .kt, .kts                                        | None                  |
| latex             | .tex                                             | None                  |
| less              | .less                                            | None                  |
| lilypond          | .ly                                              | None                  |
| linker-script     | .ld                                              | None                  |
| lisp              | .cl, .lisp, .el                                  | None                  |
| livescript        | .ls                                              | None                  |
| llvm              | .ll                                              | None                  |
| log               | .log                                             | None                  |
| lua               | .lua                                             | None                  |
| makefile          | None                                             | Makefile, GNUmakefile |
| markdown          | .md, .markdown, .mkd, .mdx                       | None                  |
| markup            | .html, .htm, .xml, .xsl, .xslt, .svg, .ejs, .jsp | None                  |
| nsis              | .nsh, .nsi                                       | None                  |
| objectivec        | .m, .mm                                          | None                  |
| ocaml             | .ocaml, .ml, .mli, .mll, .mly                    | None                  |
| openqasm          | .qasm                                            | None                  |
| oz                | .oz                                              | None                  |
| pascal            | .pas, .p                                         | None                  |
| perl              | .pl, .pm                                         | None                  |
| php               | .php, .phtml                                     | None                  |
| plant-uml         | .puml, .plantuml                                 | None                  |
| plsql             | .plsql                                           | None                  |
| powerquery        | .pq                                              | None                  |
| powershell        | .ps1, .psd1, .psm1                               | None                  |
| prolog            | .pro                                             | None                  |
| properties        | .properties                                      | None                  |
| protobuf          | .proto                                           | None                  |
| pug               | .pug, .jade                                      | None                  |
| puppet            | .pp, .puppet                                     | None                  |
| purescript        | .purs                                            | None                  |
| python            | .py, .pyx, .pxd, .pxi                            | None                  |
| q                 | .q                                               | None                  |
| qsharp            | .qs                                              | None                  |
| r                 | .r, .R                                           | None                  |
| racket            | .rkt                                             | None                  |
| razor             | .cshtml, .razor                                  | None                  |
| rescript          | .res                                             | None                  |
| robotframework    | .robot                                           | None                  |
| ruby              | .rb                                              | None                  |
| rust              | .rs                                              | None                  |
| sas               | .sas                                             | None                  |
| sass              | .sass                                            | None                  |
| scala             | .scala                                           | None                  |
| scheme            | .scm, .ss                                        | None                  |
| scss              | .scss                                            | None                  |
| smalltalk         | .st                                              | None                  |
| smarty            | .smarty, .tpl                                    | None                  |
| solidity          | .sol                                             | None                  |
| soy               | .soy                                             | None                  |
| sparql            | .rq                                              | None                  |
| sql               | .sql, .cql                                       | None                  |
| stylus            | .styl, .stylus                                   | None                  |
| svelte            | .svelte                                          | None                  |
| swift             | .swift                                           | None                  |
| tap               | .tap                                             | None                  |
| tcl               | .tcl                                             | None                  |
| textile           | .textile                                         | None                  |
| toml              | .toml                                            | None                  |
| tsx               | .tsx                                             | None                  |
| tt2               | .tt2                                             | None                  |
| turtle            | .ttl                                             | None                  |
| twig              | .twig                                            | None                  |
| txt               | .txt                                             | None                  |
| typescript        | .ts, .mts, .cts                                  | None                  |
| unrealscript      | .uc                                              | None                  |
| vbnet             | .vb                                              | None                  |
| velocity          | .vtl                                             | None                  |
| verilog           | .v                                               | None                  |
| vhdl              | .vhd, .vhdl                                      | None                  |
| vue               | .vue                                             | None                  |
| wgsl              | .wgsl                                            | None                  |
| wolfram           | .wl, .nb                                         | None                  |
| xquery            | .xy, .xquery                                     | None                  |
| yaml              | .yaml, .yml                                      | None                  |
| zig               | .zig                                             | None                  |

## Source

The native inventory and extension precedence come from [formats.rs at the pinned release](https://github.com/kucherenko/jscpd/blob/64258a9af460fc554c1ad884f976787378721d90/rust/crates/cpd-tokenizer/src/formats.rs). Shebang and custom mapping precedence follow [walker.rs](https://github.com/kucherenko/jscpd/blob/64258a9af460fc554c1ad884f976787378721d90/rust/crates/cpd-finder/src/walker.rs). The Markdown omission appears in [orchestrate.rs](https://github.com/kucherenko/jscpd/blob/64258a9af460fc554c1ad884f976787378721d90/rust/crates/cpd-finder/src/orchestrate.rs) and [markdown.rs](https://github.com/kucherenko/jscpd/blob/64258a9af460fc554c1ad884f976787378721d90/rust/crates/cpd-tokenizer/src/markdown.rs). See [provenance](provenance.md) for extraction rights and notices.
