# Third-Party Libraries and Data Sources

## Core Dependencies

### Frontend Framework
- **React**: v18.x - MIT License
  - Used for component-based UI development
- **TypeScript**: v5.x - Apache License 2.0
  - Type safety and enhanced development experience

### Routing
- **React Router DOM**: v6.x - MIT License
  - Navigation and routing using HashRouter for GitHub Pages compatibility

### Storage & Database
- **Dexie.js**: v3.x - Apache License 2.0
  - IndexedDB wrapper for offline-first data storage
  - Provides type-safe database operations and schema migrations

### Build Tools
- **Vite**: v5.x - MIT License
  - Fast build tool and development server
- **PostCSS**: v8.x - MIT License
  - CSS processing and optimization
- **Tailwind CSS**: v3.x - MIT License
  - Utility-first CSS framework for styling

## PWA & Service Worker
- **Workbox**: v6.x - Apache License 2.0
  - Service worker utilities for offline functionality
  - Caching strategies and PWA capabilities

## Testing Frameworks
- **Vitest**: v1.x - MIT License
  - Unit testing framework
- **Playwright**: v1.x - Apache License 2.0
  - End-to-end testing automation

## Bundled Data Sources

### Exercise Library
- **Source**: Custom-built exercise library
- **License**: Custom (created for this project)
- **Size**: ~7.2KB (exercises.seed.json)
- **Format**: JSON with exercise metadata including:
  - Exercise names and IDs
  - Body part focus
  - Equipment requirements
  - Difficulty levels
  - Instructions and coaching cues
  - Categories (compound vs isolation)

### Food Database
- **Source**: Custom-built food database
- **License**: Custom (created for this project)
- **Size**: ~2.7KB (foods.seed.json)
- **Format**: JSON with food metadata including:
  - Food names and serving sizes
  - Calorie and macronutrient information
  - Fiber, sugar, and sodium data
  - Barcodes for future barcode scanning

## Optional Online Data Sources (User-Enabled)

### Exercise Data
- **WGER Workout Manager**: https://wger.de/en/software/api
  - **License**: Creative Commons Attribution-ShareAlike 3.0 (CC BY-SA 3.0)
  - **Usage**: Optional exercise database synchronization
  - **API Key**: Not required
  - **Note**: Data is cached locally after retrieval for offline use

### Food Data
#### Open Food Facts
- **Source**: https://world.openfoodfacts.org/api
  - **License**: Open Database License (ODbL)
  - **Usage**: Barcode product lookup and nutrition information
  - **API Key**: Not required (rate limited)
  - **Note**: Results cached in IndexedDB for offline reuse

#### USDA FoodData Central
- **Source**: https://fdc.nal.usda.gov/api-guide.html
  - **License**: Public Domain (US government data)
  - **Usage**: Comprehensive nutrition database
  - **API Key**: Required (user-provided in settings)
  - **Note**: Advanced users can add their own API key for expanded access
  - **Rate Limits**: 1,000 requests/hour with API key

## Development Dependencies

### Code Quality
- **ESLint**: v8.x - MIT License
  - Code linting and style enforcement
- **TypeScript Compiler**: v5.x - Apache License 2.0
  - Type checking and compilation

## Font Assets
- **System Fonts**: Uses system font stack
  - No external font dependencies
  - Reduces bundle size and improves performance

## Icon Library
- **Heroicons**: v2.x - MIT License
  - SVG icons used throughout the application
  - Icons are inlined in JSX (no additional requests)

## Analytics and Tracking
- **NONE USED** - As per non-negotiable requirements:
  - No Google Analytics
  - No third-party tracking pixels
  - No telemetry or usage monitoring
  - Complete user privacy

## External API Calls

### Offline-First Approach
- **Core Functionality**: No external API calls required
- **All Features Work**: Without internet connection after initial load
- **Data persistence**: Local IndexedDB storage

### Optional Online Features
These are user-opt-in and core app works without them:
1. Exercise data synchronization with WGER
2. Barcode lookup with Open Food Facts
3. USDA FoodData Central (user-provided API key)

## Security Considerations

### Data Privacy
- **Local Storage**: All user data stored locally in IndexedDB
- **No Server Uploads**: No data transmitted to external servers
- **Export/Import**: Users maintain full control of their data

### API Security
- **No Required Keys**: Core features don't need API keys
- **Key Storage**: Optional API keys stored locally in IndexedDB
- **HTTPS Only**: All API communication over HTTPS

## License Compliance

### Commercial Usage
All used libraries have permissive licenses allowing:
- Commercial use
- Distribution
- Modification
- Private use

### Attribution Requirements
- **Dexie.js**: Requires license notice
- **WGER Data**: Requires CC BY-SA 3.0 attribution
- **Open Food Facts**: Requires ODbL attribution

### Code Attribution
Appropriate license notices and attributions are included in:
- Package.json license fields
- Source code file headers where required
- Documentation acknowledgments

## Bundle Size Impact

### Total JavaScript Bundle
- **Main Bundle**: ~112KB gzipped
- **Vendor Libraries**: ~45KB gzipped
- **Total**: ~157KB gzipped

### Largest Dependencies
1. Workbox/Service Worker: ~74KB (enables offline)
2. React Router: ~23KB (navigation)
3. Dexie.js: ~26KB (database operations)

### Optimization Strategies
- Code splitting for dynamic imports
- Tree shaking removes unused code
- Compression and minification
- Lazy loading of optional features

## Future Considerations

### Potential Additions
These would require additional evaluation:
- WebLLM for on-device AI coaching
- Additional food databases
- Exercise video integration
- Progress charting libraries

### Security Updates
- Regular dependency updates for security patches
- Monitor for CVEs in used libraries
- Keep TypeScript and build tools current

## Data Source Quality

### Exercise Data Quality
- **Accuracy**: Manually reviewed and curated
- **Completeness**: Comprehensive exercise selection
- **Safety**: Instructions include proper form cues
- **Accessibility**: Modifications for different fitness levels

### Nutrition Data Quality
- **Accuracy**: Cross-referenced with multiple sources
- **Completeness**: Standard macronutrient profiles
- **Standardization**: Consistent serving sizes and units
- **Verification**: Regular updates and corrections