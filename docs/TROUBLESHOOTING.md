# Troubleshooting Guide

This guide helps you resolve common issues with the Health App.

## Table of Contents

- [Data Issues](#data-issues)
- [Service Worker and Caching](#service-worker-and-caching)
- [Age Gate Problems](#age-gate-problems)
- [Profile Issues](#profile-issues)
- [Coach and Workout Plans](#coach-and-workout-plans)
- [Nutrition Tracking](#nutrition-tracking)
- [Performance Issues](#performance-issues)
- [Development and Debugging](#development-and-debugging)

## Data Issues

### Reset Local Data

If you're experiencing data corruption or want to start fresh:

**Method 1: Through Settings**
1. Go to Settings → Advanced
2. Click "Reset Local Data"
3. Confirm the reset
4. All local data will be cleared and you'll start fresh

**Method 2: Browser Developer Tools**
1. Open Developer Tools (F12)
2. Go to Application tab
3. Expand Storage → IndexedDB
4. Right-click on the database and select "Delete"
5. Refresh the page

**Method 3: Manual Reset**
```javascript
// In browser console
indexedDB.databases().then(dbs => {
  dbs.forEach(db => indexedDB.deleteDatabase(db.name));
});
location.reload();
```

### Data Not Saving

**Checklist**:
- Ensure browser has enough storage space
- Clear old data if storage is full
- Check browser isn't in private/incognito mode
- Verify IndexedDB isn't blocked by browser settings

**Browser Storage Space**:
- Chrome: Settings → Privacy and security → Clear browsing data
- Firefox: Options → Privacy & Security → Cookies and Site Data
- Safari: Develop menu → Empty Caches

## Service Worker and Caching

### Update App Version

The app uses a service worker for offline functionality. Sometimes you might see an old version.

**Auto-Update**:
- The app should auto-update when you visit the page
- You'll see a notification if an update is available

**Manual Force Update**:
1. Open Developer Tools (F12)
2. Go to Application tab
3. Go to Service Workers
4. Click "Update on reload"
5. Check "Offline" to test offline functionality
6. Refresh the page

**Clear Service Worker Cache**:
1. Open Developer Tools
2. Application → Service Workers
3. Click "Unregister" next to the service worker
4. Clear Application Cache
5. Refresh the page

### App Not Working Offline

**Steps to fix**:
1. First ensure the app has loaded at least once online
2. Check the service worker is registered (see above steps)
3. Test in airplane mode
4. Clear cache and retry (see reset steps above)

## Age Gate Problems

### Can't Continue Past Age Gate

**Symptoms**: Continue button doesn't work, requires page refresh

**Solution**:
1. Enter age 13 or higher
2. Click Continue button once
3. Should advance to profile/dashboard
4. If still stuck, check browser console for errors

**Debug Information**:
- In development mode, you'll see detailed error messages
- Check localStorage for `age_gate_accepted` should be `true`
- Check `age_gate_timestamp` should be a valid ISO string

### Age Validation Errors

**Common Issues**:
- Age below 13: App correctly blocks access
- Invalid characters: Use only numbers
- Blank entry: Please enter a valid age

## Profile Issues

### Height/Weight Not Saving Correctly

**Unit Conversion Issues**:
- When switching between metric/imperial, values are converted automatically
- Check the conversion preview shows the correct equivalent
- Values are always stored internally in metric

**Validation Errors**:
- Height: Must be 100-250 cm (3'4" to 8'3")
- Weight: Must be 30-300 kg (66-661 lbs)
- Age: Must be 13 or older

### Profile Data Lost

**Recovery Steps**:
1. Check if you're in the same browser/profile
2. Verify IndexedDB hasn't been cleared
3. Try browser recovery options if crash occurred
4. Profile data isn't cloud-synced, so device loss = data loss

## Coach and Workout Plans

### Plans Not Generating

**Requirements**:
- Complete profile setup first
- Ensure goals are set
- Equipments must be selected
- At least one workout day must be checked

**Debug Steps**:
1. Verify all profile fields are complete
2. Check browser console for error messages
3. Try generating a plan with different settings

### Weekly Check-in Not Working

**Common Issues**:
- Make sure you're logged in (profile exists)
- Check all rating fields are filled (1-5)
- Notes field is optional

## Nutrition Tracking

### Food Items Not Saving

**Checklist**:
- Food name is required
- Calories must be greater than 0
- At least one macro value should be entered

### Macro Calculations

**Automatic Calculations**:
- Totals are calculated automatically based on logged items
- Changes are saved instantly to IndexedDB
- Data persists across page refreshes

## Performance Issues

### Slow App Startup

**Causes**:
- Large amount of stored workout/nutrition data
- Browser running low on memory
- Too many tabs open

**Solutions**:
1. Clear old data (see reset section)
2. Close other browser tabs
3. Restart browser
4. Check available disk space

### Memory Usage

**Optimization Tips**:
- Regularly clean up old workout logs
- Archive old nutrition logs if needed
- Limit the number of saved workout plans

## Development and Debugging

### Viewing Error Messages

**Development Mode**:
- All detailed errors are visible in the UI
- Check browser console for technical details
- Network tab shows API calls (if using optional features)

**Production Mode**:
- Errors are logged to console only
- Check Application → Local Storage for stored values
- Use browser tools to debug IndexedDB

### Common Console Errors

**`TypeError: Cannot read property of undefined`**:
- Usually means profile data is incomplete
- Check profile setup completion

**`QuotaExceededError`**:
- Browser storage is full
- Clear old data or use a different browser

**IndexedDB errors**:
- Database connection issues
- Try resetting local data

### Save Errors in Development

When you see error banners:

1. **Read the error message carefully** - it usually tells you exactly what's wrong
2. **Check the validation** - make sure all required fields are complete
3. **Look for data type issues** - ensure numbers are numbers, not strings
4. **Check network connection** - if using optional API features

## Browser Compatibility

### Supporting Browsers

**Fully Supported**:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

**Limited Support**:
- Internet Explorer: Not supported
- Older browsers may have limited functionality

### Mobile Browser Issues

**iOS Safari**:
- Some versions have IndexedDB storage limits
- May need more frequent data cleanup

**Android Chrome**:
- Generally works well
- Check storage space regularly

## Getting Help

### Self-Service Resources

1. **Check this guide first** - most issues are covered here
2. **Try the reset process** - solves 80% of data-related issues
3. **Check browser console** - often has specific error messages

### Report an Issue

If you need additional help:

1. **Create a GitHub issue** with:
   - Browser version and OS
   - Steps to reproduce the problem
   - Console error messages (if any)
   - What you expected to happen
   - What actually happened

2. **Include screenshots** when relevant

3. **Be specific** - details help resolve issues faster

### Contributing

Found a bug and want to fix it?

1. Fork the repository
2. Create a feature branch
3. Fix the issue with tests
4. Submit a pull request

---

**Remember**: This app is designed to work offline. If online features aren't working, the core functionality should still be available. When in doubt, try resetting local data and starting fresh.