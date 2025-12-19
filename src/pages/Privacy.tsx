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
      console.log('Data cleared successfully, navigating to age gate...');
      
      // Force reload to age gate using hash router
      window.location.hash = '#/';
      
      // Small delay to ensure the hash change propagates
      setTimeout(() => {
        window.location.reload();
      }, 100);
      
    } catch (error) {
      console.error('Failed to clear data:', error);
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
          <h2 className="text-xl font-medium text-gray-900 mb-4">Troubleshooting & Reset</h2>
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Reset Local App Data</h3>
              <p className="text-sm text-gray-600 mb-3">
                If you're experiencing issues like blank screens, errors, or corrupted data, 
                try resetting all local data. This will clear: localStorage, sessionStorage, IndexedDB, and Service Worker caches.
              </p>
              <button 
                onClick={async () => {
                  if (confirm('This will clear ALL app data and caches. Are you sure? This fixes most startup issues.')) {
                    try {
                      // Clear localStorage
                      localStorage.clear();
                      sessionStorage.clear();
                      
                      // Clear IndexedDB databases
                      if ('indexedDB' in window) {
                        const dbs = await indexedDB.databases();
                        await Promise.all(
                          dbs.map(db => indexedDB.deleteDatabase(db.name!))
                        );
                      }
                      
                      // Clear Service Worker caches
                      if ('caches' in window) {
                        const cacheNames = await caches.keys();
                        await Promise.all(
                          cacheNames.map(cacheName => caches.delete(cacheName))
                        );
                      }
                      
                      // Unregister service workers
                      if ('serviceWorker' in navigator) {
                        const registrations = await navigator.serviceWorker.getRegistrations();
                        await Promise.all(
                          registrations.map(registration => registration.unregister())
                        );
                      }
                      
                      alert('All app data and caches cleared successfully! The page will now reload.');
                      window.location.reload();
                    } catch (error) {
                      console.error('Reset failed:', error);
                      alert('Reset failed. Please try clearing your browser cache manually.');
                    }
                  }
                }}
                className="bg-orange-600 text-white px-4 py-2 rounded-md font-medium hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
              >
                Reset All Local Data & Caches
              </button>
              <p className="text-xs text-gray-500 mt-2">
                This is the most thorough reset and should fix blank screen issues.
              </p>
            </div>
            
            <div className="border-t pt-4">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Diagnose Issues</h3>
              <div className="space-y-3">
                <div className="bg-gray-50 p-3 rounded text-sm">
                  <strong>Current Status:</strong>
                  <ul className="mt-2 space-y-1">
                    <li>• localStorage: {typeof localStorage !== 'undefined' ? 'Available' : 'Not Available'}</li>
                    <li>• indexedDB: {typeof indexedDB !== 'undefined' ? 'Available' : 'Not Available'}</li>
                    <li>• serviceWorker: {typeof navigator !== 'undefined' && 'serviceWorker' in navigator ? 'Available' : 'Not Available'}</li>
                    <li>• caches: {typeof caches !== 'undefined' ? 'Available' : 'Not Available'}</li>
                    <li>• Base URL: {window.location.origin + window.location.pathname}</li>
                  </ul>
                </div>
              </div>
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