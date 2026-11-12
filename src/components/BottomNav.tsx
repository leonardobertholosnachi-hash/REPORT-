import React from 'react';
import { soundFx } from '../utils/audio';

export type NavTab = 'inicio' | 'mapa' | 'solicitacoes' | 'perfil';

interface BottomNavProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  pendingCount?: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentTab,
  onSelectTab,
  pendingCount
}) => {
  const tabs: { id: NavTab; label: string; icon: string }[] = [
    { id: 'inicio', label: 'Início', icon: 'home' },
    { id: 'mapa', label: 'Mapa', icon: 'map' },
    { id: 'solicitacoes', label: 'Solicitações', icon: 'assignment' },
    { id: 'perfil', label: 'Perfil', icon: 'person' },
  ];

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 bg-[#FFF9EB]/95 backdrop-blur-xl border-t border-[#171717]/10 shadow-[0_-4px_20px_rgba(0,0,0,0.04)] pb-[max(env(safe-area-inset-bottom,0px),8px)]">
      <div className="max-w-[480px] mx-auto flex justify-around items-center h-16 px-2">
        {tabs.map((tab) => {
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                if (!isActive) {
                  soundFx.playTap();
                  onSelectTab(tab.id);
                }
              }}
              className={`flex flex-col items-center justify-center w-16 h-full relative transition-colors ${
                isActive ? 'text-[#171717] font-bold' : 'text-[#8E8E93] hover:text-[#171717]'
              }`}
            >
              <div className="relative">
                <span className={`material-symbols-outlined text-[23px] ${isActive ? 'font-bold' : ''}`}>
                  {tab.icon}
                </span>
                {tab.id === 'solicitacoes' && pendingCount && pendingCount > 0 ? (
                  <span className="absolute -top-1 -right-2 px-1 min-w-[14px] h-3.5 rounded-full bg-[#F47721] text-white text-[9px] font-bold flex items-center justify-center leading-none">
                    {pendingCount}
                  </span>
                ) : null}
              </div>
              <span className="text-[10px] tracking-tight mt-0.5">
                {tab.label}
              </span>
              {isActive && (
                <span className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-[#FFC928]" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
