const fs = require("fs");
const path = require("path");

const resultsDir = "reports/allure-results";

let passed = 0;
let failed = 0;
let total = 0;

fs.readdirSync(resultsDir).forEach(file => {
  if (file.endsWith("-result.json")) {
    const data = JSON.parse(
      fs.readFileSync(path.join(resultsDir, file))
    );

    total++;

    if (data.status === "passed") passed++;
    if (data.status === "failed") failed++;
  }
});

const passRate = ((passed / total) * 100).toFixed(2);

const stats = `
## 🚀 Automation Status

| Metric | Value |
|------|------|
| Total Tests | ${total} |
| Passed | ${passed} |
| Failed | ${failed} |
| Pass Rate | ${passRate}% |
| Last Run | ${new Date().toISOString().split("T")[0]} |
`;

const badge = `![Tests](https://img.shields.io/badge/tests-${total}-blue)
![Pass Rate](https://img.shields.io/badge/pass_rate-${passRate}%25-brightgreen)
`

const readme = fs.readFileSync("README.md", "utf8");

const updated = readme.replace(
  /<!-- TEST_RESULTS_START -->([\s\S]*?)<!-- TEST_RESULTS_END -->/,
  `<!-- TEST_RESULTS_START -->\n${stats}\n<!-- TEST_RESULTS_END -->`
);
updated = readme.replace(
  /<!-- BADGES_START -->([\s\S]*?)<!-- BADGES_END -->/,
  `<!-- BADGES_START -->\n${badge}\n<!-- BADGES_END -->`
);    

fs.writeFileSync("README.md", updated);

console.log("README updated with latest test stats");