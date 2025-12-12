import { useState } from 'react';
import { clearAllData, exportAllData } from '../db';

export default function Privacy() {
  const [isClearing, setIsClearing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  
  const handleClearAllData = async () => {
    if (!confirm('Are you sure you want to delete all data? This action cannot be undone.')) {
      return;
    }
    
    setIsClearing(true);
    try {
      await clearAllData();
      alert('All data has been cleared successfully.');
      window.location.href = '/onboarding';
    } catch (error) {
      alert('Failed to clear data. Please try again.');
    } finally {
      setIsClearing(false);
    }
  };
  
  const handleExportData = async () => {
    setIsExporting(true);
    try {
      const data = await exportAllData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `code-puppy-trainer-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      alert('Failed to export data. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };
  
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Privacy Dashboard</h1>
        <p className="mt-2 text-gray-600">Manage your data and privacy settings</p>
      </div>
      
      <div className="space-y-6">
        <div className="card">
          <h2 className="text-xl font-medium text-gray-900 mb-4">Data Storage</h2>
          <div className="space-y-3">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <div className="h-2 w-2 rounded-full bg-green-500 mt-2"></div>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-900">Offline-First Storage</p>
                <p className="text-sm text-gray-600">All data is stored locally on your device using IndexedDB</p>
              </div>
            </div>
            
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <div className="h-2 w-2 rounded-full bg-green-500 mt-2"></div>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-900">No Third-Party Tracking</p>
                <p className="text-sm text-gray-600">We do not use analytics, cookies, or tracking</p>
              </div>
            </div>
            
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <div className="h-2 w-2 rounded-full bg-green-500 mt-2"></div>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-900">Data Privacy</p>
                <p className="text-sm text-gray-600">Your data never leaves your device</p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="card">
          <h2 className="text-xl font-medium text-gray-900 mb-4">Data Management</h2>
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Export Your Data</h3>
              <p className="text-sm text-gray-600 mb-3">
                Download a complete backup of all your workout, nutrition, and progress data as a JSON file.
              </p>
              <button 
                onClick={handleExportData}
                disabled={isExporting}
                className="btn btn-secondary"
              >
                {isExporting ? 'Exporting...' : 'Export All Data'}
              </button>
            </div>
            
            <div className="border-t pt-4">
              <h3 className="text-lg font-medium text-red-900 mb-2">Delete All Data</h3>
              <p className="text-sm text-red-700 mb-3">
                Permanently delete all stored data including your profile, workouts, nutrition logs, and progress. 
                This action cannot be undone.
              </p>
              <button 
                onClick={handleClearAllData}
                disabled={isClearing}
                className="bg-red-600 text-white px-4 py-2 rounded-md font-medium hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isClearing ? 'Clearing...' : 'Delete All Data'}
              </button>
            </div>
          </div>
        </div>
        
        <div className="card">
          <h2 className="text-xl font-medium text-gray-900 mb-4">Legal Information</h2>
          <div className="space-y-3">
            <a href="#/legal/privacy" className="block text-primary-600 hover:text-primary-700">
              Privacy Policy →
            </a>
            <a href="#/legal/terms" className="block text-primary-600 hover:text-primary-700">
              Terms of Use →
            </a>
            <a href="#/legal/disclaimer" className="block text-primary-600 hover:text-primary-700">
              Medical Disclaimer →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}