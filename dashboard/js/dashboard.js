// Apply saved theme before first paint to prevent flash
if (localStorage.getItem("qa-theme") === "dark") document.body.classList.add("dark")

let currentFilteredData = [];

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
        text:    dark ? "#818cf8" : "#52576b",
        subtext: dark ? "#4a5270" : "#8c91a4",
        grid:    dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)"
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

    ;[trendChart, passChart, flakyChart, qualityChart, failureHeatmap, statusChart]
        .forEach(patchOne)
}

function applyChartTheme() {
    const t = getChartTheme()
    patchChartsWithTheme(t)
}

let historyData = []

async function loadDashboard() {

    const res = await fetch("./data/history.json")
    historyData = await res.json()

    updateDashboard(historyData)

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

document.getElementById("exportExcel").onclick = () => {

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

};

document.getElementById("exportCSV").onclick = () => {

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

}

/* HISTORY FILTER */

document.querySelectorAll("#historyDropdown .dropdown-menu button").forEach(btn => {

    btn.onclick = (e) => {

        e.stopPropagation();

        const range = btn.dataset.range;
        historyLabel.innerText = btn.innerText;

        let filtered = [...historyData];
        const now = new Date();

        if (range === "today") {
            filtered = historyData.filter(r =>
                new Date(r.timestamp).toDateString() === now.toDateString()
            );
        }

        if (range === "7") {
            filtered = historyData.filter(r =>
                now - new Date(r.timestamp) < 7 * 86400000
            );
        }

        if (range === "30") {
            filtered = historyData.filter(r =>
                now - new Date(r.timestamp) < 30 * 86400000
            );
        }

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

    Chart.defaults.devicePixelRatio = 3;

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

    pdf.setFontSize(9)
    pdf.setTextColor(30, 58, 138)

    pdf.text("History Range: " + filter, 10, y - 5)
    pdf.text("Generated: " + new Date().toLocaleString(), 150, y - 5)

    y += 3

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

    pdf.autoTable({
        startY: y,
        head: [["Metric", "Value"]],
        body: summaryRows,
        theme: "grid",
        styles: { fontSize: 10, cellPadding: { top: 3, bottom: 3, left: 8, right: 3 } },
        headStyles: { fillColor: [79, 70, 229], fontStyle: "bold" },
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
    });

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

        pdf.autoTable({
            startY: y,
            head: [statsData[0]],
            body: statsData.slice(1),
            theme: "grid",
            styles: { fontSize: 10, cellPadding: { top: 3, bottom: 3, left: 8, right: 3 } },
            headStyles: { fillColor: [14, 165, 233], fontStyle: "bold" },
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
        })

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

    const statusImg = statusChart.toBase64Image();
    const trendImg = trendChart.toBase64Image();
    const passImg = passChart.toBase64Image();
    const flakyImg = flakyChart.toBase64Image();
    const qualityImg = qualityChart.toBase64Image();
    const heatmapImg = failureHeatmap.toBase64Image();

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

    pdf.addImage(statusImg, "PNG", 10, y, 90, 60);
    pdf.addImage(trendImg,  "PNG", 110, y, 90, 60);

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

    pdf.addImage(passImg,  "PNG", 10,  y, 90, 60);
    pdf.addImage(flakyImg, "PNG", 110, y, 90, 60);

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

    pdf.addImage(qualityImg, "PNG", 10, y, 90, 60);
    pdf.addImage(heatmapImg, "PNG", 110, y, 90, 60);

    const exportFilter = document.getElementById("historyLabel").innerText
        .replace(/\s+/g, "-")
        .replace(/[^a-zA-Z0-9\-]/g, "")

    const now = new Date()
    const pad = n => String(n).padStart(2, "0")
    const exportTs = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`

    pdf.save(`Playwright-QA-Report_${exportFilter}_${exportTs}.pdf`);

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

function addSectionHeader(pdf, title, y) {

    // background band
    pdf.setFillColor(232, 234, 255)
    pdf.rect(0, y - 6, 210, 11, "F")

    // left accent bar
    pdf.setFillColor(79, 70, 229)
    pdf.rect(0, y - 6, 3, 11, "F")

    // icon
    const si = SECTION_ICONS[title]
    if (si) pdfIcon(pdf, si.icon, 9, y + 0.5, 2.5, si.color)

    // title text
    pdf.setFontSize(11)
    pdf.setFont("helvetica", "bold")
    pdf.setTextColor(30, 58, 138)
    pdf.text(title, si ? 15 : 8, y + 0.8)

    pdf.setFont("helvetica", "normal")
    pdf.setTextColor(0)

    return y + 13
}

function drawPageHeader(pdf) {

    const w = pdf.internal.pageSize.width

    // gradient-like: two overlapping rects
    pdf.setFillColor(67, 56, 202)
    pdf.rect(0, 0, w, PAGE_HEADER_HEIGHT, "F")
    pdf.setFillColor(79, 70, 229)
    pdf.rect(0, 0, w * 0.6, PAGE_HEADER_HEIGHT, "F")

    // rocket icon top-left
    pdfIcon(pdf, "rocket", 10, PAGE_HEADER_HEIGHT / 2, 4, [255, 255, 255])

    // title
    pdf.setFontSize(16)
    pdf.setFont("helvetica", "bold")
    pdf.setTextColor(255, 255, 255)
    pdf.text("Playwright QA Analytics Report", 18, PAGE_HEADER_HEIGHT / 2 + 2)

    // thin rainbow strip at bottom of header
    const stripeH = 1.5
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

    const insights = [
        ...generateQAInsights(data),
        ...generateFailureAnalysis(data),
        ...detectFlakyTests(data),
        ...detectPerformanceRegression(data)
    ]

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
        if (currentFilteredData.length) renderInsights(currentFilteredData)
    })

}

// Wire up after DOM is ready
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initThemeToggle)
} else {
    initThemeToggle()
}