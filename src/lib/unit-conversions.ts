// Unit conversion utilities for the fitness app
// All internal values are stored in metric (cm, kg)
// UI can display in either metric or imperial based on user preference

export type UnitSystem = 'metric' | 'imperial';

// Height conversions
export const cmToInches = (cm: number): number => {
  return cm / 2.54;
};

export const inchesToCm = (inches: number): number => {
  return inches * 2.54;
};

export const cmToFtIn = (cm: number): { feet: number; inches: number } => {
  const totalInches = cmToInches(cm);
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches % 12);
  return { feet, inches };
};

export const ftInToCm = (feet: number, inches: number): number => {
  const totalInches = (feet * 12) + inches;
  return inchesToCm(totalInches);
};

// Weight conversions
export const kgToLbs = (kg: number): number => {
  return kg * 2.20462262;
};

export const lbsToKg = (lbs: number): number => {
  return lbs / 2.20462262;
};

// Formatting utilities
export const formatHeight = (cm: number, unitSystem: UnitSystem): string => {
  if (unitSystem === 'imperial') {
    const { feet, inches } = cmToFtIn(cm);
    return `${feet}'${inches}"`;
  }
  return `${cm.toFixed(0)} cm`;
};

export const formatWeight = (kg: number, unitSystem: UnitSystem): string => {
  if (unitSystem === 'imperial') {
    const lbs = kgToLbs(kg);
    return `${lbs.toFixed(1)} lbs`;
  }
  return `${kg.toFixed(1)} kg`;
};

// Input parsing utilities
export const parseImperialHeight = (feet: string, inches: string): number | null => {
  const ft = parseInt(feet, 10);
  const inValue = parseInt(inches, 10);
  
  if (isNaN(ft) || isNaN(inValue) || ft < 0 || inValue < 0 || inValue >= 12) {
    return null;
  }
  
  return ftInToCm(ft, inValue);
};

export const parseImperialWeight = (lbs: string): number | null => {
  const weight = parseFloat(lbs);
  
  if (isNaN(weight) || weight <= 0) {
    return null;
  }
  
  return lbsToKg(weight);
};

// Validation utilities
export const validateMetricHeight = (cm: number): boolean => {
  return cm >= 100 && cm <= 250;
};

export const validateImperialHeight = (feet: number, inches: number): boolean => {
  const cm = ftInToCm(feet, inches);
  return validateMetricHeight(cm);
};

export const validateMetricWeight = (kg: number): boolean => {
  return kg >= 30 && kg <= 300;
};

export const validateImperialWeight = (lbs: number): boolean => {
  const kg = lbsToKg(lbs);
  return validateMetricWeight(kg);
}