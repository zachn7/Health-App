import React from 'react';

export default function MedicalDisclaimer() {
  const lastUpdated = 'December 2024';

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Medical Disclaimer</h1>
        <p className="mt-2 text-gray-600">Last updated: {lastUpdated}</p>
      </div>
      
      <div className="space-y-6">
        <div className="card bg-red-50 border-red-200">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <span className="text-2xl">⚠️</span>
            </div>
            <div className="ml-3">
              <h2 className="text-xl font-bold text-red-900 mb-2">Important Medical Notice</h2>
              <p className="text-red-800">
                The information provided by CodePuppy Trainer is for educational and informational purposes only 
                and is not a substitute for professional medical advice, diagnosis, or treatment.
              </p>
            </div>
          </div>
        </div>
        
        <div className="card">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Not Medical Advice</h2>
          <div className="space-y-4 text-gray-600">
            <p>
              <strong className="text-gray-900">CodePuppy Trainer is not a medical device.</strong> The workout plans, 
              nutritional suggestions, and injury guidance provided are based on general fitness principles and 
              should not be considered personalized medical advice.
            </p>
            
            <p>
              <strong className="text-gray-900">No Doctor-Patient Relationship:</strong> Using this app does not create 
              a doctor-patient relationship or any other healthcare provider relationship.
            </p>
            
            <p>
              <strong className="text-gray-900">Treatment Limitations:</strong> We do not diagnose, treat, cure, or prevent 
              any disease or medical condition. The app does not provide medical treatment or therapy.
            </p>
          </div>
        </div>
        
        <div className="card">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Consult Healthcare Professionals</h2>
          <div className="space-y-4 text-gray-600">
            <p>
              <strong className="text-gray-900">Before Starting:</strong> Always consult with a qualified healthcare professional 
              before beginning any new exercise program, nutrition plan, or making changes to your fitness routine, 
              especially if you have:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Pre-existing medical conditions</li>
              <li>Heart disease, diabetes, or high blood pressure</li>
              <li>Joint problems or previous injuries</li>
              <li>Pregnancy or recent childbirth</li>
              <li>Any other health concerns</li>
            </ul>
            
            <p>
              <strong className="text-gray-900">Regular Check-ups:</strong> Continue regular medical check-ups and follow 
              your healthcare provider's recommendations for your specific health needs.
            </p>
          </div>
        </div>
        
        <div className="card">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Red Flag Symptoms</h2>
          <div className="space-y-4 text-gray-600">
            <p>
              <strong className="text-gray-900">Stop Immediately and Seek Medical Attention if you experience:</strong>
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Chest pain, pressure, or discomfort</li>
              <li>Severe shortness of breath</li>
              <li>Dizziness, lightheadedness, or fainting</li>
              <li>Severe headache or vision changes</li>
              <li>Numbness, tingling, or weakness</li>
              <li>Sudden, severe pain</li>
              <li>Unexplained bleeding or swelling</li>
              <li>Any other concerning symptoms</li>
            </ul>
          </div>
        </div>
        
        <div className="card">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Injury and Pain</h2>
          <div className="space-y-4 text-gray-600">
            <p>
              <strong className="text-gray-900">Pain is a Warning Sign:</strong> Never push through sharp or persistent pain. 
              Mild muscle soreness is normal, but sharp, shooting, or persistent pain may indicate injury.
            </p>
            
            <p>
              <strong className="text-gray-900">Proper Form:</strong> Always prioritize proper form over heavy weights or high intensity. 
              Consider working with a qualified fitness professional to learn correct techniques.
            </p>
            
            <p>
              <strong className="text-gray-900">Gradual Progression:</strong> Increase intensity, duration, and weight gradually 
              to avoid overuse injuries and allow your body to adapt.
            </p>
          </div>
        </div>
        
        <div className="card">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Nutrition Guidelines</h2>
          <div className="space-y-4 text-gray-600">
            <p>
              <strong className="text-gray-900">General Recommendations:</strong> Nutritional information provided is based on 
              general dietary guidelines and may not be appropriate for everyone.
            </p>
            
            <p>
              <strong className="text-gray-900">Individual Needs:</strong> Nutritional needs vary based on age, sex, activity level, 
              health conditions, medications, and other factors. Consult a registered dietitian or healthcare provider 
              for personalized nutrition advice.
            </p>
            
            <p>
              <strong className="text-gray-900">Dietary Restrictions:</strong> If you have food allergies, intolerances, medical 
              conditions requiring specific diets, or other dietary restrictions, consult appropriate healthcare professionals.
            </p>
          </div>
        </div>
        
        <div className="card">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Emergency Situations</h2>
          <div className="space-y-4 text-gray-600">
            <p>
              <strong className="text-gray-900">Call Emergency Services Immediately (911 in US) if you experience:</strong>
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Symptoms of heart attack (chest pain, arm pain, shortness of breath)</li>
              <li>Stroke symptoms (facial drooping, arm weakness, speech difficulty)</li>
              <li>Severe allergic reactions</li>
              <li>Loss of consciousness</li>
              <li>Any life-threatening emergency</li>
            </ul>
          </div>
        </div>
        
        <div className="card">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Liability Limitation</h2>
          <div className="space-y-4 text-gray-600">
            <p>
              By using CodePuppy Trainer, you acknowledge and agree that you are responsible for your own health 
              and safety. The application and its creators are not liable for any injuries, health issues, or damages 
              that may result from following the information provided.
            </p>
            
            <p>
              You assume full responsibility for any risks, injuries, or damage, known or unknown, which you might 
              incur as a result of using this application.
            </p>
          </div>
        </div>
        
        <div className="card bg-blue-50 border-blue-200">
          <h2 className="text-xl font-bold text-blue-900 mb-4">Your Health is Your Responsibility</h2>
          <div className="space-y-4 text-blue-800">
            <p>
              This app is designed to be a helpful tool for fitness and health tracking, but it cannot replace 
              professional medical advice. Always prioritize your health and safety by consulting with qualified 
              healthcare professionals for any medical concerns.
            </p>
            
            <p>
              <strong>Listen to your body, use common sense, and when in doubt, seek professional medical advice.</strong>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}