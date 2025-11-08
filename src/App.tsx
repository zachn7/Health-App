import React, { useState } from 'react';
import Header from './components/Header';
import Navigation from './components/Navigation';
import Home from './pages/Home';
import Features from './pages/Features';
import Contact from './pages/Contact';
import Footer from './components/Footer';

export type Page = 'home' | 'features' | 'contact';

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>('home');

  const renderPage = () => {
    switch (currentPage) {
      case 'home':
        return <Home />;
      case 'features':
        return <Features />;
      case 'contact':
        return <Contact />;
      default:
        return <Home />;
    }
  };

  return (
    <div className="app">
      {/* Skip links for keyboard navigation - WCAG 2.4.1 */}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <a href="#navigation" className="skip-link">
        Skip to navigation
      </a>

      {/* Header with site information */}
      <Header />

      {/* Main navigation */}
      <Navigation 
        currentPage={currentPage} 
        onNavigate={setCurrentPage}
      />

      {/* Main content area */}
      <main id="main-content" role="main">
        <div className="container">
          <section aria-label="Main Content">
            {renderPage()}
          </section>
        </div>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
};

export default App;
