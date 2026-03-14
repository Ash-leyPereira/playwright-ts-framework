const fs = require('fs');
const path = require('path');

const historyFile = path.join(__dirname, '../analytics/history.json');
const resultsDir = path.join(__dirname, '../reports/allure-results');
const flakyFile = path.join(__dirname, '../reports/flaky-tests.md'); // optional markdown

let passed = 0;
let failed = 0;
let total = 0;
const flakyTests = [];
const maxRetries = 2; // or read from Playwright config

fs.readdirSync(resultsDir).forEach(file => {
  if (!file.endsWith('-result.json')) return;
  const data = JSON.parse(fs.readFileSync(path.join(resultsDir, file), 'utf8'));

  total++;
  if (data.status === 'passed') passed++;
  if (data.status === 'failed') failed++;

  // Detect flaky: failed but retried successfully
  if (data.attempts && data.attempts > 1 && data.status === 'passed') {
    flakyTests.push(data.name);
  }
});

// Calculate pass rate and stability
const passRate = total ? ((passed / total) * 100).toFixed(2) : 0;
const stabilityScore = total ? (((passed - flakyTests.length) / total) * 100).toFixed(2) : 0;

// Load previous history
let history = [];
if (fs.existsSync(historyFile)) {
  history = JSON.parse(fs.readFileSync(historyFile, 'utf8'));
}

// Append current run
history.push({
  date: new Date().toISOString().split('T')[0],
  total,
  passed,
  failed,
  passRate,
  flakyTests,
  stabilityScore
});

// Save updated history
fs.writeFileSync(historyFile, JSON.stringify(history, null, 2));

// Optionally save flaky tests to markdown
fs.writeFileSync(flakyFile, `# Flaky Test Report\n\n${flakyTests.length ? flakyTests.map(t => `- ${t}`).join('\n') : 'No flaky tests'}\n`);

console.log('Dashboard data updated ✅');