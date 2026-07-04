/* js/themes.js - shared theme list + persistence for index.html and reader.html */
(function () {
    var THEMES = [
        { value: "light",         label: "Light" },
        { value: "dark",          label: "Dark" },
        { value: "sepia",         label: "Sepia" },
        { value: "forest",        label: "Forest" },
        { value: "ocean",         label: "Ocean" },
        { value: "highcontrast",  label: "High Contrast" },
        { value: "vintage",       label: "Vintage" },
        { value: "monochrome",    label: "Monochrome" },
        { value: "dracula",       label: "Dracula" },
        { value: "solarizedlight",label: "Solarized Light" },
        { value: "solarizeddark", label: "Solarized Dark" },
        { value: "cyberpunk",     label: "Cyberpunk" }
    ];

    var STORAGE_KEY = "archive_theme";

    function getSavedTheme() {
        return localStorage.getItem(STORAGE_KEY) || "light";
    }

    function applyTheme(value) {
        if (value === "light") {
            document.documentElement.removeAttribute("data-theme");
        } else {
            document.documentElement.setAttribute("data-theme", value);
        }
        localStorage.setItem(STORAGE_KEY, value);
        // Keep every dropdown on the page in sync (index + reader panel, if both present)
        var selects = document.querySelectorAll(".theme-select-dropdown");
        for (var i = 0; i < selects.length; i++) {
            if (selects[i].value !== value) selects[i].value = value;
        }
        var evt = new CustomEvent("themechange", { detail: { theme: value } });
        document.dispatchEvent(evt);
    }

    function populateDropdowns() {
        var current = getSavedTheme();
        var selects = document.querySelectorAll(".theme-select-dropdown");
        selects.forEach(function (sel) {
            sel.innerHTML = "";
            THEMES.forEach(function (t) {
                var opt = document.createElement("option");
                opt.value = t.value;
                opt.textContent = t.label;
                sel.appendChild(opt);
            });
            sel.value = current;
            sel.addEventListener("change", function () {
                applyTheme(this.value);
            });
        });
    }

    // Apply saved theme as early as possible (this script is loaded with `defer`,
    // so DOM already exists by the time this runs, even though it runs before
    // window.load).
    applyTheme(getSavedTheme());

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", populateDropdowns);
    } else {
        populateDropdowns();
    }

    window.ArchiveThemes = { THEMES: THEMES, apply: applyTheme, get: getSavedTheme };
})();
