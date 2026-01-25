// Preset frequency validation script for CI/build checks
import { validatePresetFrequency } from '../src/lib/validate-preset-frequencies';

// Run validation
const result = validatePresetFrequency();

if (!result.valid) {
  process.exit(1);
}

console.log('✅ Preset frequency validation passed');