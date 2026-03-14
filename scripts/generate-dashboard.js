const fs = require("fs");
const path = require("path");

if (!process.env.CI) {
  console.log('Skipping dashboard generation (not running on CI)');
  process.exit(0);
}

const resultsDir = path.join(__dirname, '..', 'reports/allure-results');
const historyFile = path.join(__dirname, '..', 'analytics', 'history.json');
const dashboardHistory = path.join(__dirname, '..', 'dashboard', 'history.json');

const dashboardDir = path.dirname(dashboardHistory);
if (!fs.existsSync(dashboardDir)) fs.mkdirSync(dashboardDir, { recursive: true });

// Check if results folder exists
if (!fs.existsSync(resultsDir)) {
  console.warn(`No results found for today at ${resultsDir}`);
  process.exit(0);
}

// Ensure history folder exists
const historyDir = path.dirname(historyFile);
if (!fs.existsSync(historyDir)) fs.mkdirSync(historyDir, { recursive: true });

let todayData = { total: 0, passed: 0, failed: 0, flaky: 0, stabilityScore: "0%", passRate: "0%", flakyTests: [] };

// Read all result files
const resultFiles = fs.readdirSync(resultsDir).filter(f => f.endsWith('-result.json'));
for (const file of resultFiles) {
  const data = JSON.parse(fs.readFileSync(path.join(resultsDir, file), 'utf8'));
  console.log('Parsed data from', file, data);
  // If the file is an array of results:
  const results = Array.isArray(data) ? data : [data];

  for (const r of results) {
    todayData.total += 1;
    if (r.status === 'passed') todayData.passed += 1;
    else if (r.status === 'failed') todayData.failed += 1;
    
    if (data.flaky === true) {
      const name = data.name;
      todayData.flaky += 1;
      todayData.flakyTests.push(name);
    }
  }
}

// Calculate stability
const total = todayData.total || 0;
const failed = todayData.failed || 0;
const flaky = todayData.flaky || 0;

todayData.passRate = total > 0
  ? ((todayData.passed / total) * 100).toFixed(2) + '%'
  : '0%';
todayData.stabilityScore = total > 0
  ? (((total - failed - flaky) / total) * 100).toFixed(2) + '%'
  : '0%';
todayData.timestamp = new Date().toISOString();

// Load previous history
let history = [];
if (fs.existsSync(historyFile)) {
  history = JSON.parse(fs.readFileSync(historyFile, 'utf8'));
}

// Append new run and sort
history.push(todayData);
history.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

// Save persistent history
fs.writeFileSync(historyFile, JSON.stringify(history, null, 2));
// Copy to dashboard for GitHub Pages
fs.writeFileSync(dashboardHistory, JSON.stringify(history, null, 2));

console.log('✅ History updated with flaky tests and stability score');