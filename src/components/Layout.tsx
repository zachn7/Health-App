import React from 'react';
import { Outlet } from 'react-router-dom';
import Navigation from './Navigation';
import BuildInfoFooter from './BuildInfoFooter';
import { testIds } from '../testIds';

interface LayoutProps {
  children?: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main
        className="lg:pl-64 min-w-0 w-full pb-20"
        data-testid={testIds.layout.mainContent}
      >
        {children || <Outlet />}
      </main>
      <BuildInfoFooter />
    </div>
  );
}