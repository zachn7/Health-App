import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
  Home, 
  User, 
  Brain, 
  Dumbbell, 
  BookOpen, 
  Apple, 
  TrendingUp, 
  Heart, 
  Shield,
  Menu
} from 'lucide-react';

interface NavItem {
  name: string;
  path: string;
  icon: React.ElementType;
  description: string;
}

const navItems: NavItem[] = [
  {
    name: 'Dashboard',
    path: '/',
    icon: Home,
    description: 'Today\'s overview'
  },
  {
    name: 'Profile',
    path: '/profile',
    icon: User,
    description: 'Your stats & goals'
  },
  {
    name: 'Coach',
    path: '/coach',
    icon: Brain,
    description: 'AI training plan'
  },
  {
    name: 'Workouts',
    path: '/workouts',
    icon: Dumbbell,
    description: 'Training plans'
  },
  {
    name: 'Logger',
    path: '/log/workout',
    icon: BookOpen,
    description: 'Log workouts'
  },
  {
    name: 'Nutrition',
    path: '/nutrition',
    icon: Apple,
    description: 'Track meals'
  },
  {
    name: 'Progress',
    path: '/progress',
    icon: TrendingUp,
    description: 'Analytics'
  },
  {
    name: 'Discomfort',
    path: '/injury',
    icon: Heart,
    description: 'Injury guidance'
  },
  {
    name: 'Privacy',
    path: '/privacy',
    icon: Shield,
    description: 'Data settings'
  }
];

export default function Navigation() {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  const isCurrentPath = (path: string) => {
    if (path === '/') {
      return location.pathname === '/' || location.pathname === '/onboarding';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <>
      {/* Mobile menu button */}
      <div className="lg:hidden bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="px-4 py-3">
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="flex items-center justify-between w-full text-gray-700 hover:text-primary-600"
          >
            <div className="flex items-center space-x-2">
              <span className="text-xl">🐕</span>
              <span className="font-semibold">CodePuppy Trainer</span>
            </div>
            <Menu className="h-5 w-5" />
          </button>
        </div>
        
        {/* Mobile navigation drawer */}
        {isMobileMenuOpen && (
          <div className="border-t border-gray-200">
            <nav className="px-2 py-2 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = isCurrentPath(item.path);
                
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-primary-100 text-primary-700'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <div>
                      <div className="font-medium">{item.name}</div>
                      <div className="text-xs opacity-75">{item.description}</div>
                    </div>
                  </NavLink>
                );
              })}
            </nav>
          </div>
        )}
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-50 lg:block lg:w-64 lg:overflow-y-auto lg:bg-white lg:border-r lg:border-gray-200">
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center px-6 border-b border-gray-200">
            <span className="text-2xl">🐕</span>
            <span className="ml-2 text-xl font-bold text-gray-900">
              CodePuppy Trainer
            </span>
          </div>
          
          {/* Navigation */}
          <nav className="flex-1 space-y-1 px-3 py-6">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = isCurrentPath(item.path);
              
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={`group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    isActive
                      ? 'bg-primary-100 text-primary-700'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <Icon className="mr-3 h-5 w-5" />
                  <div className="flex-1">
                    <div>{item.name}</div>
                    <div className="text-xs opacity-75">{item.description}</div>
                  </div>
                </NavLink>
              );
            })}
          </nav>
          
          {/* Footer */}
          <div className="border-t border-gray-200 p-4">
            <div className="text-xs text-gray-500 space-y-1">
              <p>🔒 Offline-first • Private</p>
              <p>Version 0.1.0</p>
              <div className="pt-2 space-x-2">
                <a 
                  href="#/legal/privacy" 
                  className="text-primary-600 hover:text-primary-700"
                >
                  Privacy
                </a>
                <a 
                  href="#/legal/terms" 
                  className="text-primary-600 hover:text-primary-700"
                >
                  Terms
                </a>
                <a 
                  href="#/legal/disclaimer" 
                  className="text-primary-600 hover:text-primary-700"
                >
                  Disclaimer
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop content padding */}
      <div className="hidden lg:block lg:pl-64">
        {/* Spacer for desktop layout */}
      </div>
    </>
  );
}