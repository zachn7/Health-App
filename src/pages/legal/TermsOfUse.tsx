import React from 'react';

export default function TermsOfUse() {
  const lastUpdated = 'December 2024';

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Terms of Use</h1>
        <p className="mt-2 text-gray-600">Last updated: {lastUpdated}</p>
      </div>
      
      <div className="prose prose-gray max-w-none">
        <div className="card">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Agreement to Terms</h2>
          <p className="text-gray-600">
            By accessing and using CodePuppy Trainer, you accept and agree to be bound by the terms 
            and provision of this agreement.
          </p>
        </div>
        
        <div className="card mt-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Use License</h2>
          <p className="text-gray-600">
            Permission is granted to temporarily download one copy of CodePuppy Trainer for personal, 
            non-commercial transitory viewing only. This is the grant of a license, not a transfer of title, 
            and under this license you may not:
          </p>
          <ul className="list-disc pl-6 mt-3 space-y-2 text-gray-600">
            <li>modify or copy the materials</li>
            <li>use the materials for any commercial purpose or for any public display</li>
            <li>attempt to reverse engineer any software contained in the app</li>
            <li>remove any copyright or other proprietary notations from the materials</li>
          </ul>
        </div>
        
        <div className="card mt-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Disclaimer</h2>
          <div className="space-y-4 text-gray-600">
            <p>
              The materials on CodePuppy Trainer are provided on an 'as is' basis. 
              CodePuppy Trainer makes no warranties, expressed or implied, and hereby disclaims and negates 
              all other warranties including without limitation, implied warranties or conditions of merchantability, 
              fitness for a particular purpose, or non-infringement of intellectual property or other violation of rights.
            </p>
            
            <p>
              Further, CodePuppy Trainer does not warrant or make any representations concerning the accuracy, 
              likely results, or reliability of the use of the materials on its website or otherwise relating to 
              such materials or on any sites linked to this site.
            </p>
          </div>
        </div>
        
        <div className="card mt-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Limitations</h2>
          <p className="text-gray-600">
            In no event shall CodePuppy Trainer or its suppliers be liable for any damages (including, without limitation, 
            damages for loss of data or profit, or due to business interruption) arising out of the use or inability 
            to use the materials on CodePuppy Trainer, even if CodePuppy Trainer or an authorized representative has 
            been notified orally or in writing of the possibility of such damage.
          </p>
        </div>
        
        <div className="card mt-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Privacy Policy</h2>
          <p className="text-gray-600">
            Your privacy is important to us. Our Privacy Policy explains how we collect, use, and protect your information.
          </p>
        </div>
        
        <div className="card mt-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Revisions and Errata</h2>
          <p className="text-gray-600">
            The materials appearing on CodePuppy Trainer could include technical, typographical, or photographic errors. 
            CodePuppy Trainer does not warrant that any of the materials on its website are accurate, complete, or current.
          </p>
        </div>
      </div>
    </div>
  );
}