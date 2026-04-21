# FitBud AI 💪

**🌐 Live Demo:** https://zachn7.github.io/Health-App/

**Your all-in-one AI fitness companion** — workout logging, nutrition tracking, AI-powered program generation, smart meal planning, and adaptive coaching that evolves with you. Built **offline-first** (local IndexedDB), private, and ad-free — with optional online integrations (USDA + hosted AI via secure proxy).

---

## 🎯 What is FitBud AI?

FitBud AI is a privacy-first fitness companion designed to help you **reach your goals faster** by combining detailed progress tracking with AI-assisted planning and coaching. Whether you're cutting, bulking, or chasing a new PR, FitBud AI adapts to *your* goals and *your* data — not a one-size-fits-all template.

- **AI-Assisted Workout & Meal Planning** — Generate personalized training programs and meal plans based on your goals, equipment, schedule, and preferences
- **Smart Calorie Adjustment** — Automatically adjusts your calorie and macro targets based on weight trends and your chosen goal (cut, maintain, bulk)
- **AI Coaching & Program Optimization** — Get AI-driven feedback to refine your programs, periodize your training, and break through plateaus
- **Workout & Nutrition Logging** — Track every set, rep, and meal with a fast, intuitive interface
- **Progress Analytics** — Visualize weight trends, strength gains, adherence, and more
- **Offline-First & Private** — Your data lives locally (IndexedDB). No accounts, no cloud sync, no tracking. Optional integrations (USDA + hosted AI) make network calls only when you enable/use them.

---

## ✨ Key Features

### 🤖 AI-Powered Fitness Companion
- **AI Coach (Local + Hosted)**:
  - **Deterministic Coach Engine (offline)** for stable plan generation
  - **WebLLM (in-browser, optional)** for free on-device AI (WebGPU permitting)
  - **OpenAI Coach via Secure Proxy (optional)** for higher-quality chat + actions **without exposing your API key in the browser**
- **Assistant Tool Calling ("do things in the app")** *(when enabled in Settings)*:
  - Log **food**, **workouts**, and **weight** directly into your local data
  - Create **meal/workout plan drafts** and guide you to save/apply them
  - Navigate you to the right page (Nutrition, Workout Logger, Progress, etc.)
- **Automatic Fallback**: If hosted AI hits quota/billing errors, the app auto-falls back to **WebLLM** (if available) or **deterministic**.
- **Exercise Form Coaching**: Ask how to do an exercise and get step-by-step cues + common mistakes.
- **Adaptive Calorie Targets**: Calories and macros auto-adjust based on real weight trends and your selected goal

### 🏋️ Fitness Tracking
- **Profile Management**: Personal metrics, goals, equipment, and schedule
- **Workout Logger**: Sets, reps, weight, RPE, and progress tracking
- **Exercise Library**: Offline exercise database with instructions
- **Progress Analytics**: Weight trends, strength gains, adherence metrics

### 🍎 Nutrition Tracking
- **Food Logging**: Manual entry with calories and macros
- **USDA Food Database**: Search thousands of foods via FoodData Central
- **Meal Templates & Plans**: Save and reuse favorite meals; generate full meal plans
- **Macro Targets**: Calorie and macronutrient goal tracking with custom splits
- **Dynamic Adjustments**: Targets shift as your body changes

### 🏥 Injury Prevention
- **Guardrailed Guidance**: General help for minor discomfort only
- **Red Flag Detection**: Automatic medical escalation warnings
- **Form & Load Management**: Training adjustments based on symptoms
- **Medical Disclaimers**: Clear safety messaging throughout

### 🔒 Privacy First
- **100% Offline-First**: All data stored locally using IndexedDB
- **Zero Tracking**: No analytics, cookies, or third-party scripts
- **Data Control**: Export or delete all data with one click
- **Age Gate**: 13+ age requirement with privacy compliance

### 📱 Modern UX
- **Responsive Design**: Works beautifully on mobile and desktop
- **Progressive Web App**: Install as native app, works offline
- **Quick Actions**: Dashboard with today's summary and quick logging
- **Professional UI**: Clean, accessible interface with TailwindCSS

