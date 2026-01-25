// Runtime validation for preset data integrity
import { workoutPresets } from '../data/presetWorkouts';

export function validatePresetFrequency(): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  workoutPresets.forEach((preset) => {
    // Extract frequency from title using pattern like "Xx per Week" or "Xx/week"
    const frequencyMatch = preset.title.match(/(\d+)x\s*(?:per\s*week|\/week)/i);
    
    if (frequencyMatch) {
      const titleFrequency = parseInt(frequencyMatch[1], 10);
      const actualFrequency = preset.days.length;
      
      if (titleFrequency !== actualFrequency) {
        errors.push(
          `Preset "${preset.id}" has frequency mismatch: ` +
          `title says "${titleFrequency}x per Week" but has ${actualFrequency} days`
        );
      }
    }
  });

  if (errors.length > 0) {
    console.error('\n❌ Preset Frequency Validation Errors:');
    errors.forEach((error, i) => console.error(`  ${i + 1}. ${error}`));
    console.error('\nPlease fix these mismatches before proceeding.\n');
    return { valid: false, errors };
  } else {
    console.log('✅ All preset frequency declarations match actual day counts');
    return { valid: true, errors: [] };
  }
}