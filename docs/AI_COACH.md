# AI Coach Integration - WebLLM

This document explains how the AI Coach feature works in CodePuppy Trainer using WebLLM for in-browser AI model execution.

## Overview

The AI Coach provides personalized fitness coaching using local language models that run entirely in your browser. No data is sent to external servers, ensuring complete privacy.

## Technology Stack

### WebLLM by MLC.ai
- **Framework:** WebGPU-accelerated LLM inference
- **Model:** Llama-3.2-3B-Instruct (1.2GB)
- **License:** Apache 2.0
- **Platform:** Runs in any WebGPU-enabled browser

### Key Features
- **Privacy First:** All processing occurs client-side
- **Offline Capable:** Models cached for offline use
- **Domain Specialized:** Focused on fitness and coaching
- **Context Aware:** Access to user profile and workout history

## How It Works

### 1. Model Initialization
```typescript
// Models are downloaded and cached on first use
await webllmService.initialize();
// ~1.2GB download, stored persistently
```

### 2. Context Integration
```typescript
// User profile and goals are included in prompts
const response = await webllmService.sendMessage(message, userProfile, currentPlan);
```

### 3. Structured Responses
- Workout plan generation with validated JSON schema
- Exercise modifications with specific parameters
- Coaching advice adhering to fitness domain constraints

## Capabilities

### Workout Plan Generation
- Creates personalized 4-week plans based on user profile
- Considers experience level, available equipment, and limitations
- Generates appropriate exercise selection and progression

### Exercise Modifications
- Replaces exercises with suitable alternatives
- Changes sets, reps, and intensity parameters
- Adjusts workout splits and volume

### Form and Technique Advice
- Provides exercise instructions and cues
- Suggests modifications for injuries or limitations
- Recommends appropriate exercise variations

### Nutrition Guidance
- Fitness-focused nutrition advice
- Macro target adjustments for goals
- Meal timing around workouts

## Domain Locking

The AI Coach is specifically trained and constrained to refuse non-fitness requests:

### Allowed Topics
- Exercise selection and programming
- Form correction and technique
- Workout modifications and progressions
- Injury prevention and modification
- Fitness nutrition and supplementation
- Recovery and sleep advice
- Goal setting and motivation

### Blocked Topics
- Medical advice beyond exercise modifications
- Mental health counseling
- Academic homework assistance
- General knowledge queries
- Non-fitness conversations
- Legal or financial advice

### Example Refusals
```
User: "Can you help me with my math homework?"
AI: "I'm specialized as a fitness coach and can only assist with fitness-related questions. For homework help, please consult an educational resource or tutoring service."

User: "What's the capital of France?"
AI: "My expertise is limited to fitness coaching, exercise programming, and related nutritional guidance. For general knowledge questions, please use a general search or encyclopedia."
```

## Privacy and Data Security

### Client-Side Processing
- **No Server Communication:** Models run entirely in browser
- **Local Storage:** User data never leaves the device
- **Browser Sandboxing:** Models execute in secure environment
- **No Telemetry:** No usage tracking or data collection

### Data Handling
- **Profile Context:** User stats included in prompts (stored locally)
- **Workout History:** Previous plans and logs accessible for context
- **Chat History:** Optional, stored locally, can be cleared
- **Temporary Memory:** Only current session context maintained

### Browser Requirements
- **WebGPU Support:** Required for model acceleration
- **Memory:** Minimum 4GB RAM recommended
- **Storage:** 2GB available space for model and cache
- **CPU:** Modern processor with adequate performance

## User Experience

### Initial Setup
1. Enable AI Coach in Settings (opt-in)
2. Click "Load AI Coach" on Coach page
3. Wait for model download (30-60 seconds)
4. Start chatting or generating plans

### Loading States
- **Download Progress:** Visual indicator showing model download
- **Model Loading:** Ready state when model is initialized
- **Inference:** Visual feedback during AI response generation

### Error Handling
- **WebGPU Unavailable:** Graceful fallback to deterministic coach
- **Download Failures:** Retry options and troubleshooting help
- **Model Errors:** Error recovery and alternative suggestions
- **Resource Limits:** Performance optimization suggestions

## Performance Considerations

### Hardware Requirements
- **GPU:** WebGPU-compatible graphics card preferred
- **Memory:** 8GB+ RAM recommended for optimal performance
- **Network:** Initial 1.2GB download, subsequent use offline

