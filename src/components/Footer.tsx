import React from 'react';

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer role="contentinfo">
      <div className="container">
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
          gap: '2rem',
          marginBottom: '2rem'
        }}>
          
          {/* About section */}
          <section aria-labelledby="footer-about">
            <h2 id="footer-about" style={{ fontSize: '1.125rem', marginBottom: '1rem' }}>
              About Health App
            </h2>
            <p style={{ lineHeight: '1.6', marginBottom: '1rem' }}>
              An accessible healthcare management application committed to WCAG 2.2 AA 
              compliance, ensuring equal access to health information and services for all users.
            </p>
          </section>

          {/* Quick links */}
          <section aria-labelledby="footer-quick-links">
            <h2 id="footer-quick-links" style={{ fontSize: '1.125rem', marginBottom: '1rem' }}>
              Quick Links
            </h2>
            <ul style={{ listStyle: 'none', padding: 0 }}>
              <li style={{ marginBottom: '0.5rem' }}>
                <a href="#" style={{ color: '#0066cc', textDecoration: 'none' }}>
                  Privacy Policy
                </a>
              </li>
              <li style={{ marginBottom: '0.5rem' }}>
                <a href="#" style={{ color: '#0066cc', textDecoration: 'none' }}>
                  Terms of Service
                </a>
              </li>
              <li style={{ marginBottom: '0.5rem' }}>
                <a href="#" style={{ color: '#0066cc', textDecoration: 'none' }}>
                  Accessibility Statement
                </a>
              </li>
              <li style={{ marginBottom: '0.5rem' }}>
                <a href="#" style={{ color: '#0066cc', textDecoration: 'none' }}>
                  Contact Support
                </a>
              </li>
            </ul>
          </section>

          {/* Accessibility information */}
          <section aria-labelledby="footer-accessibility">
            <h2 id="footer-accessibility" style={{ fontSize: '1.125rem', marginBottom: '1rem' }}>
              Accessibility
            </h2>
            <p style={{ lineHeight: '1.6', marginBottom: '1rem' }}>
              This application conforms to WCAG 2.2 AA standards. If you encounter any 
              accessibility barriers, please contact us.
            </p>
            <button
              onClick={() => {
                // Accessibility help modal functionality
                alert('Accessibility help: Use Tab to navigate, Enter to activate, and screen readers will announce content properly.');
              }}
              style={{
                background: 'none',
                border: '1px solid #0066cc',
                color: '#0066cc',
                padding: '0.5rem 1rem',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Accessibility Help
            </button>
          </section>
        </div>

        {/* Copyright and legal information */}
        <div style={{ 
          borderTop: '1px solid #dee2e6', 
          paddingTop: '1rem', 
          textAlign: 'center'
        }}>
          <p style={{ margin: '0', color: '#666' }}>
            © {currentYear} Health App. All rights reserved.
          </p>
          <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.875rem', color: '#666' }}>
            Built with accessibility in mind. WCAG 2.2 AA Compliant.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
