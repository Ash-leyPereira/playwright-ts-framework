import fs from 'fs';
import path from 'path';

const resultsDir = path.join(__dirname, '..', 'results', new Date().toISOString().slice(0,10));
const historyFile = path.join(__dirname, '..', 'history', 'history.json');

let todayData = { total: 0, passed: 0, failed: 0, flaky: 0, flakyTests: [] };

// Read all results
const resultFiles = fs.existsSync(resultsDir) ? fs.readdirSync(resultsDir).filter(f => f.endsWith('.json')) : [];

for (const file of resultFiles) {
  const data = JSON.parse(fs.readFileSync(path.join(resultsDir, file), 'utf8'));
  todayData.total += data.total || 0;
  todayData.passed += data.passed || 0;
  todayData.failed += data.failed || 0;
  if (data.flakyTests) {
    todayData.flaky += data.flakyTests.length;
    todayData.flakyTests.push(...data.flakyTests);
  }
}

// Calculate stability score
todayData.stabilityScore = ((todayData.total - todayData.failed - todayData.flaky) / todayData.total * 100).toFixed(2) + '%';
todayData.timestamp = new Date().toISOString();

// Load previous history
let history = [];
if (fs.existsSync(historyFile)) {
  history = JSON.parse(fs.readFileSync(historyFile, 'utf8'));
}

// Append today's data
history.push(todayData);

// Save updated history
fs.writeFileSync(historyFile, JSON.stringify(history, null, 2));
console.log('✅ History updated with flaky tests and stability score');