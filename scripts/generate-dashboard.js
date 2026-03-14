const fs = require("fs");

const historyFile = "analytics/history.json";
const resultsDir = "reports/allure-results";

let passed = 0;
let failed = 0;
let total = 0;

fs.readdirSync(resultsDir).forEach(file => {

  if (!file.endsWith("-result.json")) return;

  const data = JSON.parse(
    fs.readFileSync(`${resultsDir}/${file}`)
  );

  total++;

  if (data.status === "passed") passed++;
  if (data.status === "failed") failed++;
});

const passRate = ((passed / total) * 100).toFixed(2);

let history = JSON.parse(fs.readFileSync(historyFile));

history.push({
  date: new Date().toISOString().split("T")[0],
  total,
  passed,
  failed,
  passRate
});

fs.writeFileSync(historyFile, JSON.stringify(history, null, 2));

console.log("Analytics history updated");