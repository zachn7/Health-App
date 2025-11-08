import React, { useState } from 'react';

const Features: React.FC = () => {
  const [expandedFeatures, setExpandedFeatures] = useState<number[]>([]);

  const toggleFeature = (index: number) => {
    setExpandedFeatures(prev => 
      prev.includes(index) 
        ? prev.filter(i => i !== index)
        : [...prev, index]
    );
  };

  const features = [
    {
      title: "Semantic HTML Structure",
      icon: "🏗️",
      description: "Proper use of HTML5 semantic elements like header, nav, main, section, and footer for screen reader navigation.",
      wcagCriteria: ["1.3.1 - Info and Relationships", "2.4.1 - Bypass Blocks", "4.1.2 - Name, Role, Value"],
      implementation: "Using landmark elements, headings hierarchy, and proper document outline."
    },
    {
      title: "Keyboard Navigation",
      icon: "⌨️",
      description: "Complete keyboard accessibility with logical tab order, visible focus indicators, and no keyboard traps.",
      wcagCriteria: ["2.1.1 - Keyboard", "2.1.2 - No Keyboard Trap", "2.4.3 - Focus Order", "2.4.7 - Focus Visible"],
      implementation: "Custom focus styles, skip links, and proper tab indexing."
    },
    {
      title: "Screen Reader Support",
      icon: "🔊",
      description: "Comprehensive ARIA labels, descriptions, and announcements for screen reader users.",
      wcagCriteria: ["1.1.1 - Non-text Content", "2.5.1 - Pointer Gestures", "4.1.3 - Status Messages"],
      implementation: "ARIA labels, live regions, and alternative text."
    },
    {
      title: "Color & Contrast",
      icon: "🎨",
      description: "High color contrast ratios and avoidance of color-only information presentation.",
      wcagCriteria: ["1.4.3 - Contrast (Minimum)", "1.4.11 - Non-text Contrast", "1.4.1 - Use of Color"],
      implementation: "WCAG AA compliant contrast ratios with indicator alternatives."
    },
    {
      title: "Responsive Design",
      icon: "📱",
      description: "Zoom support up to 400% without loss of content or functionality.",
      wcagCriteria: ["1.4.4 - Resize text", "1.4.10 - Reflow", "1.3.4 - Orientation"],
      implementation: "Fluid layouts, relative units, and responsive breakpoints."
    },
    {
      title: "Form Accessibility",
      icon: "📝",
      description: "Properly labeled forms with error handling, validation, and clear instructions.",
      wcagCriteria: ["3.3.2 - Labels or Instructions", "3.3.1 - Error Identification", "3.3.3 - Error Suggestion"],
      implementation: "Form labels, validation, error messages, and help text."
    }
  ];

  return (
    <div className="features-page">
      <header>
        <h1>Accessibility Features</h1>
        <p style={{ fontSize: '1.125rem', lineHeight: '1.6', maxWidth: '800px', margin: '1rem 0' }}>
          This Health App demonstrates comprehensive WCAG 2.2 AA compliance through 
          thoughtful implementation of accessibility features and best practices.
        </p>
      </header>

      <section aria-labelledby="wcag-overview" style={{ marginBottom: '3rem' }}>
        <h2 id="wcag-overview">WCAG 2.2 AA Compliance Overview</h2>
        <div style={{ 
          backgroundColor: '#e8f4fd',
          border: '1px solid #bee5eb',
          borderRadius: '8px',
          padding: '1.5rem',
          marginTop: '1rem'
        }}>
          <p style={{ marginBottom: '1rem' }}>
            <strong>Web Content Accessibility Guidelines (WCAG) 2.2 AA</strong> provides 
            a single shared standard for web content accessibility that meets the needs of 
            individuals, organizations, and governments internationally.
          </p>
          <p style={{ margin: 0 }}>
            This application implements Level AA success criteria, ensuring full access 
            for users with diverse abilities while providing an enhanced user experience for everyone.
          </p>
        </div>
      </section>

      <section aria-labelledby="features-list">
        <h2 id="features-list">Implemented Features</h2>
        <div style={{ marginTop: '2rem' }}>
          {features.map((feature, index) => {
            const isExpanded = expandedFeatures.includes(index);
            
            return (
              <article 
                key={index} 
                style={{
                  border: '1px solid #dee2e6',
                  borderRadius: '8px',
                  marginBottom: '1rem',
                  overflow: 'hidden'
                }}
              >
                <button
                  onClick={() => toggleFeature(index)}
                  aria-expanded={isExpanded}
                  aria-controls={`feature-details-${index}`}
                  style={{
                    width: '100%',
                    padding: '1.5rem',
                    backgroundColor: '#fff',
                    border: 'none',
                    textAlign: 'left',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    fontSize: '1.125rem',
                    fontWeight: '600',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f8f9fa';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#fff';
                  }}
                >
                  <span style={{ fontSize: '1.5rem' }}>{feature.icon}</span>
                  <span style={{ flexGrow: 1 }}>{feature.title}</span>
                  <span 
                    aria-hidden="true"
                    style={{
                      transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s',
                      fontSize: '1.2rem'
                    }}
                  >
                    ▶
                  </span>
                  <span className="sr-only">
                    {isExpanded ? 'Collapse' : 'Expand'} {feature.title} details
                  </span>
                </button>
                
                <div 
                  id={`feature-details-${index}`}
                  hidden={!isExpanded}
                  style={{
                    padding: isExpanded ? '0 1.5rem 1.5rem 1.5rem' : '0',
                    backgroundColor: '#f8f9fa'
                  }}
                >
                  <div style={{ 
                    borderLeft: '4px solid #0066cc',
                    paddingLeft: '1rem',
                    marginLeft: '3.5rem'
                  }}>
                    <p style={{ marginBottom: '1rem', lineHeight: '1.6' }}>
                      {feature.description}
                    </p>
                    
                    <div style={{ marginBottom: '1rem' }}>
                      <h4 style={{ fontSize: '1rem', marginBottom: '0.5rem', color: '#0066cc' }}>
                        WCAG Success Criteria:
                      </h4>
                      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                        {feature.wcagCriteria.map((criteria, idx) => (
                          <li key={idx} style={{ marginBottom: '0.25rem', paddingLeft: '1rem' }}>
                            {criteria}
                          </li>
                        ))}
                      </ul>
                    </div>
                    
                    <div>
                      <h4 style={{ fontSize: '1rem', marginBottom: '0.5rem', color: '#0066cc' }}>
                        Implementation:
                      </h4>
                      <p style={{ margin: 0, fontStyle: 'italic' }}>
                        {feature.implementation}
                      </p>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="testing-info" style={{ marginTop: '3rem' }}>
        <h2 id="testing-info">Accessibility Testing</h2>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
          gap: '2rem',
          marginTop: '2rem'
        }}>
          <div style={{ 
            border: '1px solid #dee2e6', 
            borderRadius: '8px', 
            padding: '1.5rem'
          }}>
            <h3 style={{ color: '#0066cc', marginBottom: '1rem' }}>Automated Testing</h3>
            <ul>
              <li>axe-core for accessibility violations</li>
              <li>ESLint with jsx-a11y rules</li>
              <li>Pa11y CI for automated audits</li>
              <li>Lighthouse accessibility scoring</li>
            </ul>
          </div>
          
          <div style={{ 
            border: '1px solid #dee2e6', 
            borderRadius: '8px', 
            padding: '1.5rem'
          }}>
            <h3 style={{ color: '#0066cc', marginBottom: '1rem' }}>Manual Testing</h3>
            <ul>
              <li>Keyboard navigation testing</li>
              <li>Screen reader validation</li>
              <li>Color contrast verification</li>
              <li>Zoom and responsive testing</li>
            </ul>
          </div>
          
          <div style={{ 
            border: '1px solid #dee2e6', 
            borderRadius: '8px', 
            padding: '1.5rem'
          }}>
            <h3 style={{ color: '#0066cc', marginBottom: '1rem' }}>Continuous Integration</h3>
            <ul>
              <li>Automated testing in CI/CD</li>
              <li>Accessibility regression prevention</li>
              <li>Performance monitoring</li>
              <li>WCAG 2.2 AA compliance tracking</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Features;
