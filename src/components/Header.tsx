import React, { useState, useEffect } from 'react';
import { FileText, History, Settings, Maximize2, Minimize2, Sparkles, ExternalLink } from 'lucide-react';
import { getTheme } from '../services/themeService';

interface HeaderProps {
  activeTab: 'new-bill' | 'history' | 'settings';
  setActiveTab: (tab: 'new-bill' | 'history' | 'settings') => void;
  theme?: string;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab, theme }) => {
  const currentTheme = getTheme(theme);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.warn('Could not enter fullscreen:', err);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch((err) => {
          console.warn('Could not exit fullscreen:', err);
        });
      }
    }
  };

  return (
    <header className="w-full flex flex-col shrink-0 select-none shadow-sm z-10">
      {/* Dynamic Themed Header Bar */}
      <div
        className="px-4 py-2.5 flex items-center justify-between shadow-md transition-colors duration-300"
        style={{
          backgroundColor: currentTheme.headerBg,
          color: currentTheme.headerText
        }}
      >
        <div className="flex items-center space-x-3">
          {/* App Icon */}
          <div
            className="w-6 h-6 rounded flex items-center justify-center font-bold text-xs shadow-xs"
            style={{
              backgroundColor: currentTheme.isDark ? '#374151' : 'rgba(255,255,255,0.25)',
              color: '#FFFFFF'
            }}
          >
            SB
          </div>
          <div className="flex flex-col">
            <h1 className="text-lg font-bold tracking-tight leading-tight">Smart Bill - Billing Software</h1>
            <span className="text-[10px] uppercase tracking-widest opacity-80 hidden sm:inline">Fast, Offline &amp; Professional</span>
          </div>
        </div>

        {/* Navigation Tabs in Header */}
        <nav className="flex items-center gap-1.5" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('new-bill')}
            style={
              activeTab === 'new-bill'
                ? {
                    backgroundColor: currentTheme.isDark ? '#1F2937' : '#FFFFFF',
                    color: currentTheme.isDark ? currentTheme.accent : currentTheme.primary
                  }
                : undefined
            }
            className={`px-4 py-1.5 text-xs font-semibold rounded transition-all cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'new-bill'
                ? 'shadow-xs'
                : 'text-white hover:bg-white/10'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>New Bill</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            style={
              activeTab === 'history'
                ? {
                    backgroundColor: currentTheme.isDark ? '#1F2937' : '#FFFFFF',
                    color: currentTheme.isDark ? currentTheme.accent : currentTheme.primary
                  }
                : undefined
            }
            className={`px-4 py-1.5 text-xs font-semibold rounded transition-all cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'history'
                ? 'shadow-xs'
                : 'text-white hover:bg-white/10'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>History</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            style={
              activeTab === 'settings'
                ? {
                    backgroundColor: currentTheme.isDark ? '#1F2937' : '#FFFFFF',
                    color: currentTheme.isDark ? currentTheme.accent : currentTheme.primary
                  }
                : undefined
            }
            className={`px-4 py-1.5 text-xs font-semibold rounded transition-all cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'settings'
                ? 'shadow-xs'
                : 'text-white hover:bg-white/10'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Settings</span>
          </button>
        </nav>

        {/* Right Section: Developer Link & Full Screen Mode */}
        <div className="flex items-center space-x-2.5">
          <a
            href="https://codenpixels.in"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden lg:flex items-center space-x-1.5 px-2.5 py-1 text-xs text-white/90 hover:text-white hover:bg-white/15 rounded-md transition-all border border-white/20 shadow-xs cursor-pointer"
            title="Crafted by Code N Pixels"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
            <span className="text-[11px] font-medium">Crafted by <strong className="font-bold underline decoration-white/50 underline-offset-2">Code N Pixels</strong></span>
            <ExternalLink className="w-3 h-3 opacity-80" />
          </a>

          <button
            type="button"
            onClick={toggleFullscreen}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer bg-white/10 hover:bg-white/20 text-white border border-white/20 shadow-xs"
            title={isFullscreen ? 'Exit Full Screen Mode (F11)' : 'Enter Full Screen Mode (F11)'}
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Exit Full Screen</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Full Screen</span>
              </>
            )}
            <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded font-mono font-normal">F11</span>
          </button>
        </div>
      </div>
    </header>
  );
};

