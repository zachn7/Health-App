import { useState } from 'react';
import type { InjuryAssessment } from '../types';

export default function Injury() {
  const [selectedArea, setSelectedArea] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<'minor' | 'moderate' | 'severe'>('minor');
  const [assessment, setAssessment] = useState<InjuryAssessment | null>(null);
  const [isAssessing, setIsAssessing] = useState(false);

  const bodyAreas = [
    'Neck', 'Shoulders', 'Upper Back', 'Lower Back', 'Chest',
    'Arms', 'Elbows', 'Wrists', 'Hands',
    'Hips', 'Glutes', 'Quads', 'Hamstrings', 'Calves',
    'Knees', 'Ankles', 'Feet'
  ];

  const redFlagSymptoms = [
    'Sudden severe pain',
    'Inability to bear weight',
    'Visible deformity',
    'Numbness or tingling',
    'Loss of consciousness',
    'Difficulty breathing',
    'Fever with pain',
    'Pain that wakes you at night',
    'Unexplained weight loss'
  ];

  const checkRedFlags = (description: string): string[] => {
    const desc = description.toLowerCase();
    return redFlagSymptoms.filter(symptom => 
      desc.includes(symptom.toLowerCase()) || 
      symptom.toLowerCase().includes(desc)
    );
  };

  const generateAssessment = () => {
    setIsAssessing(true);
    
    // Simulate processing time
    setTimeout(() => {
      const redFlags = checkRedFlags(description);
      const seekMedical = severity === 'severe' || redFlags.length > 0;
      
      const newAssessment: InjuryAssessment = {
        area: selectedArea,
        description,
        severity,
        redFlags,
        recommendation: generateRecommendation(selectedArea, severity, redFlags),
        seekMedicalAttention: seekMedical,
        createdAt: new Date().toISOString()
      };
      
      setAssessment(newAssessment);
      setIsAssessing(false);
      
      // TODO: Implement injury assessment saving
      console.log('Injury assessment:', newAssessment);
      // repositories.progress.saveInjuryAssessment(newAssessment).catch(console.error);
    }, 1000);
  };

  const generateRecommendation = (area: string, severity: string, redFlags: string[]): string => {
    if (redFlags.length > 0 || severity === 'severe') {
      return `Given the symptoms described, especially ${redFlags.length > 0 ? redFlags.join(', ') : 'the severity'}, immediate medical evaluation is recommended. Please contact a healthcare professional or visit urgent care.`;
    }
    
    const areaRecommendations: { [key: string]: string } = {
      'neck': 'Consider gentle neck stretches, maintain good posture, and avoid prolonged positions. Apply ice if there was acute onset.',
      'shoulders': 'Rest the affected shoulder, try gentle range of motion exercises, and consider ice for acute discomfort. Avoid overhead activities.',
      'lower back': 'Gentle movement and stretching often help. Maintain good posture and consider heat for muscle tension. Avoid heavy lifting.',
      'knees': 'Rest and elevation can help. Consider ice for acute discomfort and gentle range of motion exercises. Avoid high-impact activities.',
      'ankles': 'R.I.C.E. protocol (Rest, Ice, Compression, Elevation) is recommended. Gentle range of motion exercises as tolerated.'
    };
    
    return areaRecommendations[area] || 'Rest the affected area, consider ice/heat therapy, and gentle stretching. If symptoms persist or worsen, consult a healthcare professional.';
  };

  const resetForm = () => {
    setSelectedArea('');
    setDescription('');
    setSeverity('minor');
    setAssessment(null);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Discomfort Helper</h1>
        <p className="mt-2 text-gray-600">Get guidance for minor discomfort and injury prevention</p>
      </div>
      
      <div className="card">
        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
          <h3 className="text-sm font-medium text-red-900 mb-2">
            ⚠️ Important Medical Disclaimer
          </h3>
          <p className="text-sm text-red-700">
            This tool provides general guidance for minor discomfort only. It is not medical advice. 
            For severe pain, numbness, or serious symptoms, seek immediate medical attention.
          </p>
        </div>
        
        {!assessment ? (
          <div className="space-y-6">
            <div>
              <label className="label">Which area is affected?</label>
              <select
                value={selectedArea}
                onChange={(e) => setSelectedArea(e.target.value)}
                className="input"
                required
              >
                <option value="">Select an area</option>
                {bodyAreas.map(area => (
                  <option key={area} value={area.toLowerCase()}>
                    {area}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="label">Describe your discomfort</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="input"
                rows={4}
                placeholder="Please describe what you're feeling, when it started, and what makes it better or worse..."
                required
              />
            </div>
            
            <div>
              <label className="label">How would you rate the severity?</label>
              <div className="grid grid-cols-3 gap-4">
                <label className="flex items-center space-x-2">
                  <input
                    type="radio"
                    value="minor"
                    checked={severity === 'minor'}
                    onChange={(e) => setSeverity(e.target.value as any)}
                    className="text-primary-600"
                  />
                  <span className="text-sm">
                    <div className="font-medium">Minor</div>
                    <div className="text-gray-500">Annoying but manageable</div>
                  </span>
                </label>
                
                <label className="flex items-center space-x-2">
                  <input
                    type="radio"
                    value="moderate"
                    checked={severity === 'moderate'}
                    onChange={(e) => setSeverity(e.target.value as any)}
                    className="text-primary-600"
                  />
                  <span className="text-sm">
                    <div className="font-medium">Moderate</div>
                    <div className="text-gray-500">Affects daily activities</div>
                  </span>
                </label>
                
                <label className="flex items-center space-x-2">
                  <input
                    type="radio"
                    value="severe"
                    checked={severity === 'severe'}
                    onChange={(e) => setSeverity(e.target.value as any)}
                    className="text-primary-600"
                  />
                  <span className="text-sm">
                    <div className="font-medium">Severe</div>
                    <div className="text-gray-500">Difficult to function</div>
                  </span>
                </label>
              </div>
            </div>
            
            <div className="flex gap-4">
              <button
                onClick={generateAssessment}
                disabled={!selectedArea || !description || isAssessing}
                className="btn btn-primary flex-1"
              >
                {isAssessing ? 'Assessing...' : 'Get Assessment'}
              </button>
              
              <button
                onClick={resetForm}
                className="btn btn-secondary"
              >
                Clear
              </button>
            </div>
            
            {/* Red Flags Warning */}
            {checkRedFlags(description).length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <h4 className="text-sm font-medium text-red-900 mb-2">
                  ⚠️ Red Flag Symptoms Detected
                </h4>
                <p className="text-sm text-red-700">
                  The following symptoms in your description require immediate medical attention: 
                  {checkRedFlags(description).join(', ')}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            <div className={`p-4 rounded-md ${
              assessment.seekMedicalAttention 
                ? 'bg-red-50 border border-red-200' 
                : 'bg-green-50 border border-green-200'
            }`}>
              <h3 className={`font-medium mb-2 ${
                assessment.seekMedicalAttention 
                  ? 'text-red-900' 
                  : 'text-green-900'
              }`}>
                {assessment.seekMedicalAttention ? '🚨 Seek Medical Attention' : '🟢 General Guidance Recommended'}
              </h3>
              
              <div className="space-y-3">
                <div>
                  <strong>Area:</strong> {assessment.area}
                </div>
                
                <div>
                  <strong>Severity:</strong> {assessment.severity}
                </div>
                
                <div>
                  <strong>Recommendation:</strong>
                  <p className="mt-1">{assessment.recommendation}</p>
                </div>
                
                {assessment.redFlags.length > 0 && (
                  <div>
                    <strong>Red Flags:</strong>
                    <ul className="mt-1 list-disc list-inside">
                      {assessment.redFlags.map((flag, index) => (
                        <li key={index} className="text-red-700">{flag}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex gap-4">
              <button
                onClick={resetForm}
                className="btn btn-primary"
              >
                New Assessment
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}