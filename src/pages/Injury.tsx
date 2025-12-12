import React from 'react';

export default function Injury() {
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
        
        <h2 className="text-xl font-medium text-gray-900 mb-4">Coming Soon</h2>
        <p className="text-gray-600">Injury assessment and guidance will be available soon.</p>
      </div>
    </div>
  );
}