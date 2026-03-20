const fs = require("fs");
const path = require("path");

if (!process.env.CI) {
  console.log("Skipping dashboard generation (not running on CI)");
  process.exit(0);
}

const resultsDir = path.join(__dirname, "..", "reports", "allure-results");
const dashboardDataDir = path.join(__dirname, "..", "dashboard", "data");
const historyFile = path.join(dashboardDataDir, "history.json");
const archivesDir = path.join(dashboardDataDir, "archives");
const last30ArchiveFile = path.join(archivesDir, "last-30-days.json");
const allArchiveFile = path.join(archivesDir, "all.json");

const ACTIVE_RETENTION_DAYS = 14;
const LAST_30_RETENTION_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function readJsonArray(filePath) {
  if (!fs.existsSync(filePath)) return [];

  try {
    const raw = fs.readFileSync(filePath, "utf8").trim();
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn(`Skipping unreadable history file: ${filePath}`);
    return [];
  }
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

function getEntryAgeInDays(entry, nowMs) {
  const ts = Date.parse(entry.timestamp || "");
  if (Number.isNaN(ts)) return Infinity;
  return (nowMs - ts) / DAY_MS;
}

function dedupeEntries(entries) {
  const byTimestamp = new Map();

  entries.forEach(entry => {
    if (!entry || !entry.timestamp) return;
    byTimestamp.set(entry.timestamp, entry);
  });

  return [...byTimestamp.values()].sort((a, b) => {
    return Date.parse(a.timestamp) - Date.parse(b.timestamp);
  });
}

if (!fs.existsSync(resultsDir)) {
  console.warn(`No results found for today at ${resultsDir}`);
  process.exit(0);
}

ensureDir(dashboardDataDir);
ensureDir(archivesDir);

let total = 0;
let passed = 0;
let failed = 0;
let flaky = 0;

const results = [];

fs.readdirSync(resultsDir).forEach(file => {
  if (!file.endsWith("-result.json")) return;

  const data = JSON.parse(
    fs.readFileSync(path.join(resultsDir, file), "utf8")
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

const existingEntries = dedupeEntries([
  ...readJsonArray(historyFile),
  ...readJsonArray(last30ArchiveFile),
  ...readJsonArray(allArchiveFile),
  entry
]);

const nowMs = Date.now();
const activeHistory = [];
const last30Archive = [];
const allArchive = [];

existingEntries.forEach(item => {
  const ageInDays = getEntryAgeInDays(item, nowMs);

  if (ageInDays <= ACTIVE_RETENTION_DAYS) {
    activeHistory.push(item);
    return;
  }

  if (ageInDays <= LAST_30_RETENTION_DAYS) {
    last30Archive.push(item);
    return;
  }

  allArchive.push(item);
});

writeJson(historyFile, activeHistory);
writeJson(last30ArchiveFile, last30Archive);
writeJson(allArchiveFile, allArchive);

console.log(
  `History updated: ${activeHistory.length} active, ${last30Archive.length} archived for last-30-days, ${allArchive.length} archived for all`
);
