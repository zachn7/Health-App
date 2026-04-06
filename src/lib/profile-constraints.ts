import type { FoodLogItem, MealPlanFood, Profile } from '@/types'

function splitList(value?: string): string[] {
  if (!value) return []
  return value
    .split(/[\n,;]+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

export function getDietaryRestrictions(profile: Profile): string[] {
  return splitList(profile.dietaryRestrictions)
}

export function getMovementLimitations(profile: Profile): string[] {
  return splitList(profile.limitations)
}

export function matchesDietaryRestrictions(name: string, restrictions: string[]): boolean {
  if (restrictions.length === 0) return true

  const normalizedName = name.toLowerCase()
  const blockedKeywords = restrictions.flatMap((restriction) => {
    const normalized = restriction.toLowerCase()
    if (normalized.includes('vegetarian')) return ['chicken', 'beef', 'pork', 'turkey', 'fish', 'salmon', 'tuna', 'shrimp']
    if (normalized.includes('vegan')) return ['chicken', 'beef', 'pork', 'turkey', 'fish', 'salmon', 'tuna', 'shrimp', 'egg', 'milk', 'cheese', 'yogurt', 'whey']
    if (normalized.includes('gluten')) return ['bread', 'pasta', 'bagel', 'flour', 'cracker']
    if (normalized.includes('dairy') || normalized.includes('lactose')) return ['milk', 'cheese', 'yogurt', 'whey', 'casein']
    if (normalized.includes('nut')) return ['almond', 'peanut', 'cashew', 'walnut', 'pecan', 'pistachio']
    return [normalized]
  })

  return !blockedKeywords.some((keyword) => normalizedName.includes(keyword))
}

export function filterFoodsForProfile<T extends Pick<FoodLogItem, 'name'> | Pick<MealPlanFood, 'name'>>(foods: T[], profile: Profile): T[] {
  const restrictions = getDietaryRestrictions(profile)
  if (restrictions.length === 0) return foods
  return foods.filter((food) => matchesDietaryRestrictions(food.name, restrictions))
}

export function buildProfileConstraintSummary(profile: Profile): string {
  const movementLimitations = getMovementLimitations(profile)
  const dietaryRestrictions = getDietaryRestrictions(profile)

  const parts: string[] = []
  if (movementLimitations.length > 0) {
    parts.push(`movement limitations: ${movementLimitations.join(', ')}`)
  }
  if (dietaryRestrictions.length > 0) {
    parts.push(`dietary restrictions: ${dietaryRestrictions.join(', ')}`)
  }

  return parts.length > 0 ? parts.join(' | ') : 'no explicit movement or dietary restrictions saved'
}