### Optimization Features
- **Model Caching:** Persistent storage across sessions
- **Lazy Loading:** Models download only when needed
- **Context Limiting:** Optimize token usage for faster responses
- **Battery Awareness:** Reduced performance to conserve power

### Browser Compatibility
| Browser | WebGPU Support | AI Coach Status |
|---------|---------------|------------------|
| Chrome 113+ | ✅ Full | Optimized |
| Edge 113+ | ✅ Full | Optimized |
| Safari 16.4+ | ✅ Full | Supported |
| Firefox | ⚠️ Disabled | Not Supported |
| Mobile Chrome | ✅ Varies | Device Dependent |
| Mobile Safari | ✅ Limited | Device Dependent |

## Model Information

### Llama-3.2-3B-Instruct
- **Parameters:** 3 billion
- **Context Length:** 128k tokens
- **Training Data:** Public internet data filtered for instruction following
- **Specialization:** Fine-tuned for instruction-based conversations

### Fitness Domain Adaptation
- **System Prompt:** Custom coaching instructions
- **Few-shot Examples:** Fitness coaching demonstrations
- **Output Validation:** Structured JSON schema enforcement
- **Safety Filters:** Content type restriction

## Troubleshooting

### Common Issues

**WebGPU Not Available**
- Update browser to latest version
- Enable hardware acceleration in browser settings
- Try Chrome or Edge if Safari has compatibility issues
- Restart browser and reload page

**Model Download Failures**
- Check internet connection stability
- Ensure sufficient storage space (2GB+)
- Disable ad blockers temporarily
- Try using a different network

**Performance Issues**
- Close other browser tabs
- Check available system memory
- Ensure GPU acceleration is enabled
- Restart device if performance degrades

**Incorrect AI Responses**
- Clear chat history and restart conversation
- Verify user profile information is accurate
- Check that domain constraints are working
- Provide more specific fitness-related questions

### Error Messages

| Error | Cause | Solution |
|-------|-------|----------|
| "WebGPU not available" | Browser or hardware limitation | Update browser, try different device |
| "Model download failed" | Network or storage issue | Check connection, free up storage |
| "AI model initialization failed" | System resource limitation | Close tabs, restart browser |
| "Invalid AI response" | Model output validation失败 | Clear history, retry request |

## API and Integration

### Service Interface
```typescript
// Initialize AI service
await webllmService.initialize();

// Send message with context
const response = await webllmService.sendMessage(
  userMessage,
  userProfile,
  currentWorkoutPlan
);

// Generate structured workout plan
const plan = await webllmService.generateWorkoutPlan(userProfile);

// Parse and validate modifications
const patch = await webllmService.parseWorkoutPlanPatch(aiResponse);
```

### Response Validation
- **Zod Schemas:** Type-safe response validation
- **Error Recovery:** Fallback to deterministic responses
- **Retry Logic:** Automatic retry on transient failures
- **Logging:** Debug information for troubleshooting

## Future Enhancements

### Planned Features
- **Multiple Models:** Different sizes and specializations
- **Voice Input:** Speech-to-text for workout logging
- **Exercise Recognition:** Video-based form analysis
- **Integration APIs**: Connect with wearable devices

### Community Contributions
- **Open Source:** Available for community evaluation
- **Model Training:** Domain-specific fine-tuning
- **Feedback Integration:** User response quality ratings
- **Performance Tracking**: Optimization telemetry

## Legal and Compliance

### Model Licensing
- **Llama 3.2:** Llama Community License
- **WebLLM Framework:** Apache 2.0 License
- **App Integration:** MIT License

### Data Protection
- **GDPR Compliant:** No personal data transmission
- **COPPA Safe:** No data collection from minors
- **CCPA Support:** Opt-in design, no tracking

### Terms of Use
- Use is limited to fitness coaching purposes
- Models cannot be redistributed modified
- Compliance with upstream licenses required

## Support and Resources

### Documentation
- WebLLM Documentation: https://llm.mlc.ai/docs/
- Model Information: https://llama.meta.com/
- Developer Forums: Community support available

### Bug Reports
- GitHub Issues: Tag with "AI Coach" label
- Performance Reports: Include browser/device information
- Feature Requests: Describe fitness coaching use case

### Model Information
- Training Data: Public internet up to cutoff date
- Bias Mitigation: Safety filters and content restrictions
- Updates: Regular model improvements available

The AI Coach represents a significant advancement in privacy-preserving fitness technology, bringing personalized coaching to users without compromising data privacy or requiring internet connectivity after initial setup.