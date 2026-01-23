#!/usr/bin/env node

/**
 * Playwright Problems-Only Summary (Simple Version)
 * 
 * Reads a Playwright JSON report and outputs ONLY:
 * - Failed tests
 * - Skipped tests
 * - Interrupted/Did-not-run tests
 * 
 * Usage:
 *   npx playwright test --project chromium --reporter=json > test-results/playwright-results.json
 *   node scripts/pw-problems.mjs
 * 
 * Output:
 *   - test-results/pw-problems.txt (plain text, concise)
 */

import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);

/**
 * Process JSON report and extract problems
 */
function processReport() {
  const jsonPath = 'test-results/playwright-results.json';
  const outputPath = 'test-results/pw-problems.txt';
  
  try {
    const jsonContent = readFileSync(jsonPath, 'utf-8');
    const report = JSON.parse(jsonContent);
    
    const failed = [];
    const skipped = [];
    const interrupted = [];
    
    // Process each suite
    for (const suite of report.suites || []) {
      for (const spec of suite.specs || []) {
        for (const test of spec.tests || []) {
          const status = test.results?.[0]?.status;
          const error = test.results?.[0]?.error;
          
          const testInfo = {
            title: `${spec.title} › ${test.title}`,
            file: spec.file?.replace(process.cwd() + '/', '') || spec.file,
            line: spec.location?.line || '',
            error: error?.message || error?.value || '',
          };
          
          if (status === 'failed') {
            failed.push(testInfo);
          } else if (status === 'skipped') {
            skipped.push(testInfo);
          } else if (status === 'interrupted') {
            interrupted.push(testInfo);
          }
        }
      }
    }
    
    // Generate plain text output
    const lines = [];
    lines.push('PLAYWRIGHT TEST PROBLEMS SUMMARY');
    lines.push('================================');
    lines.push(`Run Date: ${new Date().toISOString().split('T')[0]}`);
    lines.push(`Project: ${report.config?.projects?.[0]?.name || 'chromium'}`);
    lines.push('');
    
    if (failed.length > 0) {
      lines.push(`FAILED TESTS (${failed.length}):`);
      failed.forEach((test, idx) => {
        lines.push(`${idx + 1}. ${test.file}${test.line ? ':' + test.line : ''}`);
        lines.push(`   Title: ${test.title}`);
        if (test.error) {
          const truncated = test.error.length > 150 ? test.error.substring(0, 150) + '...' : test.error;
          lines.push(`   Error: ${truncated}`);
        }
        lines.push(`   Status: FAILED`);
        lines.push('');
      });
    }
    
    if (skipped.length > 0 || interrupted.length > 0) {
      lines.push(`SKIPPED/INTERRUPTED TESTS (${skipped.length + interrupted.length}):`);
      [...skipped, ...interrupted].forEach((test, idx) => {
        lines.push(`${idx + 1}. ${test.file}${test.line ? ':' + test.line : ''}`);
        lines.push(`   Title: ${test.title}`);
        lines.push('');
      });
    }
    
    const total = report.stats?.expected + report.stats?.unexpected + report.stats?.skipped || 0;
    lines.push('SUMMARY:');
    lines.push(`- Failed: ${failed.length}`);
    lines.push(`- Skipped/Did-not-run: ${skipped.length + interrupted.length}`);
    lines.push(`- Passed: ${report.stats?.expected || 0}`);
    lines.push(`- Total: ${total}`);
    
    const output = lines.join('\n');
    writeFileSync(outputPath, output, 'utf-8');
    
    console.log(output);
    console.log('');
    console.log(`✅ Summary written to: ${outputPath}`);
    
    return { failed: failed.length, skipped: skipped.length + interrupted.length };
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.error(`File not found: ${jsonPath}`);
      console.error('');
      console.error('To generate it:');
      console.error('  npx playwright test --project chromium --reporter=json > test-results/playwright-results.json');
    } else {
      console.error('Error processing report:', error.message);
    }
    process.exit(1);
  }
}

processReport();