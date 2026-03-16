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

let trendChart = new Chart(document.getElementById("trendChart"), {
    type: "line",
    data: { labels: [], datasets: [{ label: "Tests", data: [], borderColor: "#4f6df5" }] },
    options: { responsive: true, maintainAspectRatio: false }
})

let passChart = new Chart(document.getElementById("passChart"), {
    type: "line",
    data: { labels: [], datasets: [{ label: "Pass %", data: [], borderColor: "#2ecc71" }] },
    options: { responsive: true, maintainAspectRatio: false }
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
    options: { responsive: true, maintainAspectRatio: false }
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
    options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: "top" }
        }
    }
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
    options: {
        responsive: true,
        plugins: {
            legend: {
                display: true
            },
            tooltip: {
                enabled: true
            }
        },
        scales: {
            x: {
                title: {
                    display: true,
                    text: "Test Name"
                }
            },
            y: {
                title: {
                    display: true,
                    text: "Failure Count"
                },
                beginAtZero: true
            }
        }
    }
});

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

        document.getElementById("slowTests").innerHTML =
            `<tr><td colspan="4" style="text-align:center">No slow tests available</td></tr>`;

        return;

    }

    slowTestsData = allResults.map(t => ({
        name: t.name || "-",
        status: t.status || "-",
        date: new Date(t.start),
        duration: new Date(t.stop) - new Date(t.start)
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

    XLSX.writeFile(wb, "slowest-tests.xlsx");

};

document.getElementById("exportCSV").onclick = () => {

    let csv = "Test Name,Status,Date,Duration\n";

    filteredSlowTests.forEach(t => {

        csv += `${t.name},${t.status},${t.date.toLocaleString()},${formatDuration(t.duration)}\n`;

    });

    const blob = new Blob([csv], { type: "text/csv" });

    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");

    a.href = url;

    a.download = "slowest-tests.csv";

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

    // Aggregate totals from all filtered entries
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

    // Populate Slowest Tests
    if (data.length > 0) {
        populateSlowTests(data);
        renderInsights(data);
    }


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

        updateDashboard(filtered);
        renderInsights(filtered);
        populateSlowTests(filtered);

        closeAllDropdowns();

    }

})

/* DOWNLOAD */

