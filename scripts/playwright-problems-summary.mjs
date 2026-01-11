#!/usr/bin/env node

/**
 * Playwright Problems-Only Summary
 * 
 * Reads a Playwright JSON report and outputs a concise list of ONLY:
 * - Failed tests
 * - Skipped tests (with reasons if available)
 * - Interrupted/Did-not-run tests (with errors if available)
 * 
 * Usage:
 *   npx playwright test --reporter=json > test-results/playwright-results.json
 *   node scripts/playwright-problems-summary.mjs test-results/playwright-results.json
 * 
 * Output:
 *   - Prints to console
 *   - Writes to test-results/playwright-problems.md
 */

import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);

/**
 * Extract skip reason from annotations
 */
function getSkipReason(annotations) {
  if (!annotations || !Array.isArray(annotations)) {
    return null;
  }
  
  // Try to find annotation with type 'skip'
  let skipAnnotation = annotations.find(a => a.type === 'skip');
  if (skipAnnotation && skipAnnotation.description) {
    return skipAnnotation.description;
  }
  
  // Fallback: any annotation mentioning 'skip'
  skipAnnotation = annotations.find(a => a.description?.toLowerCase().includes('skip'));
  return skipAnnotation?.description || null;
}

/**
 * Format test location for display
 */
function formatLocation(location) {
  if (!location) return '';
  const relativeFile = location.file.replace(process.cwd() + '/', 'tests/e2e/');
  return `${relativeFile}`;
}

/**
 * Main function to process JSON report
 */
function processReport(jsonFilePath) {
  const jsonContent = readFileSync(jsonFilePath, 'utf-8');
  const report = JSON.parse(jsonContent);
  
  const failed = [];
  const skipped = [];
  const interrupted = [];
  const failedSuites = [];
  
  // Process each suite
  report.suites?.forEach(suite => {
    // Process tests in this suite
    suite.specs?.forEach(spec => {
      spec.tests?.forEach(test => {
        const testInfo = {
          title: spec.title + ' › ' + test.title,
          file: formatLocation(spec.location),
          line: spec.location?.line || '',
          status: test.results?.[0]?.status || 'unknown',
          error: test.results?.[0]?.error,
          annotations: test.results?.[0]?.annotations,
          skipReason: getSkipReason(test.results?.[0]?.annotations)
        };
        
        if (testInfo.status === 'failed') {
          failed.push(testInfo);
        } else if (testInfo.status === 'skipped') {
          skipped.push(testInfo);
        } else if (testInfo.status === 'interrupted') {
          interrupted.push(testInfo);
        }
      });
    });
    
    // Check for suite-level errors (causing did-not-run)
    if (suite.error) {
      failedSuites.push({
        title: suite.specs?.[0]?.title || suite.file || 'Unknown Suite',
        file: formatLocation(suite.location),
        error: suite.error
      });
    }
  });
  
  // Generate markdown output
  const markdown = generateMarkdown({ failed, skipped, interrupted, failedSuites });
  
  // Write to file
  const outputPath = join(dirname(jsonFilePath), 'playwright-problems.md');
  writeFileSync(outputPath, markdown, 'utf-8');
  
  // Print to console
  console.log(markdown);
  console.log('');
  console.log('✅ Summary written to:', outputPath);
  
  return { failed, skipped, interrupted, failedSuites };
}

/**
 * Generate markdown report
 */
