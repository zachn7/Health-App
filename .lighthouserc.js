module.exports = {
  ci: {
    collect: {
      url: ['http://localhost:4173/'],
      numberOfRuns: 3,
    },
    assert: {
      assertions: {
        'categories:accessibility': ['warn', { minScore: 0.9 }],
        'categories:performance': ['warn', { minScore: 0.8 }],
        'categories:best-practices': ['warn', { minScore: 0.9 }],
        'categories:seo': ['warn', { minScore: 0.8 }],
        'categories:pwa': 'off', // PWA not required for this app
        
        // Specific WCAG compliance checks
        'accessibility:aria-valid-attr-value': 'error',
        'accessibility:aria-valid-attr': 'error',
        'accessibility:button-name': 'error',
        'accessibility:bypass': 'warn',
        'accessibility:color-contrast': 'error',
        'accessibility:definition-list': 'warn',
        'accessibility:dlitem': 'warn',
        'accessibility:document-title': 'error',
        'accessibility:form-field-multiple-labels': 'error',
        'accessibility:frame-title': 'warn',
        'accessibility:heading-order': 'warn',
        'accessibility:html-has-lang': 'error',
        'accessibility:image-alt': 'error',
        'accessibility:input-button-name': 'error',
        'accessibility:label-title-only': 'error',
        'accessibility:link-name': 'error',
        'accessibility:list': 'warn',
        'accessibility:listitem': 'warn',
        'accessibility:meta-refresh': 'error',
        'accessibility:meta-viewport-large': 'warn',
        'accessibility:object-alt': 'error',
        'accessibility:tabindex': 'warn',
        'accessibility:td-headers-attr': 'warn',
        'accessibility:th-has-data-cells': 'warn',
        'accessibility:valid-lang': 'warn',
        'accessibility:video-caption': 'warn',
        
        // Performance checks important for accessibility
        'performance:speed-index': ['warn', { maxNumericValue: 4000 }],
        'performance:interactive': ['warn', { maxNumericValue: 5000 }],
        'performance:first-contentful-paint': ['warn', { maxNumericValue: 2000 }],
        'performance:largest-contentful-paint': ['warn', { maxNumericValue: 2500 }],
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};