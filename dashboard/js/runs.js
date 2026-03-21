if (localStorage.getItem("qa-theme") === "dark") document.body.classList.add("dark")

let activeHistoryData = []
let currentHistoryRange = "all"
let currentRunPageData = []
let runAccordionCharts = []
const archiveCache = {}

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

function getChartTheme() {
    const dark = document.body.classList.contains("dark")
    return {
        text: dark ? "#ffffff" : "#52576b",
        subtext: dark ? "#ffffff" : "#8c91a4",
        grid: dark ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.05)"
    }
}

function chartOptions(extra = {}) {
    const t = getChartTheme()
    return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { labels: { color: t.text } }
        },
        scales: {
            x: { ticks: { color: t.subtext }, grid: { color: t.grid }, title: { color: t.text } },
            y: { ticks: { color: t.subtext }, grid: { color: t.grid }, title: { color: t.text } }
        },
        ...extra
    }
}

function patchChartsWithTheme(t) {
    runAccordionCharts.forEach(chart => {
        const cfg = chart.config.options
        const sc = cfg.scales
        if (sc) {
            ;["x", "y"].forEach(axis => {
                if (!sc[axis]) return
                if (!sc[axis].ticks) sc[axis].ticks = {}
                if (!sc[axis].grid) sc[axis].grid = {}
                if (!sc[axis].border) sc[axis].border = {}
                sc[axis].ticks.color = t.subtext
                sc[axis].grid.color = t.grid
                sc[axis].border.color = t.grid
                if (sc[axis].title) sc[axis].title.color = t.text
            })
        }
        if (!cfg.plugins) cfg.plugins = {}
        if (!cfg.plugins.legend) cfg.plugins.legend = {}
        if (!cfg.plugins.legend.labels) cfg.plugins.legend.labels = {}
        cfg.plugins.legend.labels.color = t.text
        chart.update("none")
    })
}

function applyChartTheme() {
    patchChartsWithTheme(getChartTheme())
}

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

async function getHistoryDataForRange(range) {
    let combined = [...activeHistoryData]

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

    if (range === "7") return filterEntriesByDays(sorted, 7)
    if (range === "30") return filterEntriesByDays(sorted, 30)

    return sorted
}

function formatDuration(ms) {
    if (!ms || ms <= 0) return "0 hr 0 min 0 sec"
    const sec = Math.floor(ms / 1000) % 60
    const min = Math.floor(ms / 60000) % 60
    const hr = Math.floor(ms / 3600000)
    return `${hr} hr ${min} min ${sec} sec`
}

function getSafeRate(numerator, denominator) {
    if (!denominator || denominator <= 0) return 0
    return Math.round((numerator / denominator) * 100)
}

function generateQAInsights(data) {
    const insights = []
    const total = data.reduce((sum, d) => sum + (d.total || 0), 0)
    const passed = data.reduce((sum, d) => sum + (d.passed || 0), 0)
    const failed = data.reduce((sum, d) => sum + (d.failed || 0), 0)
    const flaky = data.reduce((sum, d) => sum + (d.flaky || 0), 0)

    if (total === 0) {
        insights.push("No test executions found for the selected history range.")
        return insights
    }

    const passRate = Math.round((passed / total) * 100)
    if (passRate >= 90) insights.push(`Test suite stability is excellent with a pass rate of ${passRate}%.`)
    else if (passRate >= 75) insights.push(`Test suite stability is good with a pass rate of ${passRate}%.`)
    else insights.push(`Test suite stability is low with a pass rate of ${passRate}%.`)

    if (failed > 0) insights.push(`${failed} test failures detected across executions.`)
    if (flaky > 0) insights.push(`${flaky} flaky tests detected which may indicate unstable automation.`)

    let slowestTest = null
    let maxDuration = 0
    data.forEach(entry => {
        entry.results?.forEach(test => {
            const duration = Number(test.stop) - Number(test.start)
            if (duration > maxDuration) {
                maxDuration = duration
                slowestTest = test.name
            }
        })
    })

    if (slowestTest) insights.push(`Slowest test detected: ${slowestTest}`)
    return insights
}

function generateFailureAnalysis(data) {
    const failures = {}
    data.forEach(entry => {
        entry.results?.forEach(test => {
            if (test.status === "failed") {
                if (!failures[test.name]) failures[test.name] = { count: 0, error: test.error || "" }
                failures[test.name].count++
            }
        })
    })

    return Object.keys(failures).map(testName => {
        const failCount = failures[testName].count
        const error = failures[testName].error.toLowerCase()
        let hint = ""
        if (error.includes("url")) hint = " possible endpoint issue."
        else if (error.includes("timeout")) hint = " possible network or performance issue."
        else if (error.includes("locator")) hint = " possible UI locator issue."
        return `${testName} failed ${failCount} time(s).${hint}`
    })
}

