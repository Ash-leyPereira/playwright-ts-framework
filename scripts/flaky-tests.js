const fs = require("fs");
const path = require("path");

const RESULTS_DIR = "reports/allure-results";

let flakyTests = [];
let unstableTests = [];
let stableTests = [];

if (fs.existsSync(RESULTS_DIR)) {

  const files = fs.readdirSync(RESULTS_DIR);

  files.forEach(file => {

    if (!file.endsWith("-result.json")) return;

    const data = JSON.parse(
      fs.readFileSync(path.join(RESULTS_DIR, file))
    );

    const name = data.name;

    if (data.flaky === true) {
      flakyTests.push(name);
    }
    else if (data.status === "failed") {
      unstableTests.push(name);
    }
    else if (data.status === "passed") {
      stableTests.push(name);
    }

  });
}

const readmeFile = "README.md";

let readme = fs.readFileSync(readmeFile, "utf8");

const flakySection = `
## ⚠️ Flaky Test Detection

### Flaky Tests
${flakyTests.length ? flakyTests.map(t => `- ${t}`).join("\n") : "None"}

### Unstable Tests
${unstableTests.length ? unstableTests.map(t => `- ${t}`).join("\n") : "None"}

### Stable Tests
${stableTests.length}
`;

readme = readme.replace(
  /<!-- FLAKY_TESTS_START -->([\s\S]*?)<!-- FLAKY_TESTS_END -->/,
  `<!-- FLAKY_TESTS_START -->\n${flakySection}\n<!-- FLAKY_TESTS_END -->`
);

fs.writeFileSync(readmeFile, readme);
fs.writeFileSync("reports/flaky-tests.md", flakySection);
fs.writeFileSync("reports/allure-report/flaky-tests.md", flakySection);

console.log("Flaky test report generated");