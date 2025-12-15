# Optional API Keys and Settings

This document explains the optional API keys and settings you can configure in the app.

## Overview

The Health App is designed to work fully offline. However, some optional features require API keys to enhance functionality. All API keys are optional and the app works perfectly without them.

## Optional Features

### Open Food Facts Barcode Lookup

**Purpose**: Automatically fetch food nutrition information using barcode scanning.

**API Required**: None (free public API)

**Usage**: This feature is disabled by default. When enabled, you can scan barcodes or search for products to automatically populate nutrition data.

**Cache Policy**: All fetched foods are automatically cached to IndexedDB for offline use.

### USDA FoodData Central Search

**Purpose**: Access the comprehensive USDA food database for detailed nutrition information.

**API Required**: USDA FoodData Central API key (free)

**How to Get Key**:
1. Visit [USDA FoodData Central](https://fdc.nal.usda.gov/api-key-signup)
2. Sign up for a free API key
3. Copy your API key

**Where to Paste Key**:
1. Go to Settings → Advanced
2. Find "USDA FoodData Central API Key"
3. Paste your API key in the field
4. Click Save

**Cache Policy**: All search results are automatically cached to IndexedDB for offline use.

## Implementation Details

### Storage

All API keys are stored locally in:
- Location: Browser's IndexedDB
- Encryption: Keys are stored encrypted at rest
- Sync: Keys never sync with any external service

### Security

- Keys are only used for the specific API they're intended for
- No keys are transmitted to third-party services
- Keys are never logged or transmitted to app developers
- Keys are stored only on your device

### Reset

To clear all stored keys and cached data:
1. Go to Settings → Advanced
2. Click "Reset Local Data"
3. Confirm the reset

## Troubleshooting

### USDA API Key Issues

**If you get "Invalid API Key" errors**:
1. Double-check that you copied the full key (typically 64 characters)
2. Ensure there are no extra spaces before/after the key
3. Verify your key is still active on the USDA portal
4. Try regenerating a new key if the issue persists

**If search returns no results**:
1. Check if you have enough API quota left
2. Some foods may not be available in the USDA database
3. Try searching with more general terms

### Open Food Facts Issues

**If barcode lookup fails**:
1. Ensure you have an active internet connection
2. The barcode might not be in the Open Food Facts database
3. Try manual nutrition entry as a backup

### Cache Issues

**If cached food data seems outdated**:
1. Go to Settings → Advanced
2. Click "Clear Food Cache"
3. The next lookup will fetch fresh data

## API Limits

### USDA FoodData Central
- **Free Tier**: 1,000 requests per hour
- **Rate Limiting**: Automatic retry with exponential backoff
- **Recommendation**: Enable caching to minimize API calls

### Open Food Facts
- **No API Key Required**: Public usage
- **Rate Limiting**: Based on IP address
- **Recommendation**: Cache results to be respectful of the service

## Privacy Notice

- No API keys or usage data is ever transmitted to app developers
- All API calls are made directly from your device to the respective service
- No analytics or tracking is performed on API usage
- Your privacy is fully maintained

## Support

If you encounter issues with optional API features:

1. First try the troubleshooting steps above
2. Check the main troubleshooting guide for common issues
3. Create an issue on the GitHub repository
4. Include error messages and steps to reproduce

Remember: All these features are optional. The app works perfectly offline without any API keys.