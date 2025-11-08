import React from 'react';

const Header: React.FC = () => {
  return (
    <header role="banner">
      <div className="container">
        <div className="header-content">
          {/* Logo and site title - accessible heading */}
          <div className="logo-section">
            <h1 className="site-title">
              <a href="/" 
                 aria-label="Health App - Home"
                 style={{ textDecoration: 'none', color: 'inherit' }}
              >
                Health App
              </a>
            </h1>
            <p className="site-description">
              Accessible Healthcare Management - WCAG 2.2 AA Compliant
            </p>
          </div>

          {/* User actions - accessible controls */}
          <nav aria-label="User actions" className="user-nav">
            <ul style={{ listStyle: 'none', display: 'flex', gap: '1rem', margin: 0, padding: 0 }}>
              <li>
                <button 
                  aria-label="Toggle dark mode"
                  onClick={() => {
                    // Dark mode functionality would go here
                    console.log('Dark mode toggle');
                  }}
                >
                  <span aria-hidden="true">🌓</span>
                  <span className="sr-only">Toggle dark mode</span>
                </button>
              </li>
              <li>
                <button 
                  aria-label="Increase text size"
                  onClick={() => {
                    // Text size functionality would go here
                    console.log('Increase text size');
                  }}
                >
                  <span aria-hidden="true">A+</span>
                  <span className="sr-only">Increase text size</span>
                </button>
              </li>
            </ul>
          </nav>
        </div>
      </div>
    </header>
  );
};

export default Header;
