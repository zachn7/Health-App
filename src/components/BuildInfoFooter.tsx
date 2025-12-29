import { GitBranch } from 'lucide-react';

interface BuildInfoFooterProps {
  className?: string;
}

export default function BuildInfoFooter({ className = '' }: BuildInfoFooterProps) {
  const buildInfo = typeof __BUILD_INFO__ !== 'undefined' ? __BUILD_INFO__ : null;

  if (!buildInfo) {
    return null;
  }

  // Extract values with fallbacks for development
  const { commitSha = 'dev', buildRun = 'dev', appVersion = '0.1.0', buildTimestamp } = buildInfo;

  return (
    <footer className={`fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 py-2 px-4 text-xs ${className}`}>
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-4 text-gray-600">
          <span className="font-medium">v{appVersion}</span>
          <span className="text-gray-400">|</span>
          <a
            href={`https://github.com/znget/Health-App/commit/${buildInfo.commitSha}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 hover:text-blue-600 transition-colors font-mono"
          >
            <GitBranch className="h-3 w-3" />
            {commitSha}
          </a>
          <span className="text-gray-400">|</span>
          <span className="font-mono">#{buildRun}</span>
        </div>
        {buildTimestamp && (
          <div className="text-gray-500">
            {new Date(buildTimestamp).toLocaleString()}
          </div>
        )}
      </div>
    </footer>
  );
}
