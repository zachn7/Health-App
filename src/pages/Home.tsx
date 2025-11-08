import React, { useState } from 'react';

const Home: React.FC = () => {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmail(value);
    
    // Clear error when user starts typing
    if (emailError) {
      setEmailError('');
    }
  };

  const handleEmailBlur = () => {
    if (email && !validateEmail(email)) {
      setEmailError('Please enter a valid email address');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      setEmailError('Email is required');
      return;
    }
    
    if (!validateEmail(email)) {
      setEmailError('Please enter a valid email address');
      return;
    }
    
    // Success message
    alert('Thank you for subscribing!');
    setEmail('');
  };

  return (
    <div className="home-page">
      <section aria-labelledby="hero-heading">
        <h1 id="hero-heading">
          Welcome to Your Accessible Health App
        </h1>
        <p className="hero-description">
          Empowering everyone to manage their health with confidence through 
          accessible, WCAG 2.2 AA compliant digital healthcare solutions.
        </p>
      </section>

      <section aria-labelledby="features-heading" style={{ marginTop: '3rem' }}>
        <h2 id="features-heading">Key Features</h2>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
          gap: '2rem',
          marginTop: '2rem'
        }}>
          
          {/* Feature 1 */}
          <article className="feature-card" style={{ 
            border: '1px solid #dee2e6', 
            borderRadius: '8px', 
            padding: '1.5rem'
          }}>
            <h3 style={{ color: '#0066cc', marginBottom: '1rem' }}>
              🔍 Screen Reader Optimized
            </h3>
            <p style={{ lineHeight: '1.6' }}>
              Fully compatible with all major screen readers using semantic HTML, 
              ARIA labels, and comprehensive text alternatives.
            </p>
          </article>

          {/* Feature 2 */}
          <article className="feature-card" style={{ 
            border: '1px solid #dee2e6', 
            borderRadius: '8px', 
            padding: '1.5rem'
          }}>
            <h3 style={{ color: '#0066cc', marginBottom: '1rem' }}>
              ⌨️ Keyboard Navigation
            </h3>
            <p style={{ lineHeight: '1.6' }}>
              Complete keyboard accessibility with logical tab order, visible focus 
              indicators, and intuitive shortcuts.
            </p>
          </article>

          {/* Feature 3 */}
          <article className="feature-card" style={{ 
            border: '1px solid #dee2e6', 
            borderRadius: '8px', 
            padding: '1.5rem'
          }}>
            <h3 style={{ color: '#0066cc', marginBottom: '1rem' }}>
              🌙 High Contrast Support
            </h3>
            <p style={{ lineHeight: '1.6' }}>
              Designed for users with low vision supporting high contrast modes and 
              custom color schemes.
            </p>
          </article>
        </div>
      </section>

      <section 
        aria-labelledby="newsletter-heading" 
        style={{ 
          backgroundColor: '#f8f9fa', 
          borderRadius: '8px', 
          padding: '2rem',
          marginTop: '3rem'
        }}
      >
        <h2 id="newsletter-heading">Stay Informed</h2>
        <p style={{ marginBottom: '2rem', lineHeight: '1.6' }}>
          Get updates about health accessibility features and digital inclusion initiatives.
        </p>
        
        <form onSubmit={handleSubmit} noValidate>
          <div style={{ maxWidth: '500px' }}>
            <label htmlFor="email-input" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
              Email Address
              <span className="required" style={{ color: '#dc3545' }} aria-label="required"> *</span>
            </label>
            
            <input
              id="email-input"
              type="email"
              value={email}
              onChange={handleEmailChange}
              onBlur={handleEmailBlur}
              aria-invalid={emailError ? 'true' : 'false'}
              aria-describedby={emailError ? 'email-error' : undefined}
              placeholder="Enter your email address"
              style={{
                width: '100%',
                padding: '0.75rem',
                fontSize: '1rem',
                border: emailError ? '2px solid #dc3545' : '2px solid #ced4da',
                borderRadius: '4px',
                marginBottom: '0.5rem'
              }}
            />
            
            {emailError && (
              <div 
                id="email-error" 
                className="error" 
                role="alert"
                style={{ color: '#dc3545', fontSize: '0.875rem', marginTop: '0.25rem' }}
              >
                {emailError}
              </div>
            )}
            
            <button
              type="submit"
              style={{
                marginTop: '1rem',
                padding: '0.75rem 2rem',
                fontSize: '1rem',
                backgroundColor: '#0066cc',
                color: 'white',
                border: '2px solid #0066cc',
                borderRadius: '4px',
                cursor: 'pointer',
                minWidth: '44px',
                minHeight: '44px'
              }}
            >
              Subscribe
            </button>
          </div>
        </form>
      </section>

      <section aria-labelledby="stats-heading" style={{ marginTop: '3rem' }}>
        <h2 id="stats-heading">Accessibility Impact</h2>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
          gap: '2rem',
          marginTop: '2rem',
          textAlign: 'center'
        }}>
          <div>
            <h3 style={{ fontSize: '2rem', color: '#0066cc', margin: '0 0 0.5rem 0' }}>
              15%
            </h3>
            <p>of world population lives with disabilities</p>
          </div>
          <div>
            <h3 style={{ fontSize: '2rem', color: '#0066cc', margin: '0 0 0.5rem 0' }}>
              2.2 AA
            </h3>
            <p>WCAG compliance level achieved</p>
          </div>
          <div>
            <h3 style={{ fontSize: '2rem', color: '#0066cc', margin: '0 0 0.5rem 0' }}>
              100%
            </h3>
            <p>keyboard accessible interface</p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
