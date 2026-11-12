import React from 'react';
import { soundFx } from '../utils/audio';
import { Incident } from '../types';

interface NotificationsDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  incidents?: Incident[];
  onSelectIncident?: (incident: Incident) => void;
}

export const NotificationsDropdown: React.FC<NotificationsDropdownProps> = ({
  isOpen,
  onClose,
  incidents = [],
  onSelectIncident,
}) => {
  if (!isOpen) return null;

  // Real notifications generated from active user incidents with status updates
  const notifications = incidents.flatMap((item) => {
    return item.statusHistory.map((hist, index) => ({
      id: `${item.id}-${index}`,
      incident: item,
      title: `${item.title} (#${item.protocol})`,
      message: hist.note,
      time: hist.date,
      author: hist.author,
      status: hist.status,
    }));
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex justify-center items-start pt-14 px-3 animate-in fade-in">
      <div className="bg-white rounded-3xl w-full max-w-[420px] shadow-2xl border border-[#171717]/10 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-4 py-3.5 bg-[#FFF9EB] border-b border-[#171717]/8 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#F47721] text-[20px]">
              notifications_active
            </span>
            <div className="flex flex-col">
              <h3 className="text-sm font-bold text-[#171717] leading-tight">
                Notificações de Agudos
              </h3>
              <span className="text-[10px] text-[#737373] leading-none">
                Zeladoria Municipal
              </span>
            </div>
          </div>
          <button
            onClick={() => {
              soundFx.playTap();
              onClose();
            }}
            className="w-7 h-7 rounded-full flex items-center justify-center text-[#737373] hover:bg-black/5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Notifications list or clean empty state */}
        <div className="max-h-[380px] overflow-y-auto divide-y divide-[#171717]/5 p-2">
          {notifications.length === 0 ? (
            <div className="py-8 px-4 flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-2xl bg-[#FFF9EB] border border-[#FFC928]/30 flex items-center justify-center text-[#737373] mb-2.5">
                <span className="material-symbols-outlined text-[24px]">notifications_none</span>
              </div>
              <p className="text-xs font-bold text-[#171717]">Nenhuma notificação no momento</p>
              <p className="text-[11px] text-[#737373] mt-1 max-w-[240px] leading-relaxed">
                Você receberá alertas aqui quando suas ocorrências em Agudos forem atualizadas pela prefeitura.
              </p>
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => {
                  soundFx.playTap();
                  if (onSelectIncident) {
                    onSelectIncident(n.incident);
                    onClose();
                  }
                }}
                className="p-3 rounded-2xl flex items-start gap-3 transition-colors hover:bg-amber-50/50 cursor-pointer"
              >
                <div className="w-8 h-8 rounded-full bg-[#FFF9EB] border border-[#FFC928]/40 flex items-center justify-center shrink-0 text-[#171717] mt-0.5">
                  <span className="material-symbols-outlined text-[17px] text-[#F47721]">
                    engineering
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-[#171717] truncate">{n.title}</h4>
                    <span className="text-[10px] text-[#8E8E93] shrink-0 ml-1">{n.time}</span>
                  </div>
                  <p className="text-[11.5px] text-[#525252] mt-0.5 leading-snug">{n.message}</p>
                  <span className="text-[10px] text-[#F47721] font-semibold mt-0.5 block">
                    Por {n.author}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-3 bg-[#FFF9EB]/60 border-t border-[#171717]/5 text-center">
          <span className="text-[11px] text-[#737373]">
            Sincronizado com a Prefeitura Municipal de Agudos
          </span>
        </div>
      </div>
    </div>
  );
};