---

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

### AI & Intelligence
- **WebLLM** for in-browser AI model execution (optional)
- **Secure OpenAI Proxy Provider (optional)** for hosted chat + tool calling (no key in client)
- **Deterministic Coach Engine** for offline-first workout generation
- **Weight trend analysis** for adaptive calorie adjustments

### Development
- **Vitest** for unit testing
- **Playwright** for E2E testing
- **ESLint + Prettier** for code quality
- **Vite PWA** for Progressive Web App features

### Charts & Analytics
- **Recharts** for data visualization
- **Custom analytics** for fitness progress

---

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

---

## 📱 Usage

1. **Age Gate** — Confirm you're 13+ years old to proceed
2. **Onboarding** — Set up your profile with goals, equipment, and schedule
3. **Dashboard** — View today's workout plan, nutrition summary, and quick actions
4. **Coach** — Generate and refine personalized training programs with AI assistance
5. **Workouts** — Browse plans, log sets/reps/weight, and track cardio sessions
6. **Nutrition** — Log meals, search foods, and monitor macros with adaptive targets
7. **Progress** — Visualize weight trends, strength gains, and program adherence
8. **Privacy** — Export your data or delete everything anytime

---

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
│   ├── Meals.tsx       # Meal plans & templates
│   ├── Progress.tsx    # Analytics dashboard
│   ├── Injury.tsx      # Discomfort helper
│   ├── Privacy.tsx     # Data management
│   └── legal/          # Legal compliance pages
├── types/               # TypeScript definitions
│   └── index.ts        # All data models
└── test/               # Test configuration
    └── setup.ts       # Vitest setup
```

---

## 🔐 Privacy & Security

- ✅ **Offline-first by default**: Core logging and planning works without a backend
- ✅ **Optional network calls only**: USDA search and hosted AI (via your proxy) are opt-in and clearly surfaced
- ✅ **Local Storage Only (for your data)**: IndexedDB for all user logs, settings, and plans
- ✅ **No Third-Party Tracking**: Zero analytics or ads
- ✅ **Data Export**: JSON export for backup/migration
- ✅ **Complete Deletion**: One-click data removal
- ✅ **Age Verification**: 13+ requirement enforced
- ✅ **Medical Disclaimers**: Clear safety messaging
- ✅ **HIPAA-Like Safeguards**: Designed with healthcare privacy principles

---

## 📋 Compliance

- **COPPA Compliant**: 13+ age gate, no child data collection
- **FTC Health Breach Ready**: Offline storage model prevents breaches
- **FDA Device Boundaries**: No diagnosis claims, general wellness only
- **Privacy by Design**: Minimal data collection, maximum user control

---

## 🔮 Future Features (Planned)

- **Sleep Tracking**: Log sleep duration and quality so FitBud AI can factor recovery into your programming — because real fitness is more than just gym time
- **Performance Analytics & AI Optimization**: Track and analyze actual workout performance (volume, intensity, progression) so the AI can identify weak points, suggest deloads, and continuously optimize your programs to keep you on track toward your goals
- **Advanced AI Coach**: Swap rule engine for local LLM with richer conversational coaching
- **Barcode Scanning**: Offline barcode detection via Web APIs
- **Exercise Videos**: Embedded form check videos
- **Workout Sharing**: Export/import training plans
- **SMART Goals**: Goal setting with milestones and progress tracking

---

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

---

## 📄 License

This project is open source and available under the MIT License.

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📞 Support

- **Issues**: Report bugs via GitHub Issues
- **Features**: Request features via GitHub Issues
- **Questions**: Check existing discussions or create new ones

---

## 🙏 Acknowledgments

- Built with modern web technologies for privacy-first fitness tracking
- Inspired by the need for truly private health applications
- Dedicated to users who value data sovereignty

---

**💪 FitBud AI** — Your all-in-one AI fitness companion. Track progress. Generate plans. Optimize everything.

*Built with ❤️ for privacy-conscious fitness enthusiasts*
