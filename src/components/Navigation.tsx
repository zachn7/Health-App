import React from 'react';
import { Page } from '../App';

interface NavigationProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

const Navigation: React.FC<NavigationProps> = ({ currentPage, onNavigate }) => {
  const navigationItems = [
    { page: 'home' as Page, label: 'Home', path: '/' },
    { page: 'features' as Page, label: 'Features', path: '/features' },
    { page: 'contact' as Page, label: 'Contact', path: '/contact' },
  ];

  return (
    <nav id="navigation" role="navigation" aria-label="Main navigation">
      <div className="container">
        {/* Using semantic nav element with proper ARIA */}
        <ul 
          style={{ 
            listStyle: 'none', 
            display: 'flex', 
            gap: '2rem', 
            margin: '1rem 0', 
            padding: '0',
            justifyContent: 'center'
          }}
        >
          {navigationItems.map((item) => {
            const isActive = currentPage === item.page;
            return (
              <li key={item.page}>
                <button
                  onClick={() => onNavigate(item.page)}
                  aria-current={isActive ? 'page' : undefined}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '1.1rem',
                    fontWeight: isActive ? '600' : 'normal',
                    color: isActive ? '#0066cc' : '#333',
                    cursor: 'pointer',
                    padding: '0.5rem 1rem',
                    borderRadius: '4px',
                    textDecoration: isActive ? 'underline' : 'none'
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.color = '#0066cc';
                      e.currentTarget.style.textDecoration = 'underline';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.color = '#333';
                      e.currentTarget.style.textDecoration = 'none';
                    }
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.outline = '2px solid #0066cc';
                    e.currentTarget.style.outlineOffset = '2px';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.outline = 'none';
                  }}
                >
                  {item.label}
                  {isActive && (
                    <span className="sr-only"> (current page)</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
};

export default Navigation;
