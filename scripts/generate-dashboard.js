const fs = require("fs");
const path = require("path");

if (!process.env.CI) {
  console.log('Skipping dashboard generation (not running on CI)');
  process.exit(0);
}

const resultsDir = path.join(__dirname, '..', 'reports/allure-results');
const historyFile = path.join(__dirname, '..', 'dashboard/data', 'history.json');

// Check if results folder exists
if (!fs.existsSync(resultsDir)) {
  console.warn(`No results found for today at ${resultsDir}`);
  process.exit(0);
}

// Ensure history folder exists
const historyDir = path.dirname(historyFile);
if (!fs.existsSync(historyDir)) fs.mkdirSync(historyDir, { recursive: true });

let total = 0;
let passed = 0;
let failed = 0;
let flaky = 0;

let results = [];

fs.readdirSync(resultsDir).forEach(file => {

  if (!file.endsWith("-result.json")) return;

  const data = JSON.parse(
    fs.readFileSync(path.join(resultsDir, file))
  );

  total++;

  if (data.status === "passed") passed++;
  if (data.status === "failed") failed++;
  if (data.flaky === true) flaky++;

  results.push({
    name: data.parameters?.map(p => p.value).join(":") + ":" + data.name,
    status: data.status,
    start: data.start || 0,
    stop: data.stop || 0,
    error: data.statusDetails?.message || ""
  });

});

const entry = {

  timestamp: new Date().toISOString(),
  total,
  passed,
  failed,
  flaky,
  results

};

let history = [];

if (fs.existsSync(historyFile)) {

  history = JSON.parse(fs.readFileSync(historyFile));

}

history.push(entry);

fs.writeFileSync(historyFile, JSON.stringify(history, null, 2));

console.log('✅ History updated with latest test results');