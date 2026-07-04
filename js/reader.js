/* js/reader.js
 * A small self-contained EPUB reader. Parses the .epub (a zip file) directly
 * with JSZip -- no epub.js dependency -- and renders every spine chapter as
 * one continuous scrollable flow inside #viewer.
 */
(function () {
    "use strict";

    var qs = new URLSearchParams(location.search);
    var FILE = qs.get("file");
    var TITLE_HINT = qs.get("title");
    var BOOK_ID = FILE || "unknown-book";

    var els = {}; // filled in on init()
    var state = {
        zip: null,
        opfDir: "",
        manifest: {},      // id -> {href, mediaType, fullPath}
        spine: [],         // array of manifest ids, in reading order
        chapters: [],       // [{id, fullPath, index, el}]
        toc: [],            // flat list [{label, fullPath, fragment, depth}]
        blobUrls: {},       // fullPath -> object URL (images etc.)
        totalWords: 0,
        chapterWordOffsets: [], // cumulative words before each chapter
        bookmarks: [],
        fontFamily: "Georgia, serif",
        fontSize: 18,
        lineHeight: 1.7,
        tocMapByPath: {},   // fullPath -> best-matching toc label (for status bar)
        rafPending: false,
        suppressResumeToast: false
    };

    function $(id) { return document.getElementById(id); }

    function resolvePath(baseDir, href) {
        href = href.split("#")[0];
        if (!baseDir) return normalizePath(href);
        return normalizePath(baseDir.replace(/\/?$/, "/") + href);
    }

    function normalizePath(path) {
        var parts = path.split("/");
        var out = [];
        for (var i = 0; i < parts.length; i++) {
            var p = parts[i];
            if (p === "." || p === "") continue;
            if (p === "..") { out.pop(); continue; }
            out.push(p);
        }
        return out.join("/");
    }

    function dirname(path) {
        var idx = path.lastIndexOf("/");
        return idx === -1 ? "" : path.substring(0, idx);
    }

    function parseXML(text) {
        return new DOMParser().parseFromString(text, "application/xml");
    }

    // ---- Loading & parsing the epub -----------------------------------

    function loadBook() {
        if (!FILE) {
            showFatal("No book was specified.");
            return;
        }
        fetch(FILE)
            .then(function (res) {
                if (!res.ok) throw new Error("Could not fetch the book file (HTTP " + res.status + ").");
                return res.arrayBuffer();
            })
            .then(function (buf) { return JSZip.loadAsync(buf); })
            .then(function (zip) {
                state.zip = zip;
                return zip.file("META-INF/container.xml").async("string");
            })
            .then(function (containerXml) {
                var doc = parseXML(containerXml);
                var rootfile = doc.getElementsByTagName("rootfile")[0];
                var opfPath = rootfile.getAttribute("full-path");
                state.opfDir = dirname(opfPath);
                return state.zip.file(opfPath).async("string");
            })
            .then(function (opfXml) { return parseOPF(opfXml); })
            .then(function () { return collectImages(); })
            .then(function () { return collectBookStyles(); })
            .then(function () { return renderChapters(); })
            .then(function () {
                buildTOCPanel();
                finishLoad();
            })
            .catch(function (err) {
                console.error(err);
                showFatal("This book could not be opened. (" + err.message + ")");
            });
    }

    function parseOPF(opfXml) {
        var doc = parseXML(opfXml);
        var manifestItems = doc.getElementsByTagName("item");
        for (var i = 0; i < manifestItems.length; i++) {
            var it = manifestItems[i];
            var id = it.getAttribute("id");
            var href = it.getAttribute("href");
            var mediaType = it.getAttribute("media-type") || "";
            var properties = it.getAttribute("properties") || "";
            state.manifest[id] = {
                href: href,
                mediaType: mediaType,
                properties: properties,
                fullPath: resolvePath(state.opfDir, href)
            };
        }

        var spineEl = doc.getElementsByTagName("spine")[0];
        var itemrefs = spineEl.getElementsByTagName("itemref");
        for (var j = 0; j < itemrefs.length; j++) {
            state.spine.push(itemrefs[j].getAttribute("idref"));
        }

        // Book title, if the OPF happens to carry one (may be blank/wiped).
        var titleEl = doc.getElementsByTagName("dc:title")[0] ||
                      doc.getElementsByTagNameNS("http://purl.org/dc/elements/1.1/", "title")[0];
        var opfTitle = titleEl && titleEl.textContent.trim();

        var displayTitle = TITLE_HINT || opfTitle || prettifyBaseName(FILE);
        els.titleDisplay.textContent = displayTitle;
        document.title = displayTitle;

        // Find the NCX (EPUB2) or nav document (EPUB3) for the table of contents.
        var ncxId = spineEl.getAttribute("toc");
        var ncxItem = ncxId ? state.manifest[ncxId] : null;
        if (!ncxItem) {
            for (var key in state.manifest) {
                if (state.manifest[key].mediaType === "application/x-dtbncx+xml") { ncxItem = state.manifest[key]; break; }
            }
        }
        var navItem = null;
        for (var key2 in state.manifest) {
            if ((state.manifest[key2].properties || "").indexOf("nav") !== -1) { navItem = state.manifest[key2]; break; }
        }

        var tocPromise;
        if (navItem) {
            tocPromise = state.zip.file(navItem.fullPath).async("string").then(function (html) {
                parseNavTOC(html, dirname(navItem.fullPath));
            });
        } else if (ncxItem) {
            tocPromise = state.zip.file(ncxItem.fullPath).async("string").then(function (xml) {
                parseNCXTOC(xml);
            });
        } else {
            tocPromise = Promise.resolve();
        }

        return tocPromise.then(function () {
            if (state.toc.length === 0) buildFallbackTOC();
        });
    }

    function prettifyBaseName(path) {
        var name = (path || "").split("/").pop().replace(/\.[^.]+$/, "");
        return name.replace(/[-_]+/g, " ").replace(/\b\w/g, function (c) { return c.toUpperCase(); });
    }

    function parseNCXTOC(ncxXml) {
        var doc = parseXML(ncxXml);
        var navMap = doc.getElementsByTagName("navMap")[0];
        if (!navMap) return;
        walkNavPoints(navMap, 0);
    }

    function walkNavPoints(parentEl, depth) {
        var children = parentEl.childNodes;
        for (var i = 0; i < children.length; i++) {
            var node = children[i];
            if (node.nodeType !== 1 || node.tagName !== "navPoint") continue;
            var labelEl = node.getElementsByTagName("text")[0];
            var contentEl = node.getElementsByTagName("content")[0];
            var label = labelEl ? labelEl.textContent.trim() : "Untitled";
            var src = contentEl ? contentEl.getAttribute("src") : null;
            if (src) {
                var parts = src.split("#");
                state.toc.push({
                    label: label,
                    fullPath: resolvePath(state.opfDir, parts[0]),
                    fragment: parts[1] || null,
                    depth: depth
                });
            }
            walkNavPoints(node, depth + 1);
        }
    }

    function parseNavTOC(navHtml, navDir) {
        var doc = new DOMParser().parseFromString(navHtml, "text/html");
        var navEl = null;
        var navs = doc.querySelectorAll("nav");
        for (var i = 0; i < navs.length; i++) {
            var type = navs[i].getAttribute("epub:type") || navs[i].getAttributeNS("http://www.idpf.org/2007/ops", "type");
            if (type === "toc" || navs[i].id === "toc") { navEl = navs[i]; break; }
        }
        if (!navEl && navs.length) navEl = navs[0];
        if (!navEl) return;

        function walk(listEl, depth) {
            var items = listEl.querySelectorAll(":scope > li");
            items.forEach(function (li) {
                var a = li.querySelector(":scope > a, :scope > span");
                if (a) {
                    var href = a.getAttribute("href") || "";
                    var parts = href.split("#");
                    state.toc.push({
                        label: a.textContent.trim(),
                        fullPath: parts[0] ? resolvePath(navDir, parts[0]) : null,
                        fragment: parts[1] || null,
                        depth: depth
                    });
                }
                var subList = li.querySelector(":scope > ol");
                if (subList) walk(subList, depth + 1);
            });
        }
        var topList = navEl.querySelector("ol");
        if (topList) walk(topList, 0);
    }

    function buildFallbackTOC() {
        state.spine.forEach(function (id, i) {
            var item = state.manifest[id];
            if (!item) return;
            state.toc.push({ label: "Chapter " + (i + 1), fullPath: item.fullPath, fragment: null, depth: 0 });
        });
    }

    // ---- Images & embedded CSS -----------------------------------------

    function collectImages() {
        var jobs = [];
        for (var id in state.manifest) {
            var item = state.manifest[id];
            if (item.mediaType.indexOf("image/") === 0) {
                (function (item) {
                    jobs.push(
                        state.zip.file(item.fullPath).async("base64").then(function (b64) {
                            state.blobUrls[item.fullPath] = "data:" + item.mediaType + ";base64," + b64;
                        }).catch(function () {})
                    );
                })(item);
            }
        }
        return Promise.all(jobs);
    }

    function collectBookStyles() {
        var cssPaths = {};
        for (var id in state.manifest) {
            var item = state.manifest[id];
            if (item.mediaType === "text/css") cssPaths[item.fullPath] = true;
        }
        var jobs = Object.keys(cssPaths).map(function (path) {
            return state.zip.file(path).async("string").then(function (css) {
                return scopeCSS(css);
            }).catch(function () { return ""; });
        });
        return Promise.all(jobs).then(function (chunks) {
            var styleEl = document.createElement("style");
            styleEl.id = "book-styles";
            styleEl.textContent = chunks.join("\n");
            document.head.appendChild(styleEl);
        });
    }

    // Very small scoper: prefixes each rule's selector list with "#viewer
    // .book-content " and strips explicit color declarations so the theme's
    // palette always wins. Good enough for the simple, class-based CSS that
    // ebook conversion tools produce; skips @-rules like @page/@font-face
    // bodies we can't safely rewrite this way (keeps @font-face as-is).
    function scopeCSS(css) {
        css = css.replace(/@page[^{]*\{[^}]*\}/g, "");
        css = css.replace(/color\s*:\s*[^;}]+;?/gi, "");
        var out = "";
        var rest = css;
        var ruleRe = /([^{}@]+)\{([^{}]*)\}/g;
        var m;
        while ((m = ruleRe.exec(css)) !== null) {
            var selectors = m[1].split(",").map(function (s) {
                s = s.trim();
                if (!s) return null;
                return "#viewer .book-content " + s;
            }).filter(Boolean).join(", ");
            out += selectors + " {" + m[2] + "}\n";
        }
        return out;
    }

    // ---- Rendering chapters ---------------------------------------------

    function renderChapters() {
        var wrap = document.createElement("div");
        wrap.className = "book-content";

        var jobs = state.spine.map(function (idref, index) {
            var item = state.manifest[idref];
            if (!item) return Promise.resolve(null);
            return state.zip.file(item.fullPath).async("string").then(function (html) {
                return { index: index, item: item, html: html };
            });
        });

        return Promise.all(jobs).then(function (results) {
            results.forEach(function (res) {
                if (!res) return;
                var bodyHtml = extractBody(res.html);
                bodyHtml = rewriteAssetRefs(bodyHtml, dirname(res.item.fullPath));

                var section = document.createElement("section");
                section.className = "chapter";
                section.id = "chapter-" + res.index;
                section.setAttribute("data-path", res.item.fullPath);
                section.innerHTML = bodyHtml;
                wrap.appendChild(section);

                state.chapters.push({
                    index: res.index,
                    fullPath: res.item.fullPath,
                    el: section,
                    wordCount: countWords(section.textContent)
                });
            });

            els.viewer.appendChild(wrap);
            els.bookContent = wrap;

            var cumulative = 0;
            state.chapters.forEach(function (ch) {
                state.chapterWordOffsets.push(cumulative);
                cumulative += ch.wordCount;
            });
            state.totalWords = cumulative;
        });
    }

    function extractBody(html) {
        var doc = new DOMParser().parseFromString(html, "application/xhtml+xml");
        if (doc.getElementsByTagName("parsererror").length) {
            doc = new DOMParser().parseFromString(html, "text/html");
        }
        var body = doc.getElementsByTagName("body")[0];
        return body ? body.innerHTML : html;
    }

    function rewriteAssetRefs(html, baseDir) {
        var container = document.createElement("div");
        container.innerHTML = html;
        container.querySelectorAll("img, image").forEach(function (img) {
            var attr = img.hasAttribute("src") ? "src" : (img.hasAttribute("xlink:href") ? "xlink:href" : null);
            if (!attr) return;
            var href = img.getAttribute(attr);
            if (!href || /^(https?:|data:)/.test(href)) return;
            var full = resolvePath(baseDir, href);
            if (state.blobUrls[full]) img.setAttribute(attr, state.blobUrls[full]);
        });
        // Internal chapter-to-chapter links: leave anchors mostly inert (no
        // multi-file navigation target outside our single-page flow), but
        // keep the fragment so in-page anchors still work.
        container.querySelectorAll("a[href]").forEach(function (a) {
            var href = a.getAttribute("href");
            if (/^https?:/.test(href)) { a.setAttribute("target", "_blank"); a.setAttribute("rel", "noopener"); return; }
            var parts = href.split("#");
            if (parts[1]) a.setAttribute("href", "#" + parts[1]);
            else a.removeAttribute("href");
        });
        return container.innerHTML;
    }

    function countWords(text) {
        var m = text.trim().match(/\S+/g);
        return m ? m.length : 0;
    }

    // ---- Table of contents panel ----------------------------------------

    function buildTOCPanel() {
        var list = els.tocList;
        list.innerHTML = "";
        if (state.toc.length === 0) {
            list.innerHTML = '<div id="toc-empty">No table of contents available.</div>';
            return;
        }
        state.toc.forEach(function (entry, i) {
            var a = document.createElement("a");
            a.className = "toc-item" + (entry.depth > 0 ? " d" + Math.min(entry.depth, 2) : "");
            a.textContent = entry.label;
            a.href = "#";
            a.dataset.tocIndex = i;
            a.addEventListener("click", function (e) {
                e.preventDefault();
                jumpToTOC(entry);
                if (window.matchMedia("(max-width: 640px)").matches) {
                    els.tocPanel.classList.add("hidden");
                }
            });
            list.appendChild(a);

            // Remember the nearest TOC label per chapter path for the status bar.
            if (entry.fullPath && !state.tocMapByPath[entry.fullPath]) {
                state.tocMapByPath[entry.fullPath] = entry.label;
            }
        });
    }

    function jumpToTOC(entry) {
        var chapter = state.chapters.find(function (c) { return c.fullPath === entry.fullPath; });
        if (!chapter) return;
        var target = chapter.el;
        if (entry.fragment) {
            var frag = chapter.el.querySelector("#" + CSS.escape(entry.fragment)) ||
                       chapter.el.querySelector("[name='" + entry.fragment + "']");
            if (frag) target = frag;
        }
        target.scrollIntoView({ block: "start" });
    }

    // ---- Scroll/status/progress -----------------------------------------

    function currentChapterIndex() {
        var scrollTop = els.viewer.scrollTop;
        var best = 0;
        for (var i = 0; i < state.chapters.length; i++) {
            if (state.chapters[i].el.offsetTop <= scrollTop + 40) best = i;
            else break;
        }
        return best;
    }

    function onScroll() {
        if (state.rafPending) return;
        state.rafPending = true;
        requestAnimationFrame(function () {
            state.rafPending = false;
            updateStatus();
        });
    }

    function updateStatus() {
        var viewer = els.viewer;
        var scrollTop = viewer.scrollTop;
        var maxScroll = Math.max(1, viewer.scrollHeight - viewer.clientHeight);
        var fraction = Math.min(1, Math.max(0, scrollTop / maxScroll));
        var pct = Math.round(fraction * 100);

        els.progBar.style.width = pct + "%";
        els.stPct.textContent = pct + "%";

        var idx = currentChapterIndex();
        els.stCh.textContent = (idx + 1) + " / " + state.chapters.length;

        var chapter = state.chapters[idx];
        var sectionLabel = (chapter && state.tocMapByPath[chapter.fullPath]) || "—";
        els.stSec.textContent = sectionLabel;

        var wordsRead = state.chapterWordOffsets[idx] || 0;
        var wordsRemaining = Math.max(0, state.totalWords - wordsRead - fraction * (chapter ? chapter.wordCount : 0));
        var minsLeft = Math.max(0, Math.round(wordsRemaining / 200));
        els.stTime.textContent = (state.totalWords ? minsLeft : "—") + " min left";

        highlightActiveTOC(chapter);
        saveReadingPosition(fraction);
    }

    function highlightActiveTOC(chapter) {
        if (!chapter) return;
        var items = els.tocList.querySelectorAll(".toc-item");
        items.forEach(function (a) {
            var entry = state.toc[a.dataset.tocIndex];
            a.classList.toggle("active", entry && entry.fullPath === chapter.fullPath);
        });
    }

    // ---- Persistence: position, bookmarks, font --------------------------

    function posKey() { return "reader_pos_" + BOOK_ID; }
    function bmKey() { return "reader_bookmarks_" + BOOK_ID; }

    function saveReadingPosition(fraction) {
        try { localStorage.setItem(posKey(), JSON.stringify({ fraction: fraction, ts: Date.now() })); } catch (e) {}
    }

    function loadReadingPosition() {
        try {
            var raw = localStorage.getItem(posKey());
            return raw ? JSON.parse(raw) : null;
        } catch (e) { return null; }
    }

    function scrollToFraction(fraction) {
        var maxScroll = Math.max(1, els.viewer.scrollHeight - els.viewer.clientHeight);
        els.viewer.scrollTop = fraction * maxScroll;
    }

    function loadBookmarks() {
        try {
            var raw = localStorage.getItem(bmKey());
            state.bookmarks = raw ? JSON.parse(raw) : [];
        } catch (e) { state.bookmarks = []; }
    }

    function saveBookmarks() {
        try { localStorage.setItem(bmKey(), JSON.stringify(state.bookmarks)); } catch (e) {}
    }

    function renderBookmarks() {
        var list = els.bmList;
        list.innerHTML = "";
        if (state.bookmarks.length === 0) {
            list.innerHTML = '<div id="bm-empty">No bookmarks yet. Press "Add" to save your position.</div>';
            return;
        }
        state.bookmarks.slice().reverse().forEach(function (bm) {
            var item = document.createElement("div");
            item.className = "bm-item";
            var d = new Date(bm.ts);
            item.innerHTML =
                '<div><div class="bm-text">' + escapeHtml(d.toLocaleString()) + '</div>' +
                '<div class="bm-chapter">' + escapeHtml(bm.chapterTitle || "") + '</div></div>' +
                '<button class="bm-del" title="Delete">✕</button>';
            item.addEventListener("click", function (e) {
                if (e.target.classList.contains("bm-del")) return;
                scrollToFraction(bm.fraction);
                toggleBM();
            });
            item.querySelector(".bm-del").addEventListener("click", function (e) {
                e.stopPropagation();
                state.bookmarks = state.bookmarks.filter(function (b) { return b.id !== bm.id; });
                saveBookmarks();
                renderBookmarks();
            });
            list.appendChild(item);
        });
    }

    function escapeHtml(s) {
        return (s || "").replace(/[&<>"']/g, function (c) {
            return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
        });
    }

    window.addBookmark = function () {
        var maxScroll = Math.max(1, els.viewer.scrollHeight - els.viewer.clientHeight);
        var fraction = els.viewer.scrollTop / maxScroll;
        var idx = currentChapterIndex();
        var chapter = state.chapters[idx];
        state.bookmarks.push({
            id: "bm" + Date.now(),
            fraction: fraction,
            chapterTitle: (chapter && state.tocMapByPath[chapter.fullPath]) || ("Chapter " + (idx + 1)),
            ts: Date.now()
        });
        saveBookmarks();
        renderBookmarks();
        flashButton(els.btnBmAdd);
    };

    function flashButton(btn) {
        btn.classList.add("on");
        setTimeout(function () { btn.classList.remove("on"); }, 300);
    }

    // ---- Font panel --------------------------------------------------------

    function fontKey() { return "reader_font_prefs"; }

    function loadFontPrefs() {
        try {
            var raw = localStorage.getItem(fontKey());
            if (raw) {
                var prefs = JSON.parse(raw);
                state.fontFamily = prefs.family || state.fontFamily;
                state.fontSize = prefs.size || state.fontSize;
                state.lineHeight = prefs.lh || state.lineHeight;
            }
        } catch (e) {}
    }

    function saveFontPrefs() {
        try {
            localStorage.setItem(fontKey(), JSON.stringify({
                family: state.fontFamily, size: state.fontSize, lh: state.lineHeight
            }));
        } catch (e) {}
    }

    window.applyFont = function () {
        state.fontFamily = els.selFont.value;
        state.fontSize = parseInt(els.selSize.value, 10);
        state.lineHeight = parseInt(els.selLh.value, 10) / 10;

        els.valSize.textContent = state.fontSize + "px";
        els.valLh.textContent = state.lineHeight.toFixed(1);

        if (els.bookContent) {
            els.bookContent.style.fontFamily = state.fontFamily;
            els.bookContent.style.fontSize = state.fontSize + "px";
            els.bookContent.style.lineHeight = state.lineHeight;
        }
        saveFontPrefs();
    };

    function applyFontToUI() {
        els.selFont.value = state.fontFamily;
        els.selSize.value = state.fontSize;
        els.selLh.value = Math.round(state.lineHeight * 10);
        window.applyFont();
    }

    // ---- Panels & toolbar actions -------------------------------------------

    window.toggleTOC = function () {
        els.tocPanel.classList.toggle("hidden");
    };

    window.toggleTheme = function () {
        var opening = !els.themePanel.classList.contains("open");
        closeAllPanels();
        if (opening) { els.themePanel.classList.add("open"); els.overlay.classList.add("open"); }
    };

    window.toggleFont = function () {
        var opening = !els.fontPanel.classList.contains("open");
        closeAllPanels();
        if (opening) { els.fontPanel.classList.add("open"); els.overlay.classList.add("open"); }
    };

    window.toggleBM = function () {
        var opening = !els.bmPanel.classList.contains("open");
        closeAllPanels();
        if (opening) { renderBookmarks(); els.bmPanel.classList.add("open"); els.overlay.classList.add("open"); }
    };

    window.closeAllPanels = function () {
        els.themePanel.classList.remove("open");
        els.fontPanel.classList.remove("open");
        els.bmPanel.classList.remove("open");
        els.overlay.classList.remove("open");
    };

    window.toggleFS = function () {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(function () {});
        } else {
            document.exitFullscreen().catch(function () {});
        }
    };

    window.go = function (dir) {
        var idx = currentChapterIndex();
        var next = idx + dir;
        if (next < 0 || next >= state.chapters.length) return;
        state.chapters[next].el.scrollIntoView({ block: "start" });
    };

    window.resumeReading = function () {
        var pos = loadReadingPosition();
        if (pos) scrollToFraction(pos.fraction);
        dismissToast();
    };

    window.dismissToast = function () {
        els.resumeToast.classList.remove("show");
    };

    // ---- Boot --------------------------------------------------------------

    function cacheEls() {
        els.toolbar = $("toolbar");
        els.titleDisplay = $("title-display");
        els.progBar = $("prog-bar");
        els.overlay = $("overlay");
        els.themePanel = $("theme-panel");
        els.fontPanel = $("font-panel");
        els.bmPanel = $("bm-panel");
        els.bmList = $("bm-list");
        els.btnBmAdd = $("btn-bm-add");
        els.tocPanel = $("toc-panel");
        els.tocList = $("toc-list");
        els.viewer = $("viewer");
        els.loading = $("loading");
        els.stCh = $("st-ch");
        els.stSec = $("st-sec");
        els.stPct = $("st-pct");
        els.stTime = $("st-time");
        els.resumeToast = $("resume-toast");
        els.selFont = $("sel-font");
        els.selSize = $("sel-size");
        els.selLh = $("sel-lh");
        els.valSize = $("val-size");
        els.valLh = $("val-lh");
    }

    function showFatal(message) {
        els.loading.innerHTML = '<span style="max-width:280px;text-align:center;opacity:.8;">' + escapeHtml(message) + '</span>';
        els.loading.classList.remove("gone");
    }

    function finishLoad() {
        els.loading.classList.add("gone");
        loadFontPrefs();
        applyFontToUI();
        loadBookmarks();

        els.viewer.addEventListener("scroll", onScroll, { passive: true });
        document.addEventListener("keydown", function (e) {
            if (e.key === "ArrowRight") window.go(1);
            else if (e.key === "ArrowLeft") window.go(-1);
            else if (e.key === "Escape") window.closeAllPanels();
        });

        updateStatus();

        var pos = loadReadingPosition();
        if (pos && pos.fraction > 0.01) {
            els.resumeToast.classList.add("show");
        }
    }

    function init() {
        cacheEls();
        loadBook();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
