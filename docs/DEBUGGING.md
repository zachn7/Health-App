# Debugging Guide for Code Puppy Trainer

## Common Issues and Solutions

### Profile Save Failures

**Issue**: "Fails to save profile info" error

**Debugging Steps**:
1. Open browser dev tools (F12)
2. Go to Console tab
3. Try creating/saving a profile
4. Look for detailed error messages in the console
5. Check IndexedDB in Application tab → Storage → IndexedDB

**Common Causes**:
- Schema mismatch between ID types (auto-increment vs string)
- Missing required fields (age, equipment, workout schedule)
- Browser storage permissions denied
- Corrupted database (clear IndexedDB and retry)

**Solutions**:
```javascript
// Clear corrupted database
indexedDB.deleteDatabase('CodePuppyTrainerDB');```

### Storage Errors

**Location**: `src/db/index.ts` andRepositories

**Debugging**:
- All repository methods log errors to console
- Check browser's Application → IndexedDB → CodePuppyTrainerDB
- Verify schema version matches expectations

**Common Repository Issues**:
- Wrong method names (create vs createNutritionLog)
- Missing fields in database schema
- Type mismatches in TypeScript

### Nutrition Tracking Issues

**Debugging Steps**:
1. Check food data is loaded from `/src/assets/data/foods.seed.json`
2. Verify nutrition logs are being created in IndexedDB
3. Check calculation methods for macro totals

**Repository Methods**:
- `repositories.nutrition.createNutritionLog()`
- `repositories.nutrition.getNutritionLog(date)`
- `repositories.nutrition.updateNutritionLog()`

### Workout Plan Generation

**Debugging Steps**:
1. Ensure profile exists before generating plan
2. Check exercise data loads from `/src/assets/data/exercises.seed.json`
3. Verify coach engine calculations in `src/lib/coach-engine.ts`

**Common Issues**:
- No profile created yet
- Equipment selection mismatch with available exercises
- Invalid workout schedule (no days selected)

### Progress Tracking

**Weight Logging Issues**:
- Check `repositories.progress.createWeightLog()`
- Verify date format: `YYYY-MM-DD`
- Ensure weight is a valid number (30-300kg)

**Workout Logs Issues**:
- Check `repositories.workout.createWorkoutLog()`
- Verify exercise entries have valid set data
- Ensure duration is calculated correctly

## Testing Guide

### Running Tests

```bash
# Run all tests
npm run test

# Run e2e tests
npm run test:e2e

# Run single e2e test
npx playwright test tests/e2e/onboarding.spec.ts

# Run tests with GUI
npx playwright test --ui
```

### Manual Testing Checklist

#### Profile Creation
- [ ] Age gate accepts 13+ and blocks under 13
- [ ] Profile form validates all fields
- [ ] Profile saves to IndexedDB successfully
- [ ] User redirected to dashboard after save
- [ ] Profile persists after page refresh

#### AI Coach
- [ ] Generates workout plan from profile
- [ ] Plan shows appropriate exercises for equipment
- [ ] Weekly progression works correctly
- [ ] Plan saves to database

#### Nutrition
- [ ] Can add food items manually
- [ ] Macro calculations are correct
- [ ] Daily totals update properly
- [ ] Food items can be deleted
- [ ] Data persists after refresh

#### Workouts
- [ ] Exercise library loads from seed data
- [ ] Can generate workout plans
- [ ] Workout plans display correctly
- [ ] Can start workout from plan

#### Workout Logger
- [ ] Can log sets, reps, and weights
- [ ] Workout duration is tracked
- [ ] Volume calculations are correct
- [ ] Workout saves to database

#### Progress
- [ ] Can log weight entries
- [ ] Weight trend calculations work
- [ ] Progress charts display correctly
- [ ] Recent workouts show in progress

### Database Schema

**Location**: `src/db/index.ts`

**Current Version**: 3

**Tables**:
- `profiles`: User profile data
- `workoutPlans`: Generated workout programs
- `workoutLogs`: Completed workout sessions
- `nutritionLogs`: Daily nutrition tracking
- `weightLogs`: Weight tracking over time
- `foodItems`: Custom and saved food items
- `mealTemplates`: Reusable meal patterns
- `weeklyCheckIns`: Coach weekly progress updates
- `injuryAssessments`: Injury screening results

### Browser DevTools

**Console Logging**:
- All repository operations log success/failure
- Profile saves include detailed error info
- Coach engine logs plan generation steps

**Storage Inspection**:
1. F12 → Application → Storage → IndexedDB
2. Select `CodePuppyTrainerDB`
3. Browse tables and verify data
4. Delete corrupted data if needed

**Network Tab**:
- Should show no external API calls (offline-first)
- Only assets and seed data files should load

### GitHub Pages Deployment

**Issues**: Hash routing not working, 404 errors

**Solutions**:
- Ensure HashRouter is used in App.tsx
- All navigation uses `react-router-dom` `<Link>` components
- Built assets are in `dist/` folder
- `vite.config.ts` has correct `base` path if deployed to subfolder

**Building for GitHub Pages**:
```bash
npm run build
# Upload dist/ contents to gh-pages branch
```

### Performance Issues

**Indicators**:
- Slow app startup
- Laggy UI interactions
- Large bundle size

**Debugging**:
1. Check bundle size in build output
2. Profiler tab in DevTools
3. Lighthouse audit

**Common Causes**:
- Large seed data files
- Inefficient IndexedDB queries
- Missing React.memo on expensive components

### Error Recovery

**Database Corruption**:
```javascript
// Clear entire database
indexedDB.deleteDatabase('CodePuppyTrainerDB');
```

**Reset to Fresh State**:
1. Open DevTools
2. Application → Storage → IndexedDB
3. Right-click database → Delete
4. Refresh page

**Profile Reset**:
```javascript
// Clear only profile data
indexedDB.open('CodePuppyTrainerDB').onsuccess = function(e) {
  const db = e.target.result;
  db.transaction(['profiles'], 'readwrite').objectStore('profiles').clear();
};
```

## Development Workflow

### Getting Started
1. Clone repository
2. `npm install`
3. Check `/src/assets/data/` for seed files exist
4. `npm run dev`
5. Open http://localhost:5173

### Making Changes
1. Update TypeScript interfaces in `/src/types/`
2. Implement logic in repositories
3. UI changes in pages/components
4. Test in browser dev tools
5. Run tests before committing

### Before Deploying
1. `npm run build` - ensure no TypeScript errors
2. `npm run test` - run unit tests
3. `npm run test:e2e` - run end-to-end tests
4. Check bundle size
5. Verify offline functionality
6. Test on different browsers