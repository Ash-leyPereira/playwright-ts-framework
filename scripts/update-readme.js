const fs = require("fs");
const path = require("path");

if (!process.env.CI) {
  console.log('Skipping README update (not running on CI)');
  process.exit(0);
}

const RESULTS_DIR = "reports/allure-results";
const README_FILE = "README.md";

let passed = 0;
let failed = 0;
let skipped = 0;
let total = 0;

/**
 * Read allure result files
 */
if (fs.existsSync(RESULTS_DIR)) {
  const files = fs.readdirSync(RESULTS_DIR);

  files.forEach(file => {
    if (file.endsWith("-result.json")) {
      const filePath = path.join(RESULTS_DIR, file);

      try {
        const data = JSON.parse(fs.readFileSync(filePath, "utf8"));

        total++;

        switch (data.status) {
          case "passed":
            passed++;
            break;
          case "failed":
            failed++;
            break;
          case "skipped":
            skipped++;
            break;
        }

      } catch (err) {
        console.log(`Skipping invalid file: ${file}`);
      }
    }
  });
}

const passRate = total === 0 ? 0 : ((passed / total) * 100).toFixed(2);
const today = new Date().toISOString().split("T")[0];
const stableTests = passed;
const stabilityScore = total === 0 ? 0 : ((stableTests / total) * 100).toFixed(2);

console.log("Test Summary:");
console.log(`Total: ${total}`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(`Skipped: ${skipped}`);

/**
 * Generate badges
 */
const badgeSection = `
![Tests](https://img.shields.io/badge/tests-${total}-blue)
![Passed](https://img.shields.io/badge/passed-${passed}-brightgreen)
![Failed](https://img.shields.io/badge/failed-${failed}-red)
![Pass Rate](https://img.shields.io/badge/pass_rate-${passRate}%25-green)
![Stability](https://img.shields.io/badge/stability-${stabilityScore}%25-blue)
`;

/**
 * Generate stats table
 */
const statsSection = `
## 🚀 Automation Execution Status

| Metric | Value |
|------|------|
| Total Tests | ${total} |
| Passed | ${passed} |
| Failed | ${failed} |
| Skipped | ${skipped} |
| Pass Rate | ${passRate}% |
| Stability Score | ${stabilityScore}% |
| Last Run | ${today} |
`;

/**
 * Read README
 */
let readme = fs.readFileSync(README_FILE, "utf8");

/**
 * Update badges
 */
readme = readme.replace(
  /<!-- BADGES_START -->([\s\S]*?)<!-- BADGES_END -->/,
  `<!-- BADGES_START -->\n${badgeSection}\n<!-- BADGES_END -->`
);

/**
 * Update stats
 */
readme = readme.replace(
  /<!-- TEST_RESULTS_START -->([\s\S]*?)<!-- TEST_RESULTS_END -->/,
  `<!-- TEST_RESULTS_START -->\n${statsSection}\n<!-- TEST_RESULTS_END -->`
);

/**
 * Write updated README
 */
fs.writeFileSync(README_FILE, readme);

console.log("README updated successfully!");