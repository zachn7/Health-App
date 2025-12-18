# API Keys and Settings Configuration

This document explains how to configure API keys and settings for CodePuppy Trainer integrations.

## USDA FoodData Central API Key

### What is it?
The USDA FoodData Central API provides access to comprehensive nutritional data for over 400,000 food items, including both generic and branded products.

### Why is it needed?
- Search and retrieve accurate nutritional information
- Access to detailed macro and micronutrient data
- Support for branded food products and ingredients
- Reliable government-verified nutritional data

### How to get the API key
1. Visit USDA FoodData Central: https://fdc.nal.usda.gov/data-key-access.html
2. Sign in with your USDA.gov account (create one if needed)
3. Request a free API key (Data Type: Standard API)
4. Wait for approval (usually immediate for free tier)
5. Copy your API key (starts with letters like "DEMO_KEY" or "YOUR_KEY")

### Where to configure
1. Navigate to **Settings** page in the app (top navigation → Settings)
2. Find the "USDA FoodData Central" section
3. Paste your API key in the provided field
4. Click "Save Settings"
5. Toggle "Enable USDA lookups" (automatically enabled when key is valid)

### API Key Format
Typical USDA API keys look like:
```
DEMO_KEYabcdef1234567890abcdef1234567890
YOUR_KEYzyxwv9876543210zyxwv9876543210
```

### Security and Privacy
- **Local Storage Only:** API keys are stored only in your browser's IndexedDB
- **No Server Upload:** Keys are never transmitted to our servers or committed to repositories
- **Control Revocation:** You can remove the key at any time from settings
- **Rate Limit Protection:** Built-in protection against API abuse

### Development Environment
For local development, you can also set the key using environment variables:

Create a `.env.local` file in the project root:
```env
VITE_FDC_API_KEY=DEMO_KEYabcdef1234567890abcdef1234567890
```

**Important:** `.env.local` is in `.gitignore` and will not be committed to version control.

## WebLLM AI Coach Settings

### What is it?
WebLLM enables in-browser AI coaching using local language models. No data leaves your browser.

### Configuration
1. Navigate to **Settings** page
2. Find the "WebLLM AI Coach" section
3. Toggle "Enable AI Coach" to turn on the feature
4. AI models will download when you first visit the Coach page

### Requirements
- **WebGPU Support:** Requires Chrome, Edge, or Safari with WebGPU enabled
- **Storage Space:** ~1.2GB for initial model download
- **Processing Power:** Modern device recommended for smooth operation

### Model Information
- **Model:** Llama-3.2-3B-Instruct
- **Size:** 1.2GB download
- **Purpose:** Fitness coaching and workout plan generation
- **Privacy:** All processing occurs client-side, no external communication

### Browser Compatibility
- **Chrome:** ✅ Full support
- **Edge:** ✅ Full support
- **Firefox:** ⚠️ WebGPU disabled by default
- **Safari:** ✅ Support on newer versions
- **Mobile:** ⚠️ Limited support, depends on device capabilities

## Settings Storage

### Where settings are stored
- **Primary Storage:** IndexedDB (local browser database)
- **Persistence:** Data survives browser restarts and page refreshes
- **Privacy:** All settings stored locally, no cloud synchronization

### Settings that require storage
- USDA API Key (encrypted)
- USDA Lookup toggle
- WebLLM AI Coach toggle
- Future: User preferences, appearance settings

### Data Export/Import
All settings can be exported from the Privacy page for backup or device migration.

## Troubleshooting

### USDA API Issues

**Invalid API Key**
- Verify the key is correctly copied (no extra spaces)
- Ensure key is active and not expired
- Check if you've exceeded rate limits

**Rate Limiting**
- Free tier: 1,000 requests per hour
- Exceeded limit: Wait for reset or upgrade to commercial tier
- Caching reduces API calls after initial searches

**Network Issues**
- Check internet connection for initial searches
- Cached foods work offline
- USDA API requires HTTPS (enforced by browsers)

### WebLLM Issues

**WebGPU Not Available**
- Update browser to latest version
- Enable WebGPU flags in browser settings
- Try Chrome or Edge if Safari has issues

**Model Download Failures**
- Check internet connection (1.2GB download)
- Ensure sufficient storage space
- Try refreshing and reloading model

**Performance Issues**
- Close other tabs during model loading
- Ensure device has sufficient RAM
- Consider using smaller models if available

## API Key Security Best Practices

### Do
- Store keys only in browser settings
- Remove keys when no longer needed
- Monitor API usage through USDA dashboard
- Use read-only permissions when possible

### Don't
- Commit API keys to version control
- Share keys publicly or in screenshots
- Use the same key across multiple applications
- Log or transmit keys to external services

## Rate Limiting and Fair Use

### USDA API Limits
- **Free Tier:** 1,000 requests/hour
- **Commercial:** Higher limits available
- **Burst Protection:** Built-in to prevent accidental overuse
- **Caching Strategy:** Minimizes repeated API calls

### Usage Optimization
- Search results are cached locally
- Reuse saved foods instead of repeated searches
- Batch multiple food imports when possible
- Monitor usage in USDA developer dashboard

## Getting Help

### API Key Issues
- USDA Support: fdc-support@usda.gov
- Developer Portal: https://fdc.nal.usda.gov/developers.html
- Documentation: https://fdc.nal.usda.gov/api-guide.html

### WebLLM Issues
- GitHub Issues: https://github.com/mlc-ai/web-llm/issues
- Documentation: https://llm.mlc.ai/docs/get_started/web_llm.html
- Model Information: https://llm.mlc.ai/

### App-Specific Issues
- Check Privacy page for data export/reimport
- Clear browser cache if settings get corrupted
- Contact through platform issue tracker

## Future Integrations

### Planned Settings
- Additional nutrition data sources (Open Food Facts)
- AI model selection (different sizes/capabilities)
- Export/import for workout and nutrition data
- Appearance and accessibility preferences
- Backup and sync options

### API Integration Roadmap
- Alternative exercise databases
- Body composition calculation APIs
- Wearable device integrations
- Progressive web app features

## Compliance and Legal

### Data Protection
- No personal data transmitted with API calls
- All settings stored locally
- EU GDPR compliant design
- Children's privacy considerations

### Terms of Service
- USDA: Government public domain data
- WebLLM: Apache 2.0 license compliance
- Exercise DB: MIT license
- App: No data collection or analytics

This document will be updated as new integrations and settings are added to CodePuppy Trainer.