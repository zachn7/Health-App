#!/usr/bin/env node

// CI Guard: Fail if any test.skip or describe.skip are found in E2E tests
// This prevents regressing back to skipped tests

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const TESTS_DIR = join(process.cwd(), 'tests/e2e');

const BAD_PATTERNS = [
  /test\.skip\s*\(/,
  /describe\.skip\s*\(/,
  /it\.skip\s*\(/
];

const violations = [];

function checkFile(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  
  lines.forEach((line, lineNum) => {
    BAD_PATTERNS.forEach(pattern => {
      const match = line.match(pattern);
      if (match && !line.trim().startsWith('//')) { // Ignore commented skips
        violations.push({
          file: filePath.replace(process.cwd() + '/', ''),
          line: lineNum + 1,
          content: line.trim()
        });
      }
    });
  });
}

function walkDir(dir) {
  const files = readdirSync(dir);
  
  files.forEach(file => {
    const filePath = join(dir, file);
    const stat = statSync(filePath);
    
    if (stat.isDirectory()) {
      walkDir(filePath);
    } else if (extname(file) === '.ts') {
      checkFile(filePath);
    }
  });
}

// Main execution
try {
  console.log('🔍 Scanning for test.skip() and describe.skip() in E2E tests...');
  console.log('');
  
  if (statSync(TESTS_DIR).isDirectory()) {
    walkDir(TESTS_DIR);
  }
  
  if (violations.length > 0) {
    console.log('❌ FAILED: Found test skips!');
    console.log('');
    violations.forEach(v => {
      console.log(`   ${v.file}:${v.line}`);
      console.log(`   ${v.content}`);
      console.log('');
    });
    console.log('🛑 Fix: Remove all test.skip/describe.skip calls.');
    process.exit(1);
  } else {
    console.log('✅ PASSED: No test skips found!');
    console.log('');
    process.exit(0);
  }
} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}