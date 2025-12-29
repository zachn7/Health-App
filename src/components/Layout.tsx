import React from 'react';
import { Outlet } from 'react-router-dom';
import Navigation from './Navigation';
import BuildInfoFooter from './BuildInfoFooter';

interface LayoutProps {
  children?: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  
  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <Navigation />
      <main className="pb-20">
        {children || <Outlet />}
      </main>
      <BuildInfoFooter />
    </div>
  );
}