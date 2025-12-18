# Third-Party Services Integration

This document outlines the third-party services integrated into CodePuppy Trainer and their respective licenses and terms.

## Free Exercise DB

**Source:** https://github.com/yuhonas/free-exercise-db
- **License:** MIT License
- **Data Format:** JSON
- **Usage:** Bundled with the application for offline exercise lookup
- **Data Volume:** ~1,300 exercises with detailed instructions, muscle groups, and equipment requirements

### Integration Details
- Exercises are imported into IndexedDB on first app launch
- Data is stored locally for offline access
- Search functionality supports name, body part, equipment, and difficulty filters
- Custom exercises can be added by users and stored separately

### Terms of Use
- Free for commercial and non-commercial use
- No attribution required
- Data can be modified and distributed

## WebLLM (by MLC.ai)

**Source:** https://llm.mlc.ai/package/web/
- **License:** Apache 2.0 License
- **Model:** Llama-3.2-3B-Instruct (and others)
- **Usage:** In-browser AI model for fitness coaching
- **Platform:** WebGPU-based inference

### Integration Details
- Models are downloaded and cached in the browser
- Runs entirely client-side with no server communication
- Requires WebGPU support (Chrome, Edge, Safari on supported devices)
- Domain-restricted to fitness coaching only
- Opt-in with explicit user consent

### Model Information
- **Primary Model:** Llama-3.2-3B-Instruct (1.2GB download)
- **Inference:** Client-side WebGPU
- **Privacy:** No data sent to external servers
- **Caching:** Persistent across browser sessions

### Terms of Use
- Apache 2.0 License - free for commercial use
- Models must be redistributed under same license
- No modification of model weights allowed
- Proper attribution required

## USDA FoodData Central

**Source:** https://fdc.nal.usda.gov/
- **License:** Public Domain (U.S. Government work)
- **API:** REST API requiring free API key
- **Data:** 400,000+ branded and generic food items
- **Usage:** Nutritional lookup for food items

### Integration Details
- Requires user-provided API key from USDA
- API calls made client-side directly to USDA servers
- Food items are cached locally in IndexedDB for offline access
- Supports search by food name, brand, and category
- Comprehensive nutritional data (macros, vitamins, minerals)

### API Limits
- **Free Tier:** 1,000 requests per hour
- **Rate Limiting:** Handled gracefully with user feedback
- **Data Retention:** Downloaded data is cached locally to reduce API calls

### Terms of Use
- Free API key available at https://fdc.nal.usda.gov/data-key-access.html
- Public domain nutritional data
- API keys must not be shared or committed to repositories
- Data is for personal use in dietary tracking applications

## Legal and Compliance

### Data Privacy
- **WebLLM:** All processing occurs client-side, no data leaves the browser
- **USDA API:** Only food search queries are sent, no personal data transmitted
- **Exercise DB:** Local data storage, no external communication required

### Technical Requirements
- **WebLLM:** WebGPU-compatible browser required
- **USDA API:** Internet connection for initial searches, cached for offline use
- **Exercise DB:** Fully functional offline after initial data load

### User Consent
- WebLLM requires explicit opt-in through settings
- USDA API key is user-controlled and stored locally
- All integrations can be disabled independently
- No usage tracking or analytics implemented

## Support and Updates

### WebLLM
- Supported by Apache Software Foundation
- Regular model updates through npm package
- Community support available through GitHub issues

### USDA FoodData Central
- Official government support through USDA contact channels
- API documentation and developer portal
- Regular nutritional data updates

### Free Exercise DB
- Community-maintained open source project
- GitHub issues for bug reports and feature requests
- Regular data updates from community contributors

## Alternatives and Considerations

### WebLLM Alternatives
- Other WebLLM models (different sizes and capabilities)
- Server-side LLM APIs (requires backend implementation)
- Smaller local models for reduced download size

### USDA Alternatives
- Open Food Facts (open database API)
- Nutritionix (commercial API)
- Custom food databases

### Exercise Database Alternatives
- Wger Workout Manager (open source)
- Nutritionix Exercise Database (commercial)
- Custom exercise collections

## Development Notes

### Model Management
```typescript
// WebLLM models are loaded on-demand
await webllmService.initialize(); // Downloads ~1.2GB model
```

### API Implementation
```typescript
// USDA API calls are rate-limited and cached
const foods = await usdaService.searchFoods('chicken breast');
const imported = await usdaService.importFoodItem(fdcId);
```

### Exercise Database
```typescript
// Local exercise search with filtering
const exercises = await ExerciseDBService.searchExercises('squat');
const byEquipment = await ExerciseDBService.getExercisesByEquipment('barbell');
```

### Performance Considerations
- Initial WebLLM model download may take 30-60 seconds on slower connections
- Exercise database loads ~1,300 entries (minimal performance impact)
- USDA API responses are cached to minimize network requests
- All data is stored in IndexedDB for persistence across sessions

### Future Enhancements
- Additional WebLLM models (different sizes/capabilities)
- Offline nutrition database (bulk USDA data import)
- Exercise image/integration support
- Voice input for AI coaching