document.getElementById("downloadPDF").onclick = generateProfessionalReport;
const PAGE_HEADER_HEIGHT = 25
const PAGE_TOP_MARGIN = 35
const PAGE_BOTTOM_MARGIN = 15
function calculateExecutionStats(data) {

    let durations = []
    let totalDuration = 0
    let slowest = null
    let fastest = null

    data.forEach(entry => {

        entry.results?.forEach(test => {

            if (!test.start || !test.stop) return

            const duration =
                new Date(test.stop).getTime() -
                new Date(test.start).getTime()

            if (duration <= 0) return

            durations.push({
                name: test.name,
                duration: duration
            })

            totalDuration += duration

            if (!slowest || duration > slowest.duration)
                slowest = { name: test.name, duration }

            if (!fastest || duration < fastest.duration)
                fastest = { name: test.name, duration }

        })

    })

    if (durations.length === 0) return null

    const avgDuration = Math.round(totalDuration / durations.length)

    return {
        average: avgDuration,
        slowest,
        fastest,
        total: totalDuration
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

function generateProfessionalReport() {

    closeAllDropdowns();
    prepareHighResCharts();

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF("p", "mm", "a4");

    let y = 25;

    const total = document.getElementById("totalTests").innerText;
    const passed = document.getElementById("passedTests").innerText;
    const failed = document.getElementById("failedTests").innerText;
    const flaky = document.getElementById("flakyTests").innerText;
    const trendMini = document.getElementById("trendChart")
    const trendMiniImg = trendMini.toDataURL("image/png")

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

    y += 3   // push content down after filter text

    /* ------------------------------------------------ */
    /* QA SUMMARY + QA INSIGHTS */
    /* ------------------------------------------------ */

    y = addSectionHeader(pdf, "QA Summary & Insights", y);

    /* QA SUMMARY TABLE */

    pdf.setFontSize(12);
    pdf.text("QA Summary", 10, y);

    const summaryRows = [
        ["Total Tests Executed", total],
        ["Passed Tests", passed],
        ["Failed Tests", failed],
        ["Flaky Tests", flaky],
        ["Pass Rate", passRate + "%"],
        ["Quality Score", (passRate - (flaky / total * 100)).toFixed(1) + "%"]
    ];

    pdf.autoTable({
        startY: y + 4,
        margin: { left: 10 },
        tableWidth: 90,
        head: [["Metric", "Value"]],
        body: summaryRows,
        theme: "grid",
        styles: { fontSize: 10 },
        headStyles: { fillColor: [79, 70, 229] }
    });

    /* Get correct Y after table */

    let tableEndY = pdf.lastAutoTable.finalY;

    /* QA INSIGHTS */

    pdf.setFontSize(12);
    pdf.text("QA Insights", 110, y);

    pdf.setFontSize(10);

    let iy = y + 8;

    insights.forEach(text => {
        pdf.text("• " + text, 110, iy);
        iy += 6;
    });


    /* Move Y correctly after the bigger of the two columns */

    y = Math.max(tableEndY, iy) + 10;

    const stats = calculateExecutionStats(currentFilteredData)

    if (stats) {

        y = addSectionHeader(pdf, "Execution Statistics", y)

        const statsData = [
            ["Metric", "Value"],
            ["Average Test Duration", formatDuration(stats.average)],
            ["Slowest Test", stats.slowest.name],
            ["Slowest Duration", formatDuration(stats.slowest.duration)],
            ["Fastest Test", stats.fastest.name],
            ["Fastest Duration", formatDuration(stats.fastest.duration)],
            ["Total Execution Time", formatDuration(stats.total)]
        ]

        pdf.autoTable({

            startY: y,

            head: [statsData[0]],

            body: statsData.slice(1),

            theme: "grid",

            styles: {
                fontSize: 10
            }

        })

        y = pdf.lastAutoTable.finalY + 10

    }

    y = addSectionHeader(pdf, "Execution Trend", y)

    pdf.addImage(trendMiniImg, "PNG", 10, y, 180, 50)

    addNewPage(pdf);

    y = PAGE_TOP_MARGIN;

    /* ------------------------------------------------ */
    /* CHARTS */
    /* ------------------------------------------------ */

    y = addSectionHeader(pdf, "Analytics Charts", y - 4);

    const statusImg = statusChart.toBase64Image();
    const trendImg = trendChart.toBase64Image();
    const passImg = passChart.toBase64Image();
    const flakyImg = flakyChart.toBase64Image();
    const qualityImg = qualityChart.toBase64Image();
    const heatmapImg = failureHeatmap.toBase64Image();

    pdf.setFontSize(11);

    pdf.text("Status Distribution", 10, y);
    pdf.text("Execution Trend", 110, y);

    y += 4;

    pdf.addImage(statusImg, "PNG", 10, y, 90, 60);
    pdf.addImage(trendImg, "PNG", 110, y, 90, 60);

    y += 70;

    pdf.text("Pass Rate Trend", 10, y);
    pdf.text("Flaky Trend", 110, y);

    y += 4;

    pdf.addImage(passImg, "PNG", 10, y, 90, 60);
    pdf.addImage(flakyImg, "PNG", 110, y, 90, 60);

    addNewPage(pdf);

    y = PAGE_TOP_MARGIN;

    y = addSectionHeader(pdf, "Advanced Analytics", y - 4);

    pdf.setFontSize(11);

    pdf.text("Stability Trend", 10, y);
    pdf.text("Failure Heatmap", 110, y);

    y += 4;

    pdf.addImage(qualityImg, "PNG", 10, y, 90, 60);
    pdf.addImage(heatmapImg, "PNG", 110, y, 90, 60);

    pdf.setFontSize(11);


    pdf.save("Playwright-QA-Analytics-Report.pdf");
}

// SECTION HEADER
function addSectionHeader(pdf, title, y) {

    pdf.setFillColor(224, 231, 255);
    pdf.rect(0, y - 6, 210, 10, "F");

    pdf.setFontSize(14);
    pdf.setTextColor(30, 58, 138);
    pdf.text(title, 10, y);

    pdf.setTextColor(0);

    return y + 10;
}

// HEADER
function drawPageHeader(pdf) {

    pdf.setFillColor(79, 70, 229)
    pdf.rect(0, 0, 210, PAGE_HEADER_HEIGHT, "F")

    pdf.setFontSize(18)
    pdf.setTextColor(255)
    pdf.text("Playwright QA Analytics Report", 10, 15)


    pdf.setTextColor(0)
}

// FOOTER
function drawPageFooter(pdf) {

    const pageHeight = pdf.internal.pageSize.height
    const pageWidth = pdf.internal.pageSize.width

    pdf.setFontSize(8)
    pdf.setTextColor(120)

    pdf.text("Playwright QA Analytics Dashboard", 10, pageHeight - 8)

    const pageNumber = pdf.getCurrentPageInfo().pageNumber

    pdf.text(
        "Page " + pageNumber,
        pageWidth - 25,
        pageHeight - 8
    )
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

    // Pass rate insight
    if (passRate >= 90)
        insights.push("Test suite stability is EXCELLENT with a pass rate of " + passRate + "%.");
    else if (passRate >= 75)
        insights.push("Test suite stability is GOOD with a pass rate of " + passRate + "%.");
    else
        insights.push("Test suite stability is LOW with a pass rate of " + passRate + "%.");

    // Failures
    if (failed > 0)
        insights.push(failed + " test failures detected across executions.");

    // Flaky tests
    if (flaky > 0)
        insights.push(flaky + " flaky tests detected which may indicate unstable automation.");

    // Find slowest test
    let slowestTest = null;
    let maxDuration = 0;

    data.forEach(entry => {
        entry.results?.forEach(test => {

            const duration = test.stop - test.start;

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
function renderInsights(data) {

    const insights = [

        ...generateQAInsights(data),

        ...generateFailureAnalysis(data),

        ...detectFlakyTests(data),

        ...detectPerformanceRegression(data)

    ];

    const list = document.getElementById("qaInsights")

    list.innerHTML = ""

    insights.forEach(text => {

        const li = document.createElement("li")

        li.innerText = text

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

            const duration = test.stop - test.start;

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