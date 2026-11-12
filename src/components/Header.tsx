import React from 'react';
import { User } from '../types';
import { soundFx } from '../utils/audio';

interface HeaderProps {
  user: User | null;
  onOpenNotifications: () => void;
  unreadCount?: number;
  subtitle?: string;
  onProfileClick: () => void;
  onOpenOwnerPanel?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  onOpenNotifications,
  unreadCount = 0,
  subtitle = 'Agudos, SP',
  onProfileClick,
  onOpenOwnerPanel,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-[#FFF9EB]/95 backdrop-blur-md pt-safe border-b border-[#171717]/5 transition-all w-full">
      <div className="max-w-[480px] mx-auto h-14 px-4 flex items-center justify-between">
        {/* Logo and Subtitle */}
        <div className="flex items-center gap-2.5">
          <img
            alt="Reportaê Agudos"
            className="h-8 max-w-[140px] w-auto object-contain cursor-pointer active:scale-95 transition-transform"
            src="/assets/aistudio/Logo_minimalista_Reporta__em_amarelo_e_carv_o_268a0ba2.png"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = '/logo.png';
            }}
          />
          {subtitle && (
            <>
              <div className="h-4 w-px bg-[#171717]/15" />
              <div className="flex flex-col">
                <span className="text-[11px] font-bold text-[#171717] leading-tight">
                  {subtitle}
                </span>
                <span className="text-[9px] text-[#737373] leading-none">
                  Zeladoria Urbana
                </span>
              </div>
            </>
          )}
        </div>

        {/* Action icons: Notifications & User Avatar */}
        <div className="flex items-center gap-2.5">
          <button
            aria-label="Notificações"
            onClick={() => {
              soundFx.playTap();
              onOpenNotifications();
            }}
            className="relative w-9 h-9 rounded-full bg-white shadow-xs border border-[#171717]/8 flex items-center justify-center text-[#171717] active:scale-95 transition-transform hover:bg-[#FFF9EB]"
          >
            <span className="material-symbols-outlined text-[20px]">notifications</span>
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#F47721] ring-2 ring-white animate-pulse" />
            )}
          </button>

          {user?.role === 'proprietario' && onOpenOwnerPanel && (
            <button
              onClick={() => {
                soundFx.playTap();
                onOpenOwnerPanel();
              }}
              className="h-8 px-2.5 rounded-xl bg-[#171717] text-[#FFC928] text-[11px] font-bold flex items-center gap-1 shadow-xs hover:bg-black active:scale-95 transition-all cursor-pointer"
              title="Painel do Proprietário"
            >
              <span className="material-symbols-outlined text-[15px]">shield_person</span>
              <span>Painel</span>
            </button>
          )}

          <button
            aria-label={user ? `Perfil de ${user.name}` : 'Entrar na conta'}
            onClick={() => {
              soundFx.playTap();
              onProfileClick();
            }}
            className="relative flex items-center active:scale-95 transition-transform"
            title={user ? `${user.name} (${user.role})` : 'Entrar no Reportaê'}
          >
            {user && user.avatarUrl ? (
              <img
                alt={user.name}
                className="w-8 h-8 rounded-full object-cover ring-2 ring-[#FFC928] shadow-xs"
                src={user.avatarUrl}
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-white border border-[#171717]/15 shadow-xs flex items-center justify-center text-[#171717]">
                <span className="material-symbols-outlined text-[20px]">
                  {user ? 'person' : 'account_circle'}
                </span>
              </div>
            )}

            {(user?.role === 'moderador' || user?.role === 'proprietario') && (
              <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-[#171717] text-[#FFC928] rounded-full flex items-center justify-center text-[8px] font-bold">
                ★
              </span>
            )}
            {user?.role === 'agente' && (
              <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-[#F47721] text-white rounded-full flex items-center justify-center text-[8px] font-bold">
                ✓
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