function generateMarkdown({ failed, skipped, interrupted, failedSuites }) {
  const sections = [];
  
  // Header
  sections.push('# Playwright Test Problems Summary\n');
  
  const totalProblems = failed.length + skipped.length + interrupted.length;
  sections.push(`**Total Problems:** ${totalProblems}\n`);
  sections.push(`- Failed: ${failed.length}`);
  sections.push(`- Skipped: ${skipped.length}`);
  sections.push(`- Interrupted/Did-not-run: ${interrupted.length}`);
  sections.push(`- Failed Suites (causing did-not-run): ${failedSuites.length}`);
  sections.push('');
  sections.push('---\n');
  
  // Failed tests section
  if (failed.length > 0) {
    sections.push('## ❌ Failed Tests\n');
    failed.forEach((test, idx) => {
      sections.push(`### ${idx + 1}. ${test.title}\n`);
      sections.push(`**File:** \`${test.file}\`${test.line ? `:${test.line}` : ''}\n`);
      
      if (test.error) {
        const errorMessage = test.error.message || test.error.value || 'Unknown error';
        const truncated = errorMessage.length > 300 ? errorMessage.substring(0, 300) + '...' : errorMessage;
        sections.push(`**Error:** ${truncated}\n`);
        if (test.error.stack) {
          const stackLines = test.error.stack.split('\n').slice(0, 3).join('\n');
          sections.push(`\`\`\`\n${stackLines}\n\`\`\`\n`);
        }
      }
      sections.push('');
    });
    sections.push('');
  }
  
  // Skipped tests section
  if (skipped.length > 0) {
    sections.push('## ⏭️ Skipped Tests\n');
    skipped.forEach((test, idx) => {
      sections.push(`### ${idx + 1}. ${test.title}\n`);
      sections.push(`**File:** \`${test.file}\`${test.line ? `:${test.line}` : ''}\n`);
      
      if (test.skipReason) {
        sections.push(`**Skip Reason:** ${test.skipReason}\n`);
      } else {
        sections.push(`**Skip Reason:** *Not specified in annotations*\n`);
      }
      sections.push('');
    });
    sections.push('');
  }
  
  // Interrupted tests section
  if (interrupted.length > 0) {
    sections.push('## ⚠️ Interrupted / Did-Not-Run Tests\n');
    interrupted.forEach((test, idx) => {
      sections.push(`### ${idx + 1}. ${test.title}\n`);
      sections.push(`**File:** \`${test.file}\`${test.line ? `:${test.line}` : ''}\n`);
      
      if (test.error) {
        const errorMessage = test.error.message || 'Test interrupted (timeout, crash, etc.)';
        sections.push(`**Error:** ${errorMessage}\n`);
      }
      sections.push('');
    });
    sections.push('');
  }
  
  // Failed suites section
  if (failedSuites.length > 0) {
    sections.push('## 🚨 Failed Suites (Causing Did-Not-Run)\n');
    failedSuites.forEach((suite, idx) => {
      sections.push(`### ${idx + 1}. ${suite.title}\n`);
      sections.push(`**File:** \`${suite.file}\``);
      
      if (suite.error) {
        const errorMessage = suite.error.message || suite.error.value || 'Unknown suite error';
        sections.push(`**Suite Error:** ${errorMessage}\n`);
      }
      sections.push('');
    });
    sections.push('');
  }
  
  // No problems section
  if (totalProblems === 0) {
    sections.push('## ✅ No Problems Found\n');
    sections.push('All tests passed successfully!\n');
    sections.push('');
  }
  
  // Footer
  sections.push('---\n');
  sections.push(`_Generated at ${new Date().toISOString()}_\n`);
  
  return sections.join('\n');
}

// Main execution
// Check if this is being run directly (not imported)
const isRunningDirectly = process.argv[1] && process.argv[1].includes('playwright-problems-summary.mjs');

if (isRunningDirectly) {
  const jsonFilePath = process.argv[2];
  
  if (!jsonFilePath) {
    console.error('Usage: node scripts/playwright-problems-summary.mjs <playwright-results.json>');
    console.error('');
    console.error('Example:');
    console.error('  npx playwright test --reporter=json > test-results/playwright-results.json');
    console.error('  node scripts/playwright-problems-summary.mjs test-results/playwright-results.json');
    process.exit(1);
  }
  
  try {
    processReport(jsonFilePath);
    process.exit(0);
  } catch (error) {
    console.error('Error processing report:', error.message);
    console.error('');
    if (error.code === 'ENOENT') {
      console.error(`File not found: ${jsonFilePath}`);
    }
    process.exit(1);
  }
}

export { processReport, generateMarkdown };