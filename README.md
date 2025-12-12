# CodePuppy Trainer 🐕

**🌐 Live Demo:** https://zachn7.github.io/Health-App/

An offline-first AI-style personal trainer and fitness tracker built with privacy as the top priority. Your health data stays on your device - no cloud sync, no tracking, no ads.

## ✨ Key Features

### 🔒 Privacy First
- **100% Offline-First**: All data stored locally using IndexedDB
- **Zero Tracking**: No analytics, cookies, or third-party scripts
- **Data Control**: Export or delete all data with one click
- **Age Gate**: 13+ age requirement with privacy compliance

### 🏋️ Fitness Tracking
- **Profile Management**: Personal metrics, goals, equipment, schedule
- **AI Coach System**: Rule-based offline workout generation
- **Workout Logger**: Sets, reps, weight, RPE, and progress tracking
- **Exercise Library**: Offline exercise database with instructions
- **Progress Analytics**: Weight trends, strength gains, adherence metrics

### 🍎 Nutrition Tracking
- **Food Logging**: Manual entry with calories and macros
- **Nutrition Database**: Offline food library (100-300 foods)
- **Meal Templates**: Save and reuse favorite meals
- **Macro Targets**: Calorie and macronutrient goal tracking

### 🏥 Injury Prevention
- **Guardrailed Guidance**: General help for minor discomfort only
- **Red Flag Detection**: Automatic medical escalation warnings
- **Form & Load Management**: Training adjustments based on symptoms
- **Medical Disclaimers**: Clear safety messaging throughout

### 📱 Modern UX
- **Responsive Design**: Works beautifully on mobile and desktop
- **Progressive Web App**: Install as native app, works offline
- **Quick Actions**: Dashboard with today's summary and quick logging
- **Professional UI**: Clean, accessible interface with TailwindCSS

## 🛠️ Technology Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for fast development and building
- **TailwindCSS** for responsive styling
- **React Router** for navigation
- **Lucide React** for icons

### Forms & Validation
- **React Hook Form** for form management
- **Zod** for TypeScript validation

### Data & Storage
- **IndexedDB** via **Dexie** for offline storage
- **Schema migrations** and versioning
- **JSON export/import** for data portability

### Development
- **Vitest** for unit testing
- **Playwright** for E2E testing
- **ESLint + Prettier** for code quality
- **Vite PWA** for Progressive Web App features

### Charts & Analytics
- **Recharts** for data visualization
- **Custom analytics** for fitness progress

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ and npm
- Modern web browser with IndexedDB support

### Installation

```bash
# Clone the repository
git clone https://github.com/zachn7/Health-App.git
cd Health-App

# Install dependencies
npm install

# Start development server
npm run dev

# Open http://localhost:5173
```

### Build for Production

```bash
# Build the application
npm run build

# Preview the build
npm run preview

# Build with docs folder for GitHub Pages
npm run build:docs
```

## 📱 Usage

1. **Age Gate**: Confirm you're 13+ years old to proceed
2. **Onboarding**: Set up your profile with basic information
3. **Dashboard**: View today's workout plan and quick actions
4. **Coach**: Generate personalized training plans
5. **Workouts**: Log sets, reps, weight, and cardio sessions
6. **Nutrition**: Track meals and monitor macros
7. **Progress**: View trends and achievements
8. **Privacy**: Export your data or delete everything anytime

## 🏗️ Project Structure

```
src/
├── components/          # Reusable React components
│   ├── AgeGate.tsx     # Age verification component
│   ├── Layout.tsx      # Main app layout
│   └── Navigation.tsx # Responsive navigation
├── db/                  # IndexedDB configuration
│   └── index.ts        # Database schema and helpers
├── hooks/               # Custom React hooks
│   └── useLocalStorage.ts
├── pages/               # Main application pages
│   ├── Dashboard.tsx   # Main overview
│   ├── Profile.tsx     # User profile settings
│   ├── Coach.tsx       # AI training coach
│   ├── Workouts.tsx    # Workout plans
│   ├── WorkoutLogger.tsx # Session logging
│   ├── Nutrition.tsx   # Food tracking
│   ├── Progress.tsx    # Analytics dashboard
│   ├── Injury.tsx      # Discomfort helper
│   ├── Privacy.tsx     # Data management
│   └── legal/          # Legal compliance pages
├── types/               # TypeScript definitions
│   └── index.ts        # All data models
└── test/               # Test configuration
    └── setup.ts       # Vitest setup
```

## 🔐 Privacy & Security

- ✅ **No Network Calls**: Works completely offline
- ✅ **Local Storage Only**: IndexedDB for all user data
- ✅ **No Third-Party Tracking**: Zero analytics or ads
- ✅ **Data Export**: JSON export for backup/migration
- ✅ **Complete Deletion**: One-click data removal
- ✅ **Age Verification**: 13+ requirement enforced
- ✅ **Medical Disclaimers**: Clear safety messaging
- ✅ **HIPAA-Like Safeguards**: Designed with healthcare privacy principles

## 📋 Compliance

- **COPPA Compliant**: 13+ age gate, no child data collection
- **FTC Health Breach Ready**: Offline storage model prevents breaches
- **FDA Device Boundaries**: No diagnosis claims, general wellness only
- **Privacy by Design**: Minimal data collection, maximum user control

## 🔮 Future Features (Planned)

- **Advanced AI Coach**: Swap rule engine for local LLM
- **Barcode Scanning**: Offline barcode detection via Web APIs
- **Exercise Videos**: Embedded form check videos
- **Workout Sharing**: Export/import training plans
- **Advanced Analytics**: More sophisticated progress tracking
- **Goal Setting**: SMART goals and milestone tracking

## 🧪 Testing

```bash
# Run unit tests
npm test

# Run tests with UI
npm run test:ui

# Run E2E tests
npm run test:e2e

# Type checking
npm run type-check
```

## 📄 License

This project is open source and available under the MIT License.

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📞 Support

- **Issues**: Report bugs via GitHub Issues
- **Features**: Request features via GitHub Issues
- **Questions**: Check existing discussions or create new ones

## 🙏 Acknowledgments

- Built with modern web technologies for privacy-first fitness tracking
- Inspired by the need for truly private health applications
- Dedicated to users who value data sovereignty

---

**🐕 CodePuppy Trainer** - Your private fitness companion that respects your data as much as your gains.

*Built with ❤️ for privacy-conscious fitness enthusiasts*