function detectPerformanceRegression(data) {
    const durations = {}
    data.forEach(entry => {
        entry.results?.forEach(test => {
            const duration = Number(test.stop) - Number(test.start)
            if (!durations[test.name]) durations[test.name] = []
            durations[test.name].push(duration)
        })
    })

    const insights = []
    Object.keys(durations).forEach(test => {
        const times = durations[test]
        if (times.length >= 2) {
            const first = times[0]
            const last = times[times.length - 1]
            if (last > first * 2) {
                insights.push(`${test} execution time increased significantly.`)
            }
        }
    })
    return insights
}

function detectFlakyTests(data) {
    const statusMap = {}
    data.forEach(entry => {
        entry.results?.forEach(test => {
            if (!statusMap[test.name]) statusMap[test.name] = new Set()
            statusMap[test.name].add(test.status)
        })
    })
    return Object.keys(statusMap)
        .filter(test => statusMap[test].has("passed") && statusMap[test].has("failed"))
        .map(test => `${test} shows inconsistent results and may be flaky.`)
}

function getInsightsForData(data) {
    return [
        ...generateQAInsights(data),
        ...generateFailureAnalysis(data),
        ...detectFlakyTests(data),
        ...detectPerformanceRegression(data)
    ]
}

function getInsightMeta(text) {
    const t = text.toLowerCase()
    if (t.includes("excellent")) return { badge: "EXCELLENT", accent: "#16a34a", bg: "rgba(22,163,74,0.08)", border: "#16a34a" }
    if (t.includes("good") && t.includes("pass")) return { badge: "GOOD", accent: "#2563eb", bg: "rgba(37,99,235,0.07)", border: "#2563eb" }
    if ((t.includes("low") && t.includes("pass")) || t.includes("warning")) return { badge: "WARNING", accent: "#d97706", bg: "rgba(217,119,6,0.08)", border: "#d97706" }
    if (t.includes("failed") || t.includes("failure")) return { badge: "FAILED", accent: "#dc2626", bg: "rgba(220,38,38,0.07)", border: "#dc2626" }
    if (t.includes("flaky") || t.includes("inconsistent")) return { badge: "FLAKY", accent: "#b45309", bg: "rgba(180,83,9,0.08)", border: "#b45309" }
    if (t.includes("slow") || t.includes("performance")) return { badge: "SLOW", accent: "#ea580c", bg: "rgba(234,88,12,0.08)", border: "#ea580c" }
    return { badge: "INFO", accent: "#4f46e5", bg: "rgba(79,70,229,0.07)", border: "#6366f1" }
}

