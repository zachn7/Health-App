

export default function PrivacyPolicy() {
  const lastUpdated = 'December 2024';

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Privacy Policy</h1>
        <p className="mt-2 text-gray-600">Last updated: {lastUpdated}</p>
      </div>
      
      <div className="prose prose-gray max-w-none">
        <div className="card">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Our Privacy Promise</h2>
          <p className="text-gray-600 mb-4">
            CodePuppy Trainer is an offline-first fitness application designed with your privacy as our top priority. 
            We believe your health data should remain private and under your control.
          </p>
        </div>
        
        <div className="card mt-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Data Collection</h2>
          <div className="space-y-4 text-gray-600">
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">What We Collect</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li>Profile information (age, height, weight, fitness goals)</li>
                <li>Workout logs and training plans</li>
                <li>Nutrition tracking and food preferences</li>
                <li>Progress metrics and measurements</li>
                <li>Personal notes and comments</li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">What We Dont Collect</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li>Personal identifiers (name, email, phone)</li>
                <li>Location data</li>
                <li>Third-party account information</li>
                <li>Analytics or usage tracking</li>
                <li>Advertising data</li>
              </ul>
            </div>
          </div>
        </div>
        
        <div className="card mt-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Data Storage</h2>
          <div className="space-y-4 text-gray-600">
            <p>
              <strong className="text-gray-900">Local Storage Only:</strong> All data is stored using IndexedDB on your device. 
              No data is transmitted to external servers during normal operation.
            </p>
            
            <p>
              <strong className="text-gray-900">No Cloud Sync:</strong> There is no automatic cloud backup or synchronization. 
              Your data remains on your device unless you manually export it.
            </p>
            
            <p>
              <strong className="text-gray-900">Data Encryption:</strong> Data is stored according to browser security standards. 
              Additional encryption can be implemented in future versions.
            </p>
          </div>
        </div>
        
        <div className="card mt-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Data Sharing</h2>
          <div className="space-y-4 text-gray-600">
            <p>
              <strong className="text-gray-900">We Never Share:</strong>
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>We do not sell your personal data to third parties</li>
              <li>We do not share data with advertisers</li>
              <li>We do not provide data to data brokers</li>
              <li>We do not use data for marketing purposes</li>
            </ul>
            
            <p>
              <strong className="text-gray-900">Your Control:</strong> You maintain complete control over your data 
              and can export or delete it at any time through the Privacy Dashboard.
            </p>
          </div>
        </div>
        
        <div className="card mt-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Data Security</h2>
          <div className="space-y-4 text-gray-600">
            <p>
              <strong className="text-gray-900">Browser Security:</strong> Your data is protected by your browsers 
              built-in security features including same-origin policy and content security policies.
            </p>
            
            <p>
              <strong className="text-gray-900">No Vulnerable Third-Party Scripts:</strong> We minimize third-party dependencies 
              and manually audit all external libraries for security issues.
            </p>
            
            <p>
              <strong className="text-gray-900">Regular Updates:</strong> Security updates are regularly applied to protect 
              against known vulnerabilities.
            </p>
          </div>
        </div>
        
        <div className="card mt-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Your Rights</h2>
          <div className="space-y-4 text-gray-600">
            <p>
              <strong className="text-gray-900">Data Export:</strong> You can export all your data in JSON format at any time 
              for backup or migration purposes.
            </p>
            
            <p>
              <strong className="text-gray-900">Data Deletion:</strong> You can permanently delete all stored data with a single click 
              from the Privacy Dashboard.
            </p>
            
            <p>
              <strong className="text-gray-900">Data Portability:</strong> Exported data is in a standard format that can be imported 
              into other compatible applications.
            </p>
          </div>
        </div>
        
        <div className="card mt-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Childrens Privacy</h2>
          <div className="space-y-4 text-gray-600">
            <p>
              CodePuppy Trainer requires users to be at least 13 years old. We do not knowingly collect 
              personal information from children under 13. If you believe we have collected information 
              from a child under 13, please contact us immediately.
            </p>
          </div>
        </div>
        
        <div className="card mt-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Contact Us</h2>
          <div className="space-y-2 text-gray-600">
            <p>
              If you have questions about this Privacy Policy or how we handle your data, 
              please review the source code in our public repository or contact the development team.
            </p>
          </div>
        </div>
        
        <div className="card mt-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Policy Changes</h2>
          <div className="space-y-4 text-gray-600">
            <p>
              We may update this Privacy Policy from time to time. Any changes will be posted 
              here with a new last updated date. Continued use of the application indicates 
              acceptance of any updated policies.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}