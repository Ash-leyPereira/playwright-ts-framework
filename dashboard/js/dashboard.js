// Apply saved theme before first paint to prevent flash
if (localStorage.getItem("qa-theme") === "dark") document.body.classList.add("dark")

let currentFilteredData = [];
let runAccordionCharts = [];

/* DROPDOWN */

document.querySelectorAll(".dropdown-btn").forEach(btn => {

    btn.onclick = (e) => {

        e.stopPropagation()

        const parent = btn.parentElement

        document.querySelectorAll(".dropdown").forEach(d => {
            if (d !== parent) d.classList.remove("open")
        })

        parent.classList.toggle("open")

    }

})

document.addEventListener("click", () => {
    document.querySelectorAll(".dropdown").forEach(d => d.classList.remove("open"))
})

function closeAllDropdowns() {
    document.querySelectorAll(".dropdown").forEach(d => d.classList.remove("open"))
}

/* CHARTS */

// Returns tick/label/grid colours based on current theme
function getChartTheme() {
    const dark = document.body.classList.contains("dark")
    return {
        text:    dark ? "#ffffff" : "#52576b",
        subtext: dark ? "#ffffff" : "#8c91a4",
        grid:    dark ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.05)"
    }
}

// Builds the shared responsive options with live theme colours
function chartOptions(extra = {}) {
    const t = getChartTheme()
    return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                labels: { color: t.text }
            }
        },
        scales: {
            x: {
                ticks:  { color: t.subtext },
                grid:   { color: t.grid },
                title:  { color: t.text }
            },
            y: {
                ticks:  { color: t.subtext },
                grid:   { color: t.grid },
                title:  { color: t.text }
            }
        },
        ...extra
    }
}

let trendChart = new Chart(document.getElementById("trendChart"), {
    type: "line",
    data: { labels: [], datasets: [{ label: "Tests", data: [], borderColor: "#4f6df5" }] },
    options: chartOptions()
})

let passChart = new Chart(document.getElementById("passChart"), {
    type: "line",
    data: { labels: [], datasets: [{ label: "Pass %", data: [], borderColor: "#2ecc71" }] },
    options: chartOptions()
})

let statusChart = new Chart(document.getElementById("statusChart"), {
    type: "doughnut",
    data: {
        labels: ["Passed", "Failed", "Flaky"],
        datasets: [{
            data: [0, 0, 0],
            backgroundColor: ["#2ecc71", "#e74c3c", "#f1c40f"],
            radius: "100%",
            hoverOffset: 4
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "40%",
        plugins: {
            legend: {
                position: "top",
                labels: {
                    color: getChartTheme().text,
                    boxWidth: 12,
                    padding: 20
                }
            }
        }
    }
})

let flakyChart = new Chart(document.getElementById("flakyChart"), {
    type: "line",
    data: { labels: [], datasets: [{ label: "Flaky", data: [], borderColor: "#f39c12" }] },
    options: chartOptions()
})

let qualityChart = new Chart(document.getElementById("qualityChart"), {
    type: "line",
    data: {
        labels: [],
        datasets: [
            {
                label: "Pass Rate %",
                data: [],
                borderColor: "#27ae60",
                backgroundColor: "rgba(39,174,96,0.2)",
                tension: 0.3
            },
            {
                label: "Stability %",
                data: [],
                borderColor: "#8e44ad",
                backgroundColor: "rgba(142,68,173,0.2)",
                tension: 0.3
            }
        ]
    },
    options: chartOptions({ plugins: { legend: { position: "top", labels: { color: getChartTheme().text } } } })
})

const heatmapCtx = document.getElementById("failureHeatmap").getContext("2d");

const failureHeatmap = new Chart(heatmapCtx, {
    type: "bar",
    data: {
        labels: [],
        datasets: [{
            label: "Failures",
            data: [],
            backgroundColor: "rgba(255, 99, 132, 0.7)"
        }]
    },
    options: chartOptions({
        plugins: {
            legend: { display: true, labels: { color: getChartTheme().text } },
            tooltip: { enabled: true }
        },
        scales: {
            x: {
                title: { display: true, text: "Test Name",     color: getChartTheme().text },
                ticks: { color: getChartTheme().subtext },
                grid:  { color: getChartTheme().grid }
            },
            y: {
                title: { display: true, text: "Failure Count", color: getChartTheme().text },
                ticks: { color: getChartTheme().subtext },
                grid:  { color: getChartTheme().grid },
                beginAtZero: true
            }
        }
    })
});

// Patches all live charts with the current theme colours (called on toggle)
/* ── CHART THEME PATCHER ────────────────────────────────────────────────────
   Uses chart.config.options (raw config object, bypasses Chart.js Proxy)
   so we never trip the _scriptable / recursion-detected errors.
   After all mutations, chart.update('none') repaints without animation.
   ─────────────────────────────────────────────────────────────────────── */
function patchChartsWithTheme(t) {

    function patchOne(chart) {
        // Access RAW config — not the live proxied chart.options
        const cfg = chart.config.options

        // Scales (line / bar charts)
        const sc = cfg.scales
        if (sc) {
            ;['x', 'y'].forEach(axis => {
                if (!sc[axis]) return
                if (!sc[axis].ticks)  sc[axis].ticks  = {}
                if (!sc[axis].grid)   sc[axis].grid   = {}
                if (!sc[axis].border) sc[axis].border = {}
                sc[axis].ticks.color  = t.subtext
                sc[axis].grid.color   = t.grid
                sc[axis].grid.lineWidth = t.lineWidth || 1
                sc[axis].border.color = t.border || t.grid
                if (sc[axis].title) sc[axis].title.color = t.text
            })
        }

        // Legend
        if (!cfg.plugins)               cfg.plugins = {}
        if (!cfg.plugins.legend)        cfg.plugins.legend = {}
        if (!cfg.plugins.legend.labels) cfg.plugins.legend.labels = {}
        cfg.plugins.legend.labels.color = t.text

        // Single no-animation repaint — safe because we mutated cfg, not options
        chart.update('none')
    }

    ;[trendChart, passChart, flakyChart, qualityChart, failureHeatmap, statusChart, ...runAccordionCharts]
        .forEach(patchOne)
}

function applyChartTheme() {
    const t = getChartTheme()
    patchChartsWithTheme(t)
}

let activeHistoryData = []
let importedHistoryData = []
let currentHistoryRange = "all"
const archiveCache = {}
const selectedRunTimestamp = new URLSearchParams(window.location.search).get("run")
let sidebarRunsSearchTerm = ""
const sidebarExpandedMonths = new Set()

async function fetchJsonArray(url) {

    try {
        const res = await fetch(url)
        if (!res.ok) return []

        const data = await res.json()
        return Array.isArray(data) ? data : []
    } catch (error) {
        return []
    }

}

function sortHistoryEntries(data) {
    return [...data].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
}

function filterEntriesByDays(data, days) {
    const now = Date.now()
    return data.filter(entry => now - new Date(entry.timestamp).getTime() < days * 86400000)
}

function encodeRunTimestamp(timestamp) {
    return encodeURIComponent(timestamp)
}

function getAllPersistedHistoryData() {
    return sortHistoryEntries([
        ...activeHistoryData,
        ...(archiveCache.last30 || []),
        ...(archiveCache.all || [])
    ])
}

async function ensureSidebarRunDataLoaded() {
    if (!archiveCache.last30) {
        archiveCache.last30 = await fetchJsonArray("./data/archives/last-30-days.json")
    }
    if (!archiveCache.all) {
        archiveCache.all = await fetchJsonArray("./data/archives/all.json")
    }
}

function updateSidebarSelection() {
    const overviewLink = document.getElementById("overviewNavLink")
    const runLinks = document.querySelectorAll(".sidebar-run-link")
    const runsList = document.getElementById("sidebarRunsList")
    const runsToggle = document.getElementById("sidebarRunsToggle")
    const searchWrap = document.getElementById("sidebarRunsSearchWrap")
    const monthGroups = document.querySelectorAll(".sidebar-run-group")

    if (overviewLink) {
        overviewLink.classList.toggle("active", !selectedRunTimestamp)
    }

    runLinks.forEach(link => {
        link.classList.toggle("active", link.dataset.runTimestamp === selectedRunTimestamp)
    })

    if (selectedRunTimestamp && runsList && runsToggle) {
        runsList.classList.add("open")
        runsToggle.classList.add("open")
        searchWrap?.classList.add("open")

        monthGroups.forEach(group => {
            if (group.querySelector(`.sidebar-run-link[data-run-timestamp="${selectedRunTimestamp}"]`)) {
                group.classList.add("open")
                if (group.dataset.monthKey) sidebarExpandedMonths.add(group.dataset.monthKey)
            }
        })

        const activeLink = runsList.querySelector(".sidebar-run-link.active")
        if (activeLink) {
            requestAnimationFrame(() => {
                activeLink.scrollIntoView({ block: "nearest" })
            })
        }
    }
}

function setAllSidebarMonthGroupsExpanded(expanded) {
    const monthGroups = document.querySelectorAll(".sidebar-run-group")

    monthGroups.forEach(group => {
        const monthKey = group.dataset.monthKey
        const toggle = group.querySelector(".sidebar-run-group-toggle")
        const caret = group.querySelector(".sidebar-run-group-caret")

        group.classList.toggle("open", expanded)
        if (toggle) {
            toggle.setAttribute("aria-expanded", expanded ? "true" : "false")
        }
        if (caret) {
            caret.textContent = expanded ? "-" : "+"
        }

        if (monthKey) {
            if (expanded) sidebarExpandedMonths.add(monthKey)
            else sidebarExpandedMonths.delete(monthKey)
        }
    })
}

function renderSidebarRunsMenu() {
    const list = document.getElementById("sidebarRunsList")
    if (!list) return

    const runs = [...getAllPersistedHistoryData()].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))

    if (!runs.length) {
        list.innerHTML = `<div class="run-empty">No runs available.</div>`
        return
    }

    list.innerHTML = runs.map((entry, index) => `
        <a class="sidebar-run-link" data-run-timestamp="${entry.timestamp}" href="index.html?run=${encodeRunTimestamp(entry.timestamp)}">
            <span class="sidebar-run-label">Run ${runs.length - index}</span>
            <span class="sidebar-run-meta">${new Date(entry.timestamp).toLocaleString()} • ${entry.total || 0} tests</span>
        </a>
    `).join("")

    updateSidebarSelection()
}

function initSidebar() {
    const body = document.body
    const sidebarToggle = document.getElementById("sidebarToggle")
    const sidebarClose = document.getElementById("sidebarClose")
    const sidebarBackdrop = document.getElementById("sidebarBackdrop")
    const runsToggle = document.getElementById("sidebarRunsToggle")
    const runsList = document.getElementById("sidebarRunsList")
    const runsCaret = document.getElementById("sidebarRunsCaret")

    const closeSidebar = () => body.classList.remove("sidebar-open")
    const openSidebar = () => body.classList.add("sidebar-open")

    sidebarToggle?.addEventListener("click", (e) => {
        e.stopPropagation()
        body.classList.toggle("sidebar-open")
    })

    sidebarClose?.addEventListener("click", closeSidebar)
    sidebarBackdrop?.addEventListener("click", closeSidebar)

    runsToggle?.addEventListener("click", () => {
        const isOpen = runsList?.classList.toggle("open")
        runsToggle.classList.toggle("open", !!isOpen)
        if (runsCaret) runsCaret.textContent = "+"
    })

    document.querySelectorAll(".sidebar-link, .sidebar-run-link").forEach(link => {
        link.addEventListener("click", closeSidebar)
    })
}

async function getHistoryDataForRange(range) {

    let combined = [...activeHistoryData, ...importedHistoryData]

    if (range === "30" || range === "all") {
        if (!archiveCache.last30) {
            archiveCache.last30 = await fetchJsonArray("./data/archives/last-30-days.json")
        }
        combined = combined.concat(archiveCache.last30)
    }

    if (range === "all") {
        if (!archiveCache.all) {
            archiveCache.all = await fetchJsonArray("./data/archives/all.json")
        }
        combined = combined.concat(archiveCache.all)
    }

    const sorted = sortHistoryEntries(combined)

    if (range === "today") {
        const today = new Date().toDateString()
        return sorted.filter(entry => new Date(entry.timestamp).toDateString() === today)
    }

    if (range === "7") {
        return filterEntriesByDays(sorted, 7)
    }

    if (range === "30") {
        return filterEntriesByDays(sorted, 30)
    }

    return sorted

}

async function loadDashboard() {

    activeHistoryData = await fetchJsonArray("./data/history.json")
    await ensureSidebarRunDataLoaded()
    renderSidebarRunsMenu()
    initSidebar()
    updateRunModeUI()

    if (selectedRunTimestamp) {
        const selectedRun = getAllPersistedHistoryData().find(entry => entry.timestamp === selectedRunTimestamp)

        if (selectedRun) {
            currentHistoryRange = "run"
            const historyLabel = document.getElementById("historyLabel")
            if (historyLabel) historyLabel.innerText = "Run Snapshot"
            updateRunModeUI()
            updateDashboard([selectedRun])
            return
        }
    }

    updateDashboard(await getHistoryDataForRange(currentHistoryRange))

}

// Populate Slowest Tests Table
let slowTestsData = [];
let filteredSlowTests = [];
let currentPage = 1;
const rowsPerPage = 10;
let currentSort = { column: "duration", direction: "desc" };

function populateSlowTests(data) {

    let allResults = [];

    data.forEach(entry => {

        if (entry.results) {
            allResults = allResults.concat(entry.results);
        }

    });

    if (allResults.length === 0) {

        slowTestsData = [];
        filteredSlowTests = [];
        currentPage = 1;

        document.getElementById("slowTests").innerHTML =
            `<tr><td colspan="4" style="text-align:center;color:#8c91a4;padding:20px">No test results for this time range</td></tr>`;
        document.getElementById("pageInfo").innerText = "Page 0 of 0";

        return;

    }

    slowTestsData = allResults.map(t => ({
        name: t.name || "-",
        status: t.status || "-",
        date: new Date(t.start),
        // FIX: ensure both values are parsed as numbers before subtracting
        duration: Number(t.stop) - Number(t.start)
    }));

    applyFilters();

}

function applyFilters() {

    const search = document.getElementById("slowTestSearch").value.toLowerCase();

    filteredSlowTests = slowTestsData.filter(t =>
        t.name.toLowerCase().includes(search)
    );

    sortData();

    currentPage = 1;

    renderTable();

}

function sortData() {

    filteredSlowTests.sort((a, b) => {

        let valA = a[currentSort.column];
        let valB = b[currentSort.column];

        if (currentSort.column === "date") {
            valA = valA.getTime();
            valB = valB.getTime();
        }

        if (currentSort.direction === "asc") {
            return valA > valB ? 1 : -1;
        } else {
            return valA < valB ? 1 : -1;
        }

    });

}

function renderTable() {

    const tbody = document.getElementById("slowTests");

    tbody.innerHTML = "";

    const start = (currentPage - 1) * rowsPerPage;

    const pageData = filteredSlowTests.slice(start, start + rowsPerPage);

    pageData.forEach(test => {

        const tr = document.createElement("tr");

        if (test.status === "failed") {
            tr.classList.add("failed-row");
        }

        tr.innerHTML = `

<td>${test.name}</td>
<td>${test.status}</td>
<td>${test.date.toLocaleString()}</td>
<td>${formatDuration(test.duration)}</td>

`;

        tbody.appendChild(tr);

    });

    const totalPages = Math.ceil(filteredSlowTests.length / rowsPerPage);

    document.getElementById("pageInfo").innerText =
        `Page ${currentPage} of ${totalPages}`;

}

function formatDuration(ms) {

    if (!ms || ms <= 0) return "0 hr 0 min 0 sec";

    const sec = Math.floor(ms / 1000) % 60;
    const min = Math.floor(ms / 60000) % 60;
    const hr = Math.floor(ms / 3600000);

    return `${hr} hr ${min} min ${sec} sec`;

}

function getInsightsForData(data) {
    return [
        ...generateQAInsights(data),
        ...generateFailureAnalysis(data),
        ...detectFlakyTests(data),
        ...detectPerformanceRegression(data)
    ]
}

function getSafeRate(numerator, denominator) {
    if (!denominator || denominator <= 0) return 0
    return Math.round((numerator / denominator) * 100)
}

function destroyRunAccordionCharts() {
    runAccordionCharts.forEach(chart => {
        try { chart.destroy() } catch (error) {}
    })
    runAccordionCharts = []
}

function getPdfSlowTestStyle(status) {

    const key = String(status || "").toLowerCase();

    if (key === "failed") {
        return { accent: [220, 38, 38], bg: [254, 242, 242], badge: [185, 28, 28], label: "FAILED" };
    }

    if (key === "passed") {
        return { accent: [22, 163, 74], bg: [240, 253, 244], badge: [21, 128, 61], label: "PASSED" };
    }

    if (key === "flaky") {
        return { accent: [217, 119, 6], bg: [255, 247, 237], badge: [180, 83, 9], label: "FLAKY" };
    }

    return { accent: [79, 70, 229], bg: [238, 242, 255], badge: [67, 56, 202], label: key.toUpperCase() || "UNKNOWN" };

}

function drawSlowTestsGrid(pdf, tests, startY) {

    let y = addSectionHeader(pdf, "Slowest Tests", startY);

    if (!tests.length) {
        pdf.setFont("helvetica", "italic");
        pdf.setFontSize(9);
        pdf.setTextColor(107, 114, 128);
        pdf.text("No slow test data available for the selected filter.", 10, y + 6);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(0, 0, 0);
        return y + 12;
    }

    const pageWidth = pdf.internal.pageSize.getWidth();
    const leftX = 10;
    const gutter = 8;
    const contentWidth = pageWidth - 20;
    const cardWidth = (contentWidth - gutter) / 2;
    const bodyWidth = cardWidth - 10;
    let cursorY = y + 4;

    const buildCard = (test) => {
        const style = getPdfSlowTestStyle(test.status);
        const nameLines = pdf.splitTextToSize(test.name || "-", bodyWidth);
        const dateLines = pdf.splitTextToSize(
            test.date instanceof Date ? test.date.toLocaleString() : String(test.date || "-"),
            bodyWidth
        );
        const height = 24 + (nameLines.length * 4.4) + (dateLines.length * 4.1);

        return {
            style,
            nameLines,
            dateLines,
            duration: formatDuration(test.duration),
            height
        };
    };

    const drawCard = (card, x, yPos) => {
        pdf.setFillColor(...card.style.bg);
        pdf.setDrawColor(226, 232, 240);
        pdf.roundedRect(x, yPos, cardWidth, card.height, 3, 3, "FD");

        pdf.setFillColor(...card.style.accent);
        pdf.rect(x, yPos, 3, card.height, "F");

        pdf.setFillColor(...card.style.badge);
        pdf.roundedRect(x + 7, yPos + 4, 21, 5.5, 1.5, 1.5, "F");
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(7.5);
        pdf.setTextColor(255, 255, 255);
        pdf.text(card.style.label, x + 9.5, yPos + 7.9);

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(9.5);
        pdf.setTextColor(17, 24, 39);
        pdf.text(card.nameLines, x + 7, yPos + 15);

        const metaY = yPos + 15 + (card.nameLines.length * 4.4) + 2;

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8);
        pdf.setTextColor(75, 85, 99);
        pdf.text(`Duration: ${card.duration}`, x + 7, metaY);
        pdf.text(card.dateLines, x + 7, metaY + 5);
    };

    for (let i = 0; i < tests.length; i += 2) {
        const rowCards = tests.slice(i, i + 2).map(buildCard);
        const rowHeight = Math.max(...rowCards.map(card => card.height));
        const pageLimit = pdf.internal.pageSize.getHeight() - PAGE_BOTTOM_MARGIN - 4;

        if (cursorY + rowHeight > pageLimit) {
            addNewPage(pdf);
            cursorY = PAGE_TOP_MARGIN;
            cursorY = addSectionHeader(pdf, "Slowest Tests (Continued)", cursorY - 4) + 4;
        }

        rowCards.forEach((card, idx) => {
            drawCard(card, leftX + idx * (cardWidth + gutter), cursorY);
        });

        cursorY += rowHeight + 6;
    }

    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(0, 0, 0);
    return cursorY;

}

document.getElementById("prevPage").onclick = () => {

    if (currentPage > 1) {
        currentPage--;
        renderTable();
    }

};

document.getElementById("nextPage").onclick = () => {

    const totalPages = Math.ceil(filteredSlowTests.length / rowsPerPage);

    if (currentPage < totalPages) {
        currentPage++;
        renderTable();
    }

};

document.getElementById("slowTestSearch").oninput = applyFilters;

document.querySelectorAll("#slowTestsTable th").forEach(th => {

    th.onclick = () => {

        const column = th.dataset.sort;

        if (currentSort.column === column) {
            currentSort.direction =
                currentSort.direction === "asc" ? "desc" : "asc";
        } else {
            currentSort.column = column;
            currentSort.direction = "asc";
        }

        sortData();

        renderTable();

    };

});

function buildExportFilename(ext) {
    const filter = document.getElementById("historyLabel").innerText
        .replace(/\s+/g, "-")
        .replace(/[^a-zA-Z0-9\-]/g, "")
    const now = new Date()
    const pad = n => String(n).padStart(2, "0")
    const ts = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
    return `Slowest-Tests_${filter}_${ts}.${ext}`
}

function buildHistoryExportFilename() {
    const filter = document.getElementById("historyLabel").innerText
        .replace(/\s+/g, "-")
        .replace(/[^a-zA-Z0-9\-]/g, "")
    const now = new Date()
    const pad = n => String(n).padStart(2, "0")
    const ts = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
    if (currentHistoryRange === "run" && currentFilteredData[0]?.timestamp) {
        const runTs = currentFilteredData[0].timestamp.replace(/[:.]/g, "-").replace(/[^a-zA-Z0-9\-TZ]/g, "")
        return `history_run_${runTs}_${ts}.json`
    }
    return `history_${filter}_${ts}.json`
}

function dedupeHistoryEntries(entries) {
    const byTimestamp = new Map()

    entries.forEach(entry => {
        if (!entry || !entry.timestamp) return
        byTimestamp.set(entry.timestamp, entry)
    })

    return [...byTimestamp.values()].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
}

function isFiniteNumber(value) {
    return typeof value === "number" && Number.isFinite(value)
}

function isValidHistoryResult(result) {

    if (!result || typeof result !== "object") return false
    if (typeof result.name !== "string" || !result.name.trim()) return false
    if (!["passed", "failed", "flaky", "skipped", "broken", "unknown"].includes(result.status)) return false
    if (!isFiniteNumber(result.start) || !isFiniteNumber(result.stop)) return false
    if (result.start < 0 || result.stop < 0 || result.stop < result.start) return false
    if (typeof result.error !== "string") return false

    return true

}

function validateHistoryEntry(entry) {

    if (!entry || typeof entry !== "object") {
        return "Each history item must be an object."
    }

    if (typeof entry.timestamp !== "string" || Number.isNaN(Date.parse(entry.timestamp))) {
        return "Each history item must contain a valid timestamp."
    }

    if (!isFiniteNumber(entry.total) || entry.total < 0) {
        return "Each history item must contain a valid non-negative total count."
    }

    if (!isFiniteNumber(entry.passed) || entry.passed < 0) {
        return "Each history item must contain a valid non-negative passed count."
    }

    if (!isFiniteNumber(entry.failed) || entry.failed < 0) {
        return "Each history item must contain a valid non-negative failed count."
    }

    if (!isFiniteNumber(entry.flaky) || entry.flaky < 0) {
        return "Each history item must contain a valid non-negative flaky count."
    }

    if (!Array.isArray(entry.results)) {
        return "Each history item must contain a results array."
    }

    if (entry.results.some(result => !isValidHistoryResult(result))) {
        return "Each result must include valid name, status, start, stop, and error fields."
    }

    if (entry.passed > entry.total || entry.failed > entry.total || entry.flaky > entry.total) {
        return "Passed, failed, and flaky counts cannot be greater than total."
    }

    if ((entry.passed + entry.failed) < entry.flaky) {
        return "Flaky count cannot exceed the number of executed test outcomes."
    }

    if (entry.results.length !== entry.total) {
        return "The total count must match the number of results."
    }

    return null

}

function validateHistoryImport(records) {

    if (!Array.isArray(records) || records.length === 0) {
        return "Imported JSON must be a non-empty array in history.json format."
    }

    for (let i = 0; i < records.length; i++) {
        const error = validateHistoryEntry(records[i])
        if (error) {
            return `Invalid record at index ${i}: ${error}`
        }
    }

    return null
}

function updateContextSummary(data) {

    const dataScopeSummary = document.getElementById("dataScopeSummary")
    const dataScopeNote = document.getElementById("dataScopeNote")
    const contextBreadcrumb = document.getElementById("contextBreadcrumb")
    const archiveStatusBadge = document.getElementById("archiveStatusBadge")
    const importStatusBadge = document.getElementById("importStatusBadge")
    const lastUpdatedBadge = document.getElementById("lastUpdatedBadge")
    const rangeLabel = document.getElementById("historyLabel").innerText || "All"
    const archiveOn = currentHistoryRange === "30" || currentHistoryRange === "all"
    const importedCount = importedHistoryData.length
    const runCount = Array.isArray(data) ? data.length : 0
    const latestTimestamp = runCount
        ? new Date(Math.max(...data.map(entry => new Date(entry.timestamp).getTime())))
        : null

    if (dataScopeSummary) {
        if (currentHistoryRange === "run" && data[0]) {
            dataScopeSummary.innerText =
                `Viewing a single run snapshot from ${new Date(data[0].timestamp).toLocaleString()} using the same overview dashboard.`
        } else {
            const sourceParts = ["live history"]
            if (archiveOn) sourceParts.push("archives")
            if (importedCount) sourceParts.push("imported data")

            dataScopeSummary.innerText =
                `Viewing ${rangeLabel.toLowerCase()} with ${runCount} run${runCount === 1 ? "" : "s"} from ${sourceParts.join(", ")}.`
        }
    }

    if (contextBreadcrumb) {
        if (currentHistoryRange === "run" && data[0]) {
            contextBreadcrumb.innerText = "Overview / Run Snapshot"
        } else {
            contextBreadcrumb.innerText = `Overview / ${rangeLabel}`
        }
    }

    if (dataScopeNote) {
        if (currentHistoryRange === "run") {
            dataScopeNote.innerText = "Use the sidebar menu beside the title to switch between the overview and individual run pages."
        } else {
            dataScopeNote.innerText = importedCount
                ? "Imported JSON is session-only and is merged into the current browser session."
                : "Imported JSON is session-only and does not overwrite dashboard files."
        }
    }

    if (archiveStatusBadge) {
        archiveStatusBadge.innerText = `Archives: ${archiveOn ? "in scope" : "not used"}`
    }

    if (importStatusBadge) {
        importStatusBadge.innerText = `Imported runs: ${importedCount}`
    }

    if (lastUpdatedBadge) {
        lastUpdatedBadge.innerText = latestTimestamp
            ? `Last updated: ${latestTimestamp.toLocaleString()}`
            : "Last updated: no runs loaded"
    }

}

async function applyCurrentHistoryRange() {
    updateDashboard(await getHistoryDataForRange(currentHistoryRange))
}

let toastTimer;
let toastHideAnimationTimer;

function hideToast() {

    const toast = document.getElementById("toast");
    if (!toast) return;

    clearTimeout(toastTimer);
    clearTimeout(toastHideAnimationTimer);

    if (!toast.classList.contains("show")) {
        toast.classList.remove("hiding");
        toast.setAttribute("aria-hidden", "true");
        return;
    }

    toast.classList.remove("show");
    toast.classList.add("hiding");
    toastHideAnimationTimer = setTimeout(() => {
        toast.classList.remove("hiding");
        toast.setAttribute("aria-hidden", "true");
    }, 1200);

}

function showToast(message, type = "error") {

    const toast = document.getElementById("toast");
    const toastMessage = document.getElementById("toastMessage");
    if (!toast) return;

    if (toastMessage) {
        toastMessage.innerText = message;
    }

    clearTimeout(toastHideAnimationTimer);
    toast.classList.remove("hiding");
    toast.classList.remove("toast-success");
    if (type === "success") {
        toast.classList.add("toast-success");
    }
    toast.classList.add("show");
    toast.setAttribute("aria-hidden", "false");

    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, 10000);

}

document.getElementById("toastClose").onclick = hideToast;

document.getElementById("exportJson").onclick = async () => {

    const data = currentHistoryRange === "run"
        ? [...currentFilteredData]
        : await getHistoryDataForRange(currentHistoryRange)

    if (!Array.isArray(data) || data.length === 0) {
        showToast("No data available for the selected filter. Please choose a different range before exporting.");
        return
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")

    a.href = url
    a.download = buildHistoryExportFilename()
    a.click()

    URL.revokeObjectURL(url)
    showToast(`Exported ${data.length} history run${data.length === 1 ? "" : "s"} as JSON.`, "success")

};

document.getElementById("importJson").onclick = () => {
    document.getElementById("importJsonInput").click()
};

function renderSidebarRunsMenu() {
    const list = document.getElementById("sidebarRunsList")
    const searchWrap = document.getElementById("sidebarRunsSearchWrap")
    const searchInput = document.getElementById("sidebarRunSearch")
    const searchSummary = document.getElementById("sidebarRunsSummary")
    const runsLabel = document.getElementById("sidebarRunsLabel")
    if (!list) return

    const runs = [...getAllPersistedHistoryData()].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    const normalizedSearchTerm = sidebarRunsSearchTerm.trim().toLowerCase()
    const filteredRuns = runs.filter((entry, index) => {
        if (!normalizedSearchTerm) return true

        const runLabel = `run ${runs.length - index}`.toLowerCase()
        const runDate = new Date(entry.timestamp).toLocaleString().toLowerCase()
        const totalLabel = `${entry.total || 0} tests`

        return [runLabel, runDate, totalLabel.toLowerCase()].some(value => value.includes(normalizedSearchTerm))
    })

    if (!runs.length) {
        searchWrap?.classList.remove("open")
        if (runsLabel) runsLabel.innerText = "Individual Runs"
        if (searchSummary) searchSummary.innerText = "No run history is available yet."
        list.innerHTML = `<div class="run-empty">No runs available.</div>`
        return
    }

    if (runsLabel) {
        runsLabel.innerText = `Individual Runs (${runs.length})`
    }

    if (searchInput && searchInput.value !== sidebarRunsSearchTerm) {
        searchInput.value = sidebarRunsSearchTerm
    }

    if (!filteredRuns.length) {
        if (searchSummary) {
            searchSummary.innerText = `No matches for "${sidebarRunsSearchTerm}".`
        }
        list.innerHTML = `<div class="run-empty">No runs match "${sidebarRunsSearchTerm}".</div>`
        updateSidebarSelection()
        return
    }

    if (searchSummary) {
        const groupCount = new Set(filteredRuns.map(entry => new Date(entry.timestamp).toLocaleDateString(undefined, { month: "long", year: "numeric" }))).size
        searchSummary.innerText = normalizedSearchTerm
            ? `Showing ${filteredRuns.length} of ${runs.length} runs across ${groupCount} month${groupCount === 1 ? "" : "s"}.`
            : `Showing ${runs.length} runs across ${groupCount} month${groupCount === 1 ? "" : "s"}.`
    }

    const groupedRuns = filteredRuns.reduce((groups, entry) => {
        const date = new Date(entry.timestamp)
        const groupLabel = date.toLocaleDateString(undefined, { month: "long", year: "numeric" })
        const groupKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
        if (!groups[groupKey]) groups[groupKey] = { label: groupLabel, runs: [] }
        groups[groupKey].runs.push(entry)
        return groups
    }, {})

    list.innerHTML = Object.entries(groupedRuns).map(([groupKey, groupData], groupIndex) => {
        const shouldOpen = normalizedSearchTerm
            || sidebarExpandedMonths.has(groupKey)
            || (selectedRunTimestamp && groupData.runs.some(entry => entry.timestamp === selectedRunTimestamp))
            || groupIndex === 0

        if (shouldOpen) {
            sidebarExpandedMonths.add(groupKey)
        }

        return `
        <div class="sidebar-run-group ${shouldOpen ? "open" : ""}" data-month-key="${groupKey}">
            <button class="sidebar-run-group-toggle" type="button" aria-expanded="${shouldOpen ? "true" : "false"}">
                <span class="sidebar-run-group-label">${groupData.label}</span>
                <span class="sidebar-run-group-caret">${shouldOpen ? "-" : "+"}</span>
            </button>
            <div class="sidebar-run-group-items">
            ${groupData.runs.map((entry) => {
                const index = runs.findIndex(run => run.timestamp === entry.timestamp)
                return `
                <a class="sidebar-run-link" data-run-timestamp="${entry.timestamp}" href="index.html?run=${encodeRunTimestamp(entry.timestamp)}" title="${new Date(entry.timestamp).toLocaleString()}">
                    <span class="sidebar-run-label">Run ${runs.length - index}</span>
                    <span class="sidebar-run-meta">${new Date(entry.timestamp).toLocaleString()} | ${entry.total || 0} tests</span>
                </a>
            `
            }).join("")}
            </div>
        </div>
    `
    }).join("")

    list.querySelectorAll(".sidebar-run-group-toggle").forEach(toggle => {
        toggle.addEventListener("click", () => {
            const group = toggle.closest(".sidebar-run-group")
            const monthKey = group?.dataset.monthKey
            const willOpen = !group?.classList.contains("open")

            group?.classList.toggle("open", willOpen)
            toggle.setAttribute("aria-expanded", willOpen ? "true" : "false")

            const caret = toggle.querySelector(".sidebar-run-group-caret")
            if (caret) caret.textContent = willOpen ? "-" : "+"

            if (monthKey) {
                if (willOpen) sidebarExpandedMonths.add(monthKey)
                else sidebarExpandedMonths.delete(monthKey)
            }
        })
    })

    updateSidebarSelection()
}

function initSidebar() {
    const body = document.body
    const sidebarToggle = document.getElementById("sidebarToggle")
    const sidebarClose = document.getElementById("sidebarClose")
    const sidebarBackdrop = document.getElementById("sidebarBackdrop")
    const runsToggle = document.getElementById("sidebarRunsToggle")
    const runsList = document.getElementById("sidebarRunsList")
    const runsCaret = document.getElementById("sidebarRunsCaret")
    const runSearch = document.getElementById("sidebarRunSearch")
    const runSearchClear = document.getElementById("sidebarRunSearchClear")
    const runSearchWrap = document.getElementById("sidebarRunsSearchWrap")

    const closeSidebar = () => body.classList.remove("sidebar-open")

    sidebarToggle?.addEventListener("click", (e) => {
        e.stopPropagation()
        body.classList.toggle("sidebar-open")
    })

    sidebarClose?.addEventListener("click", closeSidebar)
    sidebarBackdrop?.addEventListener("click", closeSidebar)

    runsToggle?.addEventListener("click", () => {
        const isOpen = runsList?.classList.toggle("open")
        runsToggle.classList.toggle("open", !!isOpen)
        runSearchWrap?.classList.toggle("open", !!isOpen)
        if (runsCaret) runsCaret.textContent = "+"
        if (isOpen) setAllSidebarMonthGroupsExpanded(false)
        if (isOpen && runSearch) {
            requestAnimationFrame(() => runSearch.focus())
        }
    })

    document.querySelectorAll(".sidebar-link, .sidebar-run-link").forEach(link => {
        link.addEventListener("click", closeSidebar)
    })

    runSearch?.addEventListener("input", (event) => {
        sidebarRunsSearchTerm = event.target.value
        renderSidebarRunsMenu()
        runsList?.classList.add("open")
        runsToggle?.classList.add("open")
        runSearchWrap?.classList.add("open")
        setAllSidebarMonthGroupsExpanded(Boolean(sidebarRunsSearchTerm.trim()))
    })

    runSearchClear?.addEventListener("click", () => {
        sidebarRunsSearchTerm = ""
        if (runSearch) runSearch.value = ""
        renderSidebarRunsMenu()
        runsList?.classList.add("open")
        runsToggle?.classList.add("open")
        runSearchWrap?.classList.add("open")
        setAllSidebarMonthGroupsExpanded(false)
        runSearch?.focus()
    })

    if (selectedRunTimestamp) {
        runsList?.classList.add("open")
        runsToggle?.classList.add("open")
        runSearchWrap?.classList.add("open")
        setAllSidebarMonthGroupsExpanded(false)
    }
}

function updateRunModeUI() {
    const historyDropdown = document.getElementById("historyDropdown")
    const dataDropdown = document.getElementById("importJson")?.closest(".dropdown")
    const importBadge = document.getElementById("importStatusBadge")
    const dataScopeNote = document.getElementById("dataScopeNote")

    if (currentHistoryRange === "run") {
        if (historyDropdown) historyDropdown.style.display = "none"
        if (dataDropdown) dataDropdown.style.display = "none"
        if (importBadge) importBadge.style.display = "none"
        if (dataScopeNote) dataScopeNote.innerText = "Exports on this page use only the selected run snapshot."
    } else {
        if (historyDropdown) historyDropdown.style.display = ""
        if (dataDropdown) dataDropdown.style.display = ""
        if (importBadge) importBadge.style.display = ""
        if (dataScopeNote) dataScopeNote.innerText = "Imported JSON is session-only and does not overwrite dashboard files."
    }
}

document.getElementById("importJsonInput").onchange = async (event) => {

    const file = event.target.files?.[0]
    if (!file) return

    try {
        const text = await file.text()
        const parsed = JSON.parse(text)
        const records = Array.isArray(parsed) ? parsed : []
        const validationError = validateHistoryImport(records)

        if (validationError) {
            showToast(validationError);
            return
        }

        importedHistoryData = dedupeHistoryEntries(importedHistoryData.concat(records))
        await applyCurrentHistoryRange()
        showToast(`Imported ${records.length} history run${records.length === 1 ? "" : "s"} successfully.`, "success")
    } catch (error) {
        showToast("Unable to import JSON. Please check the file format and try again.")
    } finally {
        event.target.value = ""
    }

};

function ensureExportableData() {

    const hasDashboardData = Array.isArray(currentFilteredData) && currentFilteredData.length > 0;
    const hasSlowTestData = Array.isArray(filteredSlowTests) && filteredSlowTests.length > 0;

    if (hasDashboardData && hasSlowTestData) {
        return true;
    }

    showToast("No data available for the selected filter. Please choose a different range before exporting.");
    return false;

}

document.getElementById("exportExcel").onclick = () => {

    if (!ensureExportableData()) return;

    const exportData = filteredSlowTests.map(t => ({
        TestName: t.name,
        Status: t.status,
        Date: t.date.toLocaleString(),
        Duration: formatDuration(t.duration)
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);

    const wb = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(wb, ws, "Slow Tests");

    XLSX.writeFile(wb, buildExportFilename("xlsx"));
    showToast(`Exported ${exportData.length} slow test record${exportData.length === 1 ? "" : "s"} to Excel.`, "success")

};

document.getElementById("exportCSV").onclick = () => {

    if (!ensureExportableData()) return;

    let csv = "Test Name,Status,Date,Duration\n";

    filteredSlowTests.forEach(t => {

        csv += `"${t.name}","${t.status}","${t.date.toLocaleString()}","${formatDuration(t.duration)}"\n`;

    });

    const blob = new Blob([csv], { type: "text/csv" });

    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");

    a.href = url;

    a.download = buildExportFilename("csv");

    a.click();

    URL.revokeObjectURL(url);
    showToast(`Exported ${filteredSlowTests.length} slow test record${filteredSlowTests.length === 1 ? "" : "s"} to CSV.`, "success")

};

/* UPDATE DASHBOARD */

function updateKPIs(data) {
    if (!data || data.length === 0) {
        totalTests.innerText = 0;
        passedTests.innerText = 0;
        failedTests.innerText = 0;
        flakyTests.innerText = 0;
        return;
    }

    const total = data.reduce((sum, entry) => sum + (entry.total || 0), 0);
    const passed = data.reduce((sum, entry) => sum + (entry.passed || 0), 0);
    const failed = data.reduce((sum, entry) => sum + (entry.failed || 0), 0);
    const flaky = data.reduce((sum, entry) => sum + (entry.flaky || 0), 0);

    totalTests.innerText = total;
    passedTests.innerText = passed;
    failedTests.innerText = failed;
    flakyTests.innerText = flaky;
}

function updateDashboard(data) {
    // FIX: always keep currentFilteredData in sync, including during filter changes
    currentFilteredData = data;
    updateContextSummary(data);

    updateFailureHeatmap(data);
    updateKPIs(data);

    const passedTotal = data.reduce((sum, entry) => sum + (entry.passed || 0), 0);
    const total = data.reduce((sum, entry) => sum + (entry.total || 0), 0);
    const failedTotal = data.reduce((sum, entry) => sum + (entry.failed || 0), 0);
    const flakyTotal = data.reduce((sum, entry) => sum + (entry.flaky || 0), 0);

    trendChart.data.labels = data.map(d => new Date(d.timestamp).toLocaleDateString())
    trendChart.data.datasets[0].data = data.map(d => d.total)
    trendChart.update()

    passChart.data.labels = data.map(d => new Date(d.timestamp).toLocaleDateString())
    passChart.data.datasets[0].data = data.map(d => Math.round(d.passed / d.total * 100))
    passChart.update()

    statusChart.data.datasets[0].data = [passedTotal, failedTotal, flakyTotal];
    statusChart.update();

    flakyChart.data.labels = data.map(d => new Date(d.timestamp).toLocaleDateString())
    flakyChart.data.datasets[0].data = data.map(d => d.flaky)
    flakyChart.update()

    qualityChart.data.labels = data.map(d => new Date(d.timestamp).toLocaleDateString())

    qualityChart.data.datasets[0].data = data.map(d =>
        Math.round((d.passed / d.total) * 100)
    )

    qualityChart.data.datasets[1].data = data.map(d =>
        Math.round((d.passed / (d.total - d.flaky)) * 100)
    )

    qualityChart.update()

    // Always call both — they handle empty data by rendering clear states
    populateSlowTests(data);
    renderInsights(data);
    renderRunAccordion(data);

}

/* HISTORY FILTER */

document.querySelectorAll("#historyDropdown .dropdown-menu button").forEach(btn => {

    btn.onclick = async (e) => {

        e.stopPropagation();

        const range = btn.dataset.range;
        currentHistoryRange = range;
        historyLabel.innerText = btn.innerText;

        const filtered = await getHistoryDataForRange(range);

        // FIX: route everything through updateDashboard so currentFilteredData
        // stays in sync. Removed the separate populateSlowTests / renderInsights
        // calls that previously left currentFilteredData stale for PDF export.
        updateDashboard(filtered);

        closeAllDropdowns();

    }

})

/* DOWNLOAD */

document.getElementById("downloadPDF").onclick = generateProfessionalReport;
const PAGE_HEADER_HEIGHT = 25
const PAGE_TOP_MARGIN = 35
const PAGE_BOTTOM_MARGIN = 15

function calculateExecutionStats(data) {

    let testDurations = []  // individual test durations for slowest/fastest
    let slowest = null
    let fastest = null
    let totalWallClock = 0  // sum of per-run wall-clock times
    let runCount = 0        // number of runs that had valid results

    data.forEach(entry => {

        if (!entry.results || entry.results.length === 0) return

        let runMin = Infinity
        let runMax = -Infinity

        entry.results.forEach(test => {

            const start = Number(test.start)
            const stop  = Number(test.stop)

            if (isNaN(start) || isNaN(stop) || stop <= start) return

            const duration = stop - start

            testDurations.push({ name: test.name, duration })

            if (!slowest || duration > slowest.duration)
                slowest = { name: test.name, duration }

            if (!fastest || duration < fastest.duration)
                fastest = { name: test.name, duration }

            // track the earliest start and latest stop across this run
            if (start < runMin) runMin = start
            if (stop  > runMax) runMax = stop

        })

        // wall-clock time for this run = latest stop − earliest start
        // this correctly handles parallel test execution
        if (runMax > runMin) {
            totalWallClock += runMax - runMin
            runCount++
        }

    })

    if (testDurations.length === 0) return null

    // average wall-clock time per run (not sum of individual test durations)
    const avgRunDuration = runCount > 0
        ? Math.round(totalWallClock / runCount)
        : 0

    return {
        avgRunDuration,   // mean wall-clock time per run
        totalWallClock,   // total wall-clock time across all runs
        slowest,
        fastest,
        testCount: testDurations.length,
        runCount
    }

}

function prepareHighResCharts() {

    Chart.defaults.devicePixelRatio = 1.5;

    statusChart.resize();
    trendChart.resize();
    passChart.resize();
    flakyChart.resize();
    qualityChart.resize();
    failureHeatmap.resize();

}

// PDF-safe palette — strong enough to be visible on white paper
const PDF_THEME = {
    text:    "#1f2937",
    subtext: "#4b5563",
    grid:    "rgba(0,0,0,0.12)",
    border:  "rgba(0,0,0,0.18)"
}

function applyPDFTheme() {
    patchChartsWithTheme(PDF_THEME)
}

function restoreUITheme() {
    // Re-apply the user's current UI theme after PDF is done
    applyChartTheme()
}

function getInsightStyle(text) {

    text = text.toLowerCase()

    if (text.includes("failed") || text.includes("error"))
        return { icon: "[!]", color: [220,53,69] }

    if (text.includes("slow") || text.includes("performance"))
        return { icon: "[SLOW]", color: [255,140,0] }

    if (text.includes("flaky"))
        return { icon: "[FLAKY]", color: [180,0,0] }

    if (text.includes("pass rate") || text.includes("stability"))
        return { icon: "[INFO]", color: [13,110,253] }

    return { icon: "[OK]", color: [40,167,69] }
}

function generateProfessionalReport() {

    if (!ensureExportableData()) return;

    closeAllDropdowns();
    prepareHighResCharts();
    applyPDFTheme();

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF("p", "mm", "a4");

    let y = 25;

    const total = document.getElementById("totalTests").innerText;
    const passed = document.getElementById("passedTests").innerText;
    const failed = document.getElementById("failedTests").innerText;
    const flaky = document.getElementById("flakyTests").innerText;
    const passRate = total > 0 ? ((passed / total) * 100).toFixed(1) : 0;

    const insights = [
        ...generateQAInsights(currentFilteredData),
        ...generateFailureAnalysis(currentFilteredData),
        ...detectFlakyTests(currentFilteredData),
        ...detectPerformanceRegression(currentFilteredData)
    ];
    drawPageHeader(pdf)
    drawPageFooter(pdf)

    pdf.setTextColor(0);

    y = PAGE_TOP_MARGIN

    const filter = document.getElementById("historyLabel").innerText;

    let metaX = 12
    metaX += drawMetaPill(pdf, `History Range: ${filter}`, metaX, y - 8, [238, 242, 255], [55, 48, 163]) + 4
    drawMetaPill(pdf, `Generated: ${new Date().toLocaleString()}`, metaX, y - 8, [239, 246, 255], [30, 64, 175])

    y += 6

    /* QA SUMMARY */

    y = addSectionHeader(pdf, "QA Summary", y);

    pdf.setFontSize(12);

    const summaryRows = [
        ["Total Tests Executed", total],
        ["Passed Tests", passed],
        ["Failed Tests", failed],
        ["Flaky Tests", flaky],
        ["Pass Rate", passRate + "%"],
        ["Quality Score", (passRate - (flaky / total * 100)).toFixed(1) + "%"]
    ];

    pdf.autoTable(getModernTableOptions(pdf, y, [79, 70, 229], summaryRows));

    let tableEndY = pdf.lastAutoTable.finalY;
    let iy = PAGE_TOP_MARGIN

    y = Math.max(tableEndY, iy) + 10;

    // FIX: calculateExecutionStats now uses currentFilteredData which is always
    // in sync with whatever filter is active at the time of export.
    const stats = calculateExecutionStats(currentFilteredData)

    if (stats) {

        y = addSectionHeader(pdf, "Execution Statistics", y)

        const statsData = [
            ["Metric", "Value"],
            ["Runs Analysed", String(stats.runCount)],
            ["Tests Measured", String(stats.testCount)],
            ["Avg Wall-Clock Time per Run", formatDuration(stats.avgRunDuration)],
            ["Total Wall-Clock Time (all runs)", formatDuration(stats.totalWallClock)],
            ["Slowest Individual Test", stats.slowest.name],
            ["Slowest Duration", formatDuration(stats.slowest.duration)],
            ["Fastest Individual Test", stats.fastest.name],
            ["Fastest Duration", formatDuration(stats.fastest.duration)]
        ]

        pdf.autoTable(getModernTableOptions(pdf, y, [14, 165, 233], statsData.slice(1)))

        y = pdf.lastAutoTable.finalY + 10

    }

    addNewPage(pdf);

    y = PAGE_TOP_MARGIN;

    /* QA INSIGHTS */

    y = addSectionHeader(pdf, "QA Insights", y - 4);

    const pdfInsightStyle = (text) => {
        const t = text.toLowerCase()
        if (t.includes("excellent"))
            return { label: "EXCELLENT", fg: [22,163,74],  bg: [240,253,244], bar: [22,163,74]  }
        if (t.includes("good") && t.includes("pass"))
            return { label: "GOOD",      fg: [37,99,235],  bg: [239,246,255], bar: [37,99,235]  }
        if ((t.includes("low") && t.includes("pass")) || t.includes("warning"))
            return { label: "WARNING",   fg: [180,83,9],   bg: [255,251,235], bar: [217,119,6]  }
        if (t.includes("failed") || t.includes("failure"))
            return { label: "FAILED",    fg: [185,28,28],  bg: [254,242,242], bar: [220,38,38]  }
        if (t.includes("flaky") || t.includes("inconsistent"))
            return { label: "FLAKY",     fg: [146,64,14],  bg: [255,247,237], bar: [180,83,9]   }
        if (t.includes("slow") || t.includes("performance"))
            return { label: "SLOW",      fg: [194,65,12],  bg: [255,247,237], bar: [234,88,12]  }
        return   { label: "INFO",        fg: [67,56,202],  bg: [238,242,255], bar: [99,102,241] }
    }

    iy = y + 6

    insights.forEach(text => {

        const s = pdfInsightStyle(text)
        const wrapped = pdf.splitTextToSize(text, 150)
        const rowH = Math.max(13, wrapped.length * 5.5 + 9)

        if (iy + rowH > 272) {
            addNewPage(pdf)
            iy = PAGE_TOP_MARGIN + 6
        }

        // card background
        pdf.setFillColor(...s.bg)
        pdf.roundedRect(10, iy, 190, rowH, 2, 2, "F")

        // left accent bar
        pdf.setFillColor(...s.bar)
        pdf.rect(10, iy, 3, rowH, "F")

        // measure badge width
        pdf.setFontSize(7)
        pdf.setFont("helvetica", "bold")
        const badgeTextW = pdf.getStringUnitWidth(s.label) * 7 / pdf.internal.scaleFactor
        const badgeW = badgeTextW + 6

        // small icon to the right of the accent bar
        const iconMap = {
            "EXCELLENT": "check",
            "GOOD":      "check",
            "WARNING":   "warning",
            "FAILED":    "cross",
            "FLAKY":     "warning",
            "SLOW":      "clock",
            "INFO":      "info"
        }
        const iconName = iconMap[s.label] || "info"
        pdfIcon(pdf, iconName, 19, iy + rowH / 2, 2, s.bar)

        // badge pill — shifted right to sit after icon
        const badgePillX = 24
        pdf.setFillColor(...s.fg)
        pdf.roundedRect(badgePillX, iy + 3.5, badgeW, 5.5, 1, 1, "F")

        // badge label
        pdf.setTextColor(255, 255, 255)
        pdf.text(s.label, badgePillX + 3, iy + 7.5)

        // insight body text
        pdf.setFontSize(9)
        pdf.setFont("helvetica", "normal")
        pdf.setTextColor(...s.fg)
        pdf.text(wrapped, badgePillX + badgeW + 4, iy + 7.8)

        iy += rowH + 3

    })

    pdf.setTextColor(0, 0, 0)
    pdf.setFont("helvetica", "normal")

    addNewPage(pdf);

    y = PAGE_TOP_MARGIN;

    /* CHARTS */

    y = addSectionHeader(pdf, "Analytics Charts", y - 4);

    // Capture as JPEG at 0.82 quality — ~5-8x smaller than PNG with no visible loss
    function chartToJpeg(chart) {
        const canvas = chart.canvas
        const ctx = canvas.getContext("2d")
        // JPEG doesn't support transparency — paint white behind first
        const offscreen = document.createElement("canvas")
        offscreen.width  = canvas.width
        offscreen.height = canvas.height
        const octx = offscreen.getContext("2d")
        octx.fillStyle = "#ffffff"
        octx.fillRect(0, 0, offscreen.width, offscreen.height)
        octx.drawImage(canvas, 0, 0)
        return offscreen.toDataURL("image/jpeg", 0.82)
    }

    const statusImg  = chartToJpeg(statusChart)
    const trendImg   = chartToJpeg(trendChart)
    const passImg    = chartToJpeg(passChart)
    const flakyImg   = chartToJpeg(flakyChart)
    const qualityImg = chartToJpeg(qualityChart)
    const heatmapImg = chartToJpeg(failureHeatmap)

    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(10)
    pdf.setTextColor(30, 58, 138)

    // Status Distribution label + icon
    pdfIcon(pdf, "target", 13, y, 2, [99,102,241])
    pdf.text("Status Distribution", 18, y + 1)

    // Execution Trend label + icon
    pdfIcon(pdf, "chart", 113, y, 2, [34,197,94])
    pdf.text("Execution Trend", 118, y + 1)

    pdf.setFont("helvetica", "normal")
    pdf.setTextColor(0)
    y += 5;

    pdf.addImage(statusImg, "JPEG", 10, y, 90, 60);
    pdf.addImage(trendImg,  "JPEG", 110, y, 90, 60);

    y += 70;

    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(10)
    pdf.setTextColor(30, 58, 138)

    pdfIcon(pdf, "check", 13, y, 2, [22,163,74])
    pdf.text("Pass Rate Trend", 18, y + 1)

    pdfIcon(pdf, "warning", 113, y, 2, [245,158,11])
    pdf.text("Flaky Trend", 118, y + 1)

    pdf.setFont("helvetica", "normal")
    pdf.setTextColor(0)
    y += 5;

    pdf.addImage(passImg,  "JPEG", 10,  y, 90, 60);
    pdf.addImage(flakyImg, "JPEG", 110, y, 90, 60);

    addNewPage(pdf);

    y = PAGE_TOP_MARGIN;

    y = addSectionHeader(pdf, "Advanced Analytics", y - 4);

    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(10)
    pdf.setTextColor(30, 58, 138)

    pdfIcon(pdf, "chart", 13, y, 2, [139,92,246])
    pdf.text("Stability Trend", 18, y + 1)

    pdfIcon(pdf, "cross", 113, y, 2, [239,68,68])
    pdf.text("Failure Heatmap", 118, y + 1)

    pdf.setFont("helvetica", "normal")
    pdf.setTextColor(0)
    y += 5;

    pdf.addImage(qualityImg, "JPEG", 10, y, 90, 60);
    pdf.addImage(heatmapImg, "JPEG", 110, y, 90, 60);

    addNewPage(pdf);

    y = PAGE_TOP_MARGIN;

    y = drawSlowTestsGrid(pdf, filteredSlowTests, y - 4);

    const exportFilter = document.getElementById("historyLabel").innerText
        .replace(/\s+/g, "-")
        .replace(/[^a-zA-Z0-9\-]/g, "")

    const now = new Date()
    const pad = n => String(n).padStart(2, "0")
    const exportTs = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`

    pdf.save(`Playwright-QA-Report_${exportFilter}_${exportTs}.pdf`);
    showToast(`PDF report prepared for ${filter}.`, "success")

    // Restore UI chart colors after export
    Chart.defaults.devicePixelRatio = window.devicePixelRatio || 1;
    restoreUITheme();
}

/* ── PDF ICON PRIMITIVES ──────────────────────────────────────────────────
   Draw small geometric icons using jsPDF drawing calls only.
   x,y = centre point, r = radius/size in mm
   ─────────────────────────────────────────────────────────────────────── */
function pdfIcon(pdf, name, x, y, r, color) {
    const [cr, cg, cb] = color
    pdf.setDrawColor(cr, cg, cb)
    pdf.setFillColor(cr, cg, cb)
    pdf.setLineWidth(0.5)

    switch (name) {

        case "rocket": {
            // body: filled triangle pointing up
            pdf.triangle(x, y - r, x - r * 0.6, y + r * 0.5, x + r * 0.6, y + r * 0.5, "F")
            // flame: small triangle below
            pdf.setFillColor(251, 146, 60)
            pdf.triangle(x, y + r * 0.9, x - r * 0.3, y + r * 0.5, x + r * 0.3, y + r * 0.5, "F")
            break
        }

        case "check": {
            // circle with tick
            pdf.circle(x, y, r, "FD")
            pdf.setDrawColor(255, 255, 255)
            pdf.setLineWidth(0.6)
            pdf.line(x - r * 0.45, y, x - r * 0.1, y + r * 0.4)
            pdf.line(x - r * 0.1, y + r * 0.4, x + r * 0.45, y - r * 0.35)
            break
        }

        case "cross": {
            // circle with X
            pdf.circle(x, y, r, "FD")
            pdf.setDrawColor(255, 255, 255)
            pdf.setLineWidth(0.6)
            pdf.line(x - r * 0.4, y - r * 0.4, x + r * 0.4, y + r * 0.4)
            pdf.line(x + r * 0.4, y - r * 0.4, x - r * 0.4, y + r * 0.4)
            break
        }

        case "warning": {
            // filled triangle with !
            pdf.triangle(x, y - r, x - r, y + r * 0.8, x + r, y + r * 0.8, "F")
            pdf.setDrawColor(255, 255, 255)
            pdf.setFillColor(255, 255, 255)
            pdf.setLineWidth(0.55)
            pdf.line(x, y - r * 0.3, x, y + r * 0.3)
            pdf.circle(x, y + r * 0.52, r * 0.12, "F")
            break
        }

        case "info": {
            // circle with i
            pdf.circle(x, y, r, "FD")
            pdf.setFillColor(255, 255, 255)
            pdf.circle(x, y - r * 0.35, r * 0.12, "F")
            pdf.setDrawColor(255, 255, 255)
            pdf.setLineWidth(0.55)
            pdf.line(x, y - r * 0.1, x, y + r * 0.42)
            break
        }

        case "flash": {
            // lightning bolt: two small rects at angle
            pdf.rect(x - r*0.15, y - r, r*0.5, r, "F")
            pdf.rect(x - r*0.35, y, r*0.5, r, "F")
            break
        }

        case "clock": {
            // circle + hands
            pdf.circle(x, y, r, "D")
            pdf.setDrawColor(cr, cg, cb)
            pdf.setLineWidth(0.5)
            pdf.line(x, y, x, y - r * 0.55)      // hour hand up
            pdf.line(x, y, x + r * 0.4, y + r * 0.2) // minute hand right-down
            break
        }

        case "chart": {
            // three bars of increasing height
            const bw = r * 0.45
            pdf.rect(x - r,        y + r * 0.1,  bw, r * 0.9,  "F")
            pdf.rect(x - r * 0.25, y - r * 0.3,  bw, r * 1.3,  "F")
            pdf.rect(x + r * 0.5,  y - r * 0.8,  bw, r * 1.8,  "F")
            break
        }

        case "target": {
            // concentric circles
            pdf.circle(x, y, r,       "D")
            pdf.circle(x, y, r * 0.6, "D")
            pdf.circle(x, y, r * 0.2, "F")
            break
        }

        case "star": {
            // 5-point star — build absolute points, convert to relative for pdf.lines
            pdf.setLineWidth(0.4)
            const pts = 5
            const outer = r, inner = r * 0.42
            // collect absolute (ax, ay) points around centre x,y
            const absPoints = []
            for (let i = 0; i < pts * 2; i++) {
                const angle = (i * Math.PI / pts) - Math.PI / 2
                const rad   = i % 2 === 0 ? outer : inner
                absPoints.push([x + Math.cos(angle) * rad, y + Math.sin(angle) * rad])
            }
            // convert to relative segments for pdf.lines
            const relSegs = []
            for (let i = 1; i < absPoints.length; i++) {
                relSegs.push([absPoints[i][0] - absPoints[i-1][0],
                               absPoints[i][1] - absPoints[i-1][1]])
            }
            pdf.lines(relSegs, absPoints[0][0], absPoints[0][1], [1,1], "FD", true)
            break
        }

        default: {
            // fallback dot
            pdf.circle(x, y, r * 0.6, "F")
        }
    }

    // reset
    pdf.setLineWidth(0.2)
    pdf.setDrawColor(0)
    pdf.setFillColor(0)
}

/* Section icons map */
const SECTION_ICONS = {
    "QA Summary":          { icon: "target", color: [79,70,229]  },
    "Execution Statistics":{ icon: "clock",  color: [14,165,233] },
    "QA Insights":         { icon: "star",   color: [245,158,11] },
    "Analytics Charts":    { icon: "chart",  color: [99,102,241] },
    "Advanced Analytics":  { icon: "rocket", color: [139,92,246] },
    "Slowest Tests":       { icon: "warning", color: [234,88,12] },
}

/* KPI row icons in summary table */
const METRIC_ICONS = {
    "Total Tests Executed":          { icon: "info",    color: [79,70,229]   },
    "Passed Tests":                  { icon: "check",   color: [22,163,74]   },
    "Failed Tests":                  { icon: "cross",   color: [220,38,38]   },
    "Flaky Tests":                   { icon: "warning", color: [217,119,6]   },
    "Pass Rate":                     { icon: "target",  color: [14,165,233]  },
    "Quality Score":                 { icon: "star",    color: [139,92,246]  },
    "Runs Analysed":                 { icon: "info",    color: [79,70,229]   },
    "Tests Measured":                { icon: "info",    color: [99,102,241]  },
    "Avg Wall-Clock Time per Run":   { icon: "clock",   color: [14,165,233]  },
    "Total Wall-Clock Time (all runs)":{ icon: "clock", color: [22,163,74]   },
    "Slowest Individual Test":       { icon: "warning", color: [234,88,12]   },
    "Slowest Duration":              { icon: "clock",   color: [234,88,12]   },
    "Fastest Individual Test":       { icon: "check",   color: [22,163,74]   },
    "Fastest Duration":              { icon: "clock",   color: [22,163,74]   },
}

const PDF_REPORT_STYLE = {
    ink: [17, 24, 39],
    subtext: [71, 85, 105],
    line: [226, 232, 240],
    surface: [248, 250, 252],
    surfaceAlt: [241, 245, 249],
    indigo: [79, 70, 229],
    blue: [14, 165, 233],
    slate: [30, 41, 59]
}

function drawMetaPill(pdf, text, x, y, fill, textColor = [30, 41, 59]) {
    const width = pdf.getTextWidth(text) + 7
    pdf.setFillColor(...fill)
    pdf.roundedRect(x, y, width, 7, 3.5, 3.5, "F")
    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(8.5)
    pdf.setTextColor(...textColor)
    pdf.text(text, x + 3.5, y + 4.6)
    return width
}

function getModernTableOptions(pdf, startY, accent, bodyRows) {
    return {
        startY,
        head: [["Metric", "Value"]],
        body: bodyRows,
        theme: "plain",
        margin: { left: 12, right: 12 },
        styles: {
            fontSize: 10,
            textColor: PDF_REPORT_STYLE.ink,
            lineColor: PDF_REPORT_STYLE.line,
            lineWidth: 0.2,
            cellPadding: { top: 4, bottom: 4, left: 8, right: 5 }
        },
        headStyles: {
            fillColor: accent,
            textColor: [255, 255, 255],
            fontStyle: "bold",
            halign: "left",
            cellPadding: { top: 4.5, bottom: 4.5, left: 8, right: 5 }
        },
        alternateRowStyles: {
            fillColor: PDF_REPORT_STYLE.surface
        },
        bodyStyles: {
            fillColor: [255, 255, 255]
        },
        tableLineColor: PDF_REPORT_STYLE.line,
        tableLineWidth: 0.2,
        didParseCell: (data) => {
            if (data.section === "body" && data.row.index % 2 === 1) {
                data.cell.styles.fillColor = PDF_REPORT_STYLE.surfaceAlt
            }
        },
        willDrawCell: (data) => {
            if (data.section === "body" && data.column.index === 1) {
                data.cell.styles.fontStyle = "bold"
            }
        },
        didDrawCell: function(data) {
            if (data.section === "body" && data.column.index === 0) {
                const label = data.cell.raw
                const mi = METRIC_ICONS[label]
                if (mi) {
                    const cx = data.cell.x + 3
                    const cy = data.cell.y + data.cell.height / 2
                    pdfIcon(pdf, mi.icon, cx, cy, 1.6, mi.color)
                }
            }
        }
    }
}

function addSectionHeader(pdf, title, y) {

    const si = SECTION_ICONS[title]
    const accent = si?.color || PDF_REPORT_STYLE.indigo

    pdf.setFillColor(...PDF_REPORT_STYLE.surface)
    pdf.roundedRect(10, y - 5, 190, 12, 3, 3, "F")
    pdf.setDrawColor(...PDF_REPORT_STYLE.line)
    pdf.setLineWidth(0.2)
    pdf.roundedRect(10, y - 5, 190, 12, 3, 3, "S")

    pdf.setFillColor(...accent)
    pdf.roundedRect(13, y - 2, 7, 6, 2, 2, "F")
    if (si) pdfIcon(pdf, si.icon, 16.5, y + 1, 1.6, [255, 255, 255])

    pdf.setFontSize(11)
    pdf.setFont("helvetica", "bold")
    pdf.setTextColor(...PDF_REPORT_STYLE.ink)
    pdf.text(title, 24, y + 1.4)

    pdf.setDrawColor(...accent)
    pdf.setLineWidth(0.7)
    pdf.line(160, y + 1.4, 196, y + 1.4)

    pdf.setFont("helvetica", "normal")
    pdf.setTextColor(0)

    return y + 14
}

function drawPageHeader(pdf) {

    const w = pdf.internal.pageSize.width

    pdf.setFillColor(...PDF_REPORT_STYLE.slate)
    pdf.rect(0, 0, w, PAGE_HEADER_HEIGHT, "F")
    pdf.setFillColor(79, 70, 229)
    pdf.rect(0, 0, w * 0.7, PAGE_HEADER_HEIGHT, "F")
    pdf.setFillColor(37, 99, 235)
    pdf.rect(w * 0.7, 0, w * 0.3, PAGE_HEADER_HEIGHT, "F")
    pdf.setFillColor(99, 102, 241)
    pdf.circle(w - 18, 8, 10, "F")
    pdf.setFillColor(56, 189, 248)
    pdf.circle(w - 6, 18, 7, "F")

    pdfIcon(pdf, "rocket", 10, PAGE_HEADER_HEIGHT / 2, 4, [255, 255, 255])

    pdf.setFontSize(17)
    pdf.setFont("helvetica", "bold")
    pdf.setTextColor(255, 255, 255)
    pdf.text("Playwright QA Analytics Report", 18, PAGE_HEADER_HEIGHT / 2 + 1.5)

    pdf.setFontSize(8)
    pdf.setFont("helvetica", "normal")
    pdf.setTextColor(224, 231, 255)
    pdf.text("Quality trends, execution health, and test stability in one report", 18, PAGE_HEADER_HEIGHT / 2 + 6.3)

    const stripeH = 1.2
    const stripeY = PAGE_HEADER_HEIGHT - stripeH
    const stripes = [
        [99,102,241], [34,211,238], [34,197,94],
        [251,191,36], [239,68,68],  [167,139,250]
    ]
    const sw = w / stripes.length
    stripes.forEach(([r,g,b], i) => {
        pdf.setFillColor(r, g, b)
        pdf.rect(i * sw, stripeY, sw, stripeH, "F")
    })

    pdf.setFont("helvetica", "normal")
    pdf.setTextColor(0)
}

function drawPageFooter(pdf) {

    const pageHeight = pdf.internal.pageSize.height
    const pageWidth  = pdf.internal.pageSize.width

    // thin top border line on footer
    pdf.setDrawColor(200, 200, 210)
    pdf.setLineWidth(0.3)
    pdf.line(10, pageHeight - 12, pageWidth - 10, pageHeight - 12)

    // small target icon before text
    pdfIcon(pdf, "target", 13, pageHeight - 7.5, 1.8, [99, 102, 241])

    pdf.setFontSize(7.5)
    pdf.setFont("helvetica", "normal")
    pdf.setTextColor(130, 130, 150)
    pdf.text("Playwright QA Analytics Dashboard", 18, pageHeight - 6.5)

    const pageNumber = pdf.getCurrentPageInfo().pageNumber
    pdf.text("Page " + pageNumber, pageWidth - 20, pageHeight - 6.5)

    pdf.setDrawColor(0)
    pdf.setLineWidth(0.2)
}

function addNewPage(pdf) {

    pdf.addPage()

    drawPageHeader(pdf)
    drawPageFooter(pdf)

}

function generateQAInsights(data) {

    const insights = [];

    const total = data.reduce((sum, d) => sum + (d.total || 0), 0);
    const passed = data.reduce((sum, d) => sum + (d.passed || 0), 0);
    const failed = data.reduce((sum, d) => sum + (d.failed || 0), 0);
    const flaky = data.reduce((sum, d) => sum + (d.flaky || 0), 0);

    if (total === 0) {
        insights.push("No test executions found for the selected history range.");
        return insights;
    }

    const passRate = Math.round((passed / total) * 100);

    if (passRate >= 90)
        insights.push("Test suite stability is EXCELLENT with a pass rate of " + passRate + "%.");
    else if (passRate >= 75)
        insights.push("Test suite stability is GOOD with a pass rate of " + passRate + "%.");
    else
        insights.push("Test suite stability is LOW with a pass rate of " + passRate + "%.");

    if (failed > 0)
        insights.push(failed + " test failures detected across executions.");

    if (flaky > 0)
        insights.push(flaky + " flaky tests detected which may indicate unstable automation.");

    let slowestTest = null;
    let maxDuration = 0;

    data.forEach(entry => {
        entry.results?.forEach(test => {

            // FIX: consistent Number() parsing here too
            const duration = Number(test.stop) - Number(test.start);

            if (duration > maxDuration) {
                maxDuration = duration;
                slowestTest = test.name;
            }

        });
    });

    if (slowestTest)
        insights.push("Slowest test detected: " + slowestTest);

    return insights;
}

function getInsightMeta(text) {

    const t = text.toLowerCase()

    if (t.includes("excellent"))
        return { badge: "EXCELLENT", icon: "✅", accent: "#16a34a", bg: "rgba(22,163,74,0.08)", border: "#16a34a" }

    if (t.includes("good") && t.includes("pass"))
        return { badge: "GOOD", icon: "👍", accent: "#2563eb", bg: "rgba(37,99,235,0.07)", border: "#2563eb" }

    if ((t.includes("low") && t.includes("pass")) || t.includes("warning"))
        return { badge: "WARNING", icon: "⚠️", accent: "#d97706", bg: "rgba(217,119,6,0.08)", border: "#d97706" }

    if (t.includes("failed") || t.includes("failure"))
        return { badge: "FAILED", icon: "❌", accent: "#dc2626", bg: "rgba(220,38,38,0.07)", border: "#dc2626" }

    if (t.includes("flaky") || t.includes("inconsistent"))
        return { badge: "FLAKY", icon: "🔀", accent: "#b45309", bg: "rgba(180,83,9,0.08)", border: "#b45309" }

    if (t.includes("slow") || t.includes("performance"))
        return { badge: "SLOW", icon: "🐢", accent: "#ea580c", bg: "rgba(234,88,12,0.08)", border: "#ea580c" }

    return { badge: "INFO", icon: "ℹ️", accent: "#4f46e5", bg: "rgba(79,70,229,0.07)", border: "#6366f1" }

}

function renderInsights(data) {

    const insights = getInsightsForData(data)

    const list = document.getElementById("qaInsights")
    list.innerHTML = ""

    if (insights.length === 0) {
        const isDarkEmpty = document.body.classList.contains("dark")
        list.innerHTML = `<li style="
            color:${isDarkEmpty ? "#4a5270" : "#8c91a4"};
            font-style:italic;
            padding:12px 14px;
            border-radius:8px;
            background:${isDarkEmpty ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)"};
            border:1px dashed ${isDarkEmpty ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"};
        ">No data available for the selected time range.</li>`
        return
    }

    const isDark = document.body.classList.contains("dark")
    const textColor   = isDark ? "#e2e8f0" : "#374151"
    const bgOpacity   = isDark ? "0.15"    : "0.08"

    insights.forEach(text => {

        const meta = getInsightMeta(text)
        const li = document.createElement("li")

        // bump alpha for dark so the tinted background is visible on dark canvas
        const bgColor = meta.bg.replace(/[\d.]+\)$/, bgOpacity + ")")

        li.style.cssText = `
            display:flex;
            align-items:flex-start;
            gap:10px;
            padding:10px 14px;
            border-radius:8px;
            background:${bgColor};
            border:1px solid ${meta.border}${isDark ? "44" : "33"};
            border-left:3px solid ${meta.border};
        `

        li.innerHTML = `
            <span style="font-size:15px;line-height:1.5;flex-shrink:0">${meta.icon}</span>
            <div style="flex:1;min-width:0">
                <span style="
                    display:inline-block;
                    font-size:10px;
                    font-weight:700;
                    letter-spacing:.6px;
                    text-transform:uppercase;
                    color:${meta.accent};
                    background:${bgColor};
                    border:1px solid ${meta.border}55;
                    border-radius:4px;
                    padding:1px 6px;
                    margin-bottom:4px;
                ">${meta.badge}</span>
                <p style="margin:0;font-size:13px;color:${textColor};line-height:1.5">${text}</p>
            </div>
        `

        list.appendChild(li)

    })

}

function buildRunInsightsMarkup(data) {

    const insights = getInsightsForData(data)

    if (insights.length === 0) {
        return `<div class="run-empty">No insights available for this run.</div>`
    }

    const isDark = document.body.classList.contains("dark")
    const textColor = isDark ? "#ffffff" : "#374151"
    const bgOpacity = isDark ? "0.15" : "0.08"

    return `
        <ul class="run-insights-list">
            ${insights.map(text => {
                const meta = getInsightMeta(text)
                const bgColor = meta.bg.replace(/[\d.]+\)$/, bgOpacity + ")")
                return `
                    <li style="
                        background:${bgColor};
                        border:1px solid ${meta.border}${isDark ? "44" : "33"};
                        border-left:3px solid ${meta.border};
                        color:${textColor};
                    ">
                        <strong style="color:${meta.accent};display:block;margin-bottom:4px;font-size:10px;letter-spacing:.6px;text-transform:uppercase">${meta.badge}</strong>
                        ${text}
                    </li>
                `
            }).join("")}
        </ul>
    `

}

function buildRunSlowTestsMarkup(entry) {

    const results = [...(entry.results || [])]
        .map(test => ({
            name: test.name || "-",
            status: test.status || "-",
            start: Number(test.start) || 0,
            stop: Number(test.stop) || 0
        }))
        .map(test => ({
            ...test,
            duration: Math.max(0, test.stop - test.start),
            date: test.start ? new Date(test.start).toLocaleString() : "-"
        }))
        .sort((a, b) => b.duration - a.duration)

    if (!results.length) {
        return `<div class="run-empty">No test results available for this run.</div>`
    }

    return `
        <table class="run-table">
            <thead>
                <tr>
                    <th>Test Name</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th>Duration</th>
                </tr>
            </thead>
            <tbody>
                ${results.map(test => `
                    <tr>
                        <td>${test.name}</td>
                        <td>${test.status}</td>
                        <td>${test.date}</td>
                        <td>${formatDuration(test.duration)}</td>
                    </tr>
                `).join("")}
            </tbody>
        </table>
    `

}

function initRunChartsForEntry(entry, index) {

    const label = new Date(entry.timestamp).toLocaleString()
    const passRate = getSafeRate(entry.passed || 0, entry.total || 0)
    const stabilityBase = (entry.total || 0) - (entry.flaky || 0)
    const stability = getSafeRate(entry.passed || 0, stabilityBase)

    const failureCounts = {}
    ;(entry.results || []).forEach(test => {
        if (test.status === "failed") {
            failureCounts[test.name] = (failureCounts[test.name] || 0) + 1
        }
    })

    const chartIds = {
        trend: document.getElementById(`runTrendChart-${index}`),
        pass: document.getElementById(`runPassChart-${index}`),
        status: document.getElementById(`runStatusChart-${index}`),
        flaky: document.getElementById(`runFlakyChart-${index}`),
        quality: document.getElementById(`runQualityChart-${index}`),
        heatmap: document.getElementById(`runHeatmapChart-${index}`)
    }

    if (!chartIds.trend) return

    const trend = new Chart(chartIds.trend, {
        type: "line",
        data: { labels: [label], datasets: [{ label: "Tests", data: [entry.total || 0], borderColor: "#4f6df5", tension: 0.3 }] },
        options: chartOptions()
    })

    const pass = new Chart(chartIds.pass, {
        type: "line",
        data: { labels: [label], datasets: [{ label: "Pass %", data: [passRate], borderColor: "#2ecc71", tension: 0.3 }] },
        options: chartOptions()
    })

    const status = new Chart(chartIds.status, {
        type: "doughnut",
        data: {
            labels: ["Passed", "Failed", "Flaky"],
            datasets: [{
                data: [entry.passed || 0, entry.failed || 0, entry.flaky || 0],
                backgroundColor: ["#2ecc71", "#e74c3c", "#f1c40f"],
                radius: "95%"
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: "45%",
            plugins: {
                legend: {
                    position: "top",
                    labels: { color: getChartTheme().text, boxWidth: 12, padding: 16 }
                }
            }
        }
    })

    const flaky = new Chart(chartIds.flaky, {
        type: "line",
        data: { labels: [label], datasets: [{ label: "Flaky", data: [entry.flaky || 0], borderColor: "#f39c12", tension: 0.3 }] },
        options: chartOptions()
    })

    const quality = new Chart(chartIds.quality, {
        type: "line",
        data: {
            labels: [label],
            datasets: [
                { label: "Pass Rate %", data: [passRate], borderColor: "#27ae60", backgroundColor: "rgba(39,174,96,0.2)", tension: 0.3 },
                { label: "Stability %", data: [stability], borderColor: "#8e44ad", backgroundColor: "rgba(142,68,173,0.2)", tension: 0.3 }
            ]
        },
        options: chartOptions({ plugins: { legend: { position: "top", labels: { color: getChartTheme().text } } } })
    })

    const heatmap = new Chart(chartIds.heatmap, {
        type: "bar",
        data: {
            labels: Object.keys(failureCounts),
            datasets: [{
                label: "Failures",
                data: Object.values(failureCounts),
                backgroundColor: "rgba(255, 99, 132, 0.7)"
            }]
        },
        options: chartOptions({
            plugins: { legend: { display: true, labels: { color: getChartTheme().text } }, tooltip: { enabled: true } },
            scales: {
                x: { title: { display: true, text: "Test Name", color: getChartTheme().text }, ticks: { color: getChartTheme().subtext }, grid: { color: getChartTheme().grid } },
                y: { title: { display: true, text: "Failure Count", color: getChartTheme().text }, ticks: { color: getChartTheme().subtext }, grid: { color: getChartTheme().grid }, beginAtZero: true }
            }
        })
    })

    runAccordionCharts.push(trend, pass, status, flaky, quality, heatmap)
}

function renderRunAccordion(data) {

    const container = document.getElementById("runAccordion")
    if (!container) return

    destroyRunAccordionCharts()
    container.innerHTML = ""

    if (!Array.isArray(data) || data.length === 0) {
        container.innerHTML = `<div class="run-empty">No runs available for the selected history range.</div>`
        return
    }

    const orderedRuns = [...data].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))

    orderedRuns.forEach((entry, index) => {
        const total = entry.total || 0
        const passRate = getSafeRate(entry.passed || 0, total)

        const item = document.createElement("div")
        item.className = "run-accordion-item"
        item.innerHTML = `
            <button class="run-accordion-toggle" type="button">
                <div class="run-accordion-meta">
                    <div class="run-accordion-title">Run ${orderedRuns.length - index} • ${new Date(entry.timestamp).toLocaleString()}</div>
                    <div class="run-accordion-subtitle">${total} tests executed in this run with a ${passRate}% pass rate.</div>
                </div>
                <div class="run-accordion-badges">
                    <span class="run-badge">Total: ${total}</span>
                    <span class="run-badge status-passed">Passed: ${entry.passed || 0}</span>
                    <span class="run-badge status-failed">Failed: ${entry.failed || 0}</span>
                    <span class="run-badge status-flaky">Flaky: ${entry.flaky || 0}</span>
                </div>
            </button>
            <div class="run-accordion-panel"></div>
        `

        const toggle = item.querySelector(".run-accordion-toggle")
        const panel = item.querySelector(".run-accordion-panel")

        toggle.onclick = () => {
            const isOpen = item.classList.contains("open")

            document.querySelectorAll(".run-accordion-item.open").forEach(openItem => {
                if (openItem !== item) openItem.classList.remove("open")
            })

            item.classList.toggle("open", !isOpen)

            if (!isOpen && !panel.dataset.rendered) {
                panel.innerHTML = `
                    <div class="run-dashboard">
                        <div class="run-dashboard-grid">
                            <div class="run-kpi">
                                <div class="run-kpi-label">Total Tests</div>
                                <div class="run-kpi-value">${entry.total || 0}</div>
                            </div>
                            <div class="run-kpi">
                                <div class="run-kpi-label">Passed</div>
                                <div class="run-kpi-value">${entry.passed || 0}</div>
                            </div>
                            <div class="run-kpi">
                                <div class="run-kpi-label">Failed</div>
                                <div class="run-kpi-value">${entry.failed || 0}</div>
                            </div>
                            <div class="run-kpi">
                                <div class="run-kpi-label">Flaky</div>
                                <div class="run-kpi-value">${entry.flaky || 0}</div>
                            </div>
                        </div>

                        <div class="run-section-grid">
                            <div class="run-section-card">
                                <h4>Run Insights</h4>
                                ${buildRunInsightsMarkup([entry])}
                            </div>
                            <div class="run-section-card">
                                <h4>Run Metadata</h4>
                                <table class="run-table">
                                    <tbody>
                                        <tr><td>Timestamp</td><td>${new Date(entry.timestamp).toLocaleString()}</td></tr>
                                        <tr><td>Pass Rate</td><td>${passRate}%</td></tr>
                                        <tr><td>Results in Run</td><td>${(entry.results || []).length}</td></tr>
                                        <tr><td>Slowest Test</td><td>${((entry.results || []).map(test => ({ name: test.name, duration: Number(test.stop) - Number(test.start) })).sort((a, b) => b.duration - a.duration)[0] || { name: "-" }).name}</td></tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div class="run-charts-grid">
                            <div class="run-chart-card"><h4>Execution Trend</h4><canvas id="runTrendChart-${index}"></canvas></div>
                            <div class="run-chart-card"><h4>Pass Rate</h4><canvas id="runPassChart-${index}"></canvas></div>
                            <div class="run-chart-card"><h4>Status Distribution</h4><canvas id="runStatusChart-${index}"></canvas></div>
                            <div class="run-chart-card"><h4>Flaky Trend</h4><canvas id="runFlakyChart-${index}"></canvas></div>
                            <div class="run-chart-card"><h4>Pass Rate vs Stability</h4><canvas id="runQualityChart-${index}"></canvas></div>
                            <div class="run-chart-card"><h4>Failure Heatmap</h4><canvas id="runHeatmapChart-${index}"></canvas></div>
                        </div>

                        <div class="run-section-card">
                            <h4>Slowest Tests In This Run</h4>
                            ${buildRunSlowTestsMarkup(entry)}
                        </div>
                    </div>
                `

                initRunChartsForEntry(entry, index)
                panel.dataset.rendered = "true"
            }
        }

        container.appendChild(item)
    })
}

function generateFailureAnalysis(data) {

    const failures = {};

    data.forEach(entry => {

        entry.results?.forEach(test => {

            if (test.status === "failed") {

                if (!failures[test.name]) {
                    failures[test.name] = {
                        count: 0,
                        error: test.error || ""
                    };
                }

                failures[test.name].count++;

            }

        });

    });

    const insights = [];

    Object.keys(failures).forEach(testName => {

        const failCount = failures[testName].count;
        const error = failures[testName].error;

        if (failCount >= 1) {

            let hint = "";

            if (error.toLowerCase().includes("url"))
                hint = " — possible endpoint issue.";

            else if (error.toLowerCase().includes("timeout"))
                hint = " — possible network or performance issue.";

            else if (error.toLowerCase().includes("locator"))
                hint = " — possible UI locator issue.";

            insights.push(`${testName} failed ${failCount} time(s)${hint}`);

        }

    });

    return insights;
}

function detectPerformanceRegression(data) {

    const durations = {};

    data.forEach(entry => {

        entry.results?.forEach(test => {

            // FIX: consistent Number() parsing
            const duration = Number(test.stop) - Number(test.start);

            if (!durations[test.name])
                durations[test.name] = [];

            durations[test.name].push(duration);

        });

    });

    const insights = [];

    Object.keys(durations).forEach(test => {

        const times = durations[test];

        if (times.length >= 2) {

            const first = times[0];
            const last = times[times.length - 1];

            if (last > first * 2) {

                insights.push(
                    `${test} execution time increased significantly (possible performance regression)`
                );

            }

        }

    });

    return insights;
}

function detectFlakyTests(data) {

    const statusMap = {};

    data.forEach(entry => {

        entry.results?.forEach(test => {

            if (!statusMap[test.name])
                statusMap[test.name] = new Set();

            statusMap[test.name].add(test.status);

        });

    });

    const insights = [];

    Object.keys(statusMap).forEach(test => {

        const statuses = statusMap[test];

        if (statuses.has("passed") && statuses.has("failed")) {

            insights.push(
                `${test} shows inconsistent results — possible flaky test.`
            );

        }

    });

    return insights;
}

function updateFailureHeatmap(data) {

    const failureCounts = {};

    data.forEach(entry => {

        entry.results?.forEach(test => {

            if (test.status === "failed") {

                if (!failureCounts[test.name])
                    failureCounts[test.name] = 0;

                failureCounts[test.name]++;

            }

        });

    });

    const labels = Object.keys(failureCounts);
    const values = Object.values(failureCounts);

    failureHeatmap.data.labels = labels;
    failureHeatmap.data.datasets[0].data = values;

    failureHeatmap.update();
}

loadDashboard()

/* =============================================
   DARK MODE TOGGLE
   ============================================= */

function initThemeToggle() {

    const btn = document.getElementById("themeToggle")
    const icon = document.getElementById("themeIcon")

    if (!btn) {
        console.warn("themeToggle button not found in HTML — add it to index.html")
        return
    }

    function updateIcon() {
        if (icon) icon.textContent = document.body.classList.contains("dark") ? "🌙" : "☀️"
    }

    // Apply correct chart colours for whichever theme is active on load
    applyChartTheme()
    updateIcon()

    btn.addEventListener("click", function (e) {
        e.stopPropagation()
        document.body.classList.toggle("dark")
        const isDark = document.body.classList.contains("dark")
        localStorage.setItem("qa-theme", isDark ? "dark" : "light")
        updateIcon()
        // Re-colour all charts immediately
        applyChartTheme()
        // Re-render insights so inline text/bg colours update too
        if (currentFilteredData.length) {
            renderInsights(currentFilteredData)
            renderRunAccordion(currentFilteredData)
        }
    })

}

// Wire up after DOM is ready
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initThemeToggle)
} else {
    initThemeToggle()
}