function buildRunInsightsMarkup(data) {
    const insights = getInsightsForData(data)
    if (!insights.length) return `<div class="run-empty">No insights available for this run.</div>`

    const isDark = document.body.classList.contains("dark")
    const textColor = isDark ? "#ffffff" : "#374151"
    const bgOpacity = isDark ? "0.15" : "0.08"

    return `
        <ul class="run-insights-list">
            ${insights.map(text => {
                const meta = getInsightMeta(text)
                const bgColor = meta.bg.replace(/[\d.]+\)$/, bgOpacity + ")")
                return `
                    <li style="background:${bgColor};border:1px solid ${meta.border}${isDark ? "44" : "33"};border-left:3px solid ${meta.border};color:${textColor}">
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
        .map(test => ({ ...test, duration: Math.max(0, test.stop - test.start), date: test.start ? new Date(test.start).toLocaleString() : "-" }))
        .sort((a, b) => b.duration - a.duration)

    if (!results.length) return `<div class="run-empty">No test results available for this run.</div>`

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

function destroyRunAccordionCharts() {
    runAccordionCharts.forEach(chart => {
        try { chart.destroy() } catch (error) {}
    })
    runAccordionCharts = []
}

function initRunChartsForEntry(entry, index) {
    const label = new Date(entry.timestamp).toLocaleString()
    const passRate = getSafeRate(entry.passed || 0, entry.total || 0)
    const stability = getSafeRate(entry.passed || 0, (entry.total || 0) - (entry.flaky || 0))

    const failureCounts = {}
    ;(entry.results || []).forEach(test => {
        if (test.status === "failed") failureCounts[test.name] = (failureCounts[test.name] || 0) + 1
    })

    const trend = new Chart(document.getElementById(`runTrendChart-${index}`), {
        type: "line",
        data: { labels: [label], datasets: [{ label: "Tests", data: [entry.total || 0], borderColor: "#4f6df5", tension: 0.3 }] },
        options: chartOptions()
    })
    const pass = new Chart(document.getElementById(`runPassChart-${index}`), {
        type: "line",
        data: { labels: [label], datasets: [{ label: "Pass %", data: [passRate], borderColor: "#2ecc71", tension: 0.3 }] },
        options: chartOptions()
    })
    const status = new Chart(document.getElementById(`runStatusChart-${index}`), {
        type: "doughnut",
        data: { labels: ["Passed", "Failed", "Flaky"], datasets: [{ data: [entry.passed || 0, entry.failed || 0, entry.flaky || 0], backgroundColor: ["#2ecc71", "#e74c3c", "#f1c40f"], radius: "95%" }] },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: "45%",
            plugins: { legend: { position: "top", labels: { color: getChartTheme().text, boxWidth: 12, padding: 16 } } }
        }
    })
    const flaky = new Chart(document.getElementById(`runFlakyChart-${index}`), {
        type: "line",
        data: { labels: [label], datasets: [{ label: "Flaky", data: [entry.flaky || 0], borderColor: "#f39c12", tension: 0.3 }] },
        options: chartOptions()
    })
    const quality = new Chart(document.getElementById(`runQualityChart-${index}`), {
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
    const heatmap = new Chart(document.getElementById(`runHeatmapChart-${index}`), {
        type: "bar",
        data: { labels: Object.keys(failureCounts), datasets: [{ label: "Failures", data: Object.values(failureCounts), backgroundColor: "rgba(255, 99, 132, 0.7)" }] },
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

    if (!Array.isArray(data) || !data.length) {
        container.innerHTML = `<div class="run-empty">No runs available for the selected history range.</div>`
        return
    }

    const orderedRuns = [...data].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))

    orderedRuns.forEach((entry, index) => {
        const total = entry.total || 0
        const passRate = getSafeRate(entry.passed || 0, total)
        const slowest = ((entry.results || []).map(test => ({ name: test.name || "-", duration: Number(test.stop) - Number(test.start) })).sort((a, b) => b.duration - a.duration)[0] || { name: "-" }).name

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
                            <div class="run-kpi"><div class="run-kpi-label">Total Tests</div><div class="run-kpi-value">${entry.total || 0}</div></div>
                            <div class="run-kpi"><div class="run-kpi-label">Passed</div><div class="run-kpi-value">${entry.passed || 0}</div></div>
                            <div class="run-kpi"><div class="run-kpi-label">Failed</div><div class="run-kpi-value">${entry.failed || 0}</div></div>
                            <div class="run-kpi"><div class="run-kpi-label">Flaky</div><div class="run-kpi-value">${entry.flaky || 0}</div></div>
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
                                        <tr><td>Slowest Test</td><td>${slowest}</td></tr>
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

function updateContextSummary(data) {
    const dataScopeSummary = document.getElementById("dataScopeSummary")
    const dataScopeNote = document.getElementById("dataScopeNote")
    const archiveStatusBadge = document.getElementById("archiveStatusBadge")
    const runCountBadge = document.getElementById("runCountBadge")
    const lastUpdatedBadge = document.getElementById("lastUpdatedBadge")
    const rangeLabel = document.getElementById("historyLabel").innerText || "All"
    const archiveOn = currentHistoryRange === "30" || currentHistoryRange === "all"
    const runCount = Array.isArray(data) ? data.length : 0
    const latestTimestamp = runCount ? new Date(Math.max(...data.map(entry => new Date(entry.timestamp).getTime()))) : null

    if (dataScopeSummary) {
        dataScopeSummary.innerText = `Viewing ${rangeLabel.toLowerCase()} with ${runCount} run${runCount === 1 ? "" : "s"} available in the accordion below.`
    }
    if (dataScopeNote) {
        dataScopeNote.innerText = "Each expanded panel shows one run only and does not apply any extra filtering inside the run."
    }
    if (archiveStatusBadge) {
        archiveStatusBadge.innerText = `Archives: ${archiveOn ? "in scope" : "not used"}`
    }
    if (runCountBadge) {
        runCountBadge.innerText = `Runs loaded: ${runCount}`
    }
    if (lastUpdatedBadge) {
        lastUpdatedBadge.innerText = latestTimestamp ? `Last updated: ${latestTimestamp.toLocaleString()}` : "Last updated: no runs loaded"
    }
}

async function updatePage(data) {
    currentRunPageData = data
    updateContextSummary(data)
    renderRunAccordion(data)
}

document.querySelectorAll("#historyDropdown .dropdown-menu button").forEach(btn => {
    btn.onclick = async (e) => {
        e.stopPropagation()
        currentHistoryRange = btn.dataset.range
        document.getElementById("historyLabel").innerText = btn.innerText
        await updatePage(await getHistoryDataForRange(currentHistoryRange))
        document.querySelectorAll(".dropdown").forEach(d => d.classList.remove("open"))
    }
})

function initThemeToggle() {
    const btn = document.getElementById("themeToggle")
    const icon = document.getElementById("themeIcon")

    function updateIcon() {
        if (icon) icon.textContent = document.body.classList.contains("dark") ? "Dark" : "Light"
    }

    updateIcon()
    applyChartTheme()

    btn.addEventListener("click", function (e) {
        e.stopPropagation()
        document.body.classList.toggle("dark")
        const isDark = document.body.classList.contains("dark")
        localStorage.setItem("qa-theme", isDark ? "dark" : "light")
        updateIcon()
        renderRunAccordion(currentRunPageData)
        applyChartTheme()
    })
}

async function loadRunsPage() {
    activeHistoryData = await fetchJsonArray("./data/history.json")
    await updatePage(await getHistoryDataForRange(currentHistoryRange))
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
        initThemeToggle()
        loadRunsPage()
    })
} else {
    initThemeToggle()
    loadRunsPage()
}
