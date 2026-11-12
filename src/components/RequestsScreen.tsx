import React, { useState } from 'react';
import { Incident } from '../types';
import { soundFx } from '../utils/audio';

interface RequestsScreenProps {
  incidents: Incident[];
  onSelectIncident: (incident: Incident) => void;
  onOpenNewReport: () => void;
}

export const RequestsScreen: React.FC<RequestsScreenProps> = ({
  incidents,
  onSelectIncident,
  onOpenNewReport,
}) => {
  const [statusFilter, setStatusFilter] = useState<'todas' | 'recebidas' | 'andamento' | 'resolvidas'>('todas');
  const [searchFilter, setSearchFilter] = useState('');

  // Dynamic real counts
  const counts = {
    todas: incidents.length,
    recebidas: incidents.filter((i) => i.status === 'recebida').length,
    andamento: incidents.filter((i) =>
      ['andamento', 'triagem', 'aguardando_material'].includes(i.status)
    ).length,
    resolvidas: incidents.filter((i) => i.status === 'resolvida').length,
  };

  const filtered = incidents.filter((item) => {
    if (statusFilter === 'recebidas' && item.status !== 'recebida') return false;
    if (
      statusFilter === 'andamento' &&
      !['andamento', 'triagem', 'aguardando_material'].includes(item.status)
    )
      return false;
    if (statusFilter === 'resolvidas' && item.status !== 'resolvida') return false;

    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase().trim();
      return (
        item.protocol.toLowerCase().includes(q) ||
        item.title.toLowerCase().includes(q) ||
        item.address.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <main className="flex-1 w-full max-w-[480px] mx-auto pt-2 pb-28 flex flex-col">
      {/* Title Section */}
      <div className="px-4 pt-2 pb-2">
        <h1 className="font-bold text-[24px] leading-tight text-[#171717] tracking-tight">
          Minhas solicitações
        </h1>
        <p className="font-normal text-[13px] leading-4 text-[#737373] mt-1">
          Acompanhe o andamento dos registros em Agudos, SP.
        </p>
      </div>

      {/* Filter Chips Row */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar py-2.5 px-4">
        <button
          onClick={() => {
            soundFx.playTap();
            setStatusFilter('todas');
          }}
          className={`flex-shrink-0 h-8 px-3.5 py-1 rounded-full text-[12px] transition-all shadow-xs cursor-pointer ${
            statusFilter === 'todas'
              ? 'bg-[#171717] text-white font-semibold'
              : 'bg-white text-[#171717] font-medium border border-[#171717]/8 hover:bg-neutral-50'
          }`}
        >
          Todas ({counts.todas})
        </button>

        <button
          onClick={() => {
            soundFx.playTap();
            setStatusFilter('recebidas');
          }}
          className={`flex-shrink-0 h-8 px-3.5 py-1 rounded-full text-[12px] transition-all shadow-xs cursor-pointer ${
            statusFilter === 'recebidas'
              ? 'bg-[#171717] text-white font-semibold'
              : 'bg-white text-[#171717] font-medium border border-[#171717]/8 hover:bg-neutral-50'
          }`}
        >
          Recebidas ({counts.recebidas})
        </button>

        <button
          onClick={() => {
            soundFx.playTap();
            setStatusFilter('andamento');
          }}
          className={`flex-shrink-0 h-8 px-3.5 py-1 rounded-full text-[12px] transition-all shadow-xs cursor-pointer ${
            statusFilter === 'andamento'
              ? 'bg-[#171717] text-white font-semibold'
              : 'bg-white text-[#171717] font-medium border border-[#171717]/8 hover:bg-neutral-50'
          }`}
        >
          Em andamento ({counts.andamento})
        </button>

        <button
          onClick={() => {
            soundFx.playTap();
            setStatusFilter('resolvidas');
          }}
          className={`flex-shrink-0 h-8 px-3.5 py-1 rounded-full text-[12px] transition-all shadow-xs cursor-pointer ${
            statusFilter === 'resolvidas'
              ? 'bg-[#171717] text-white font-semibold'
              : 'bg-white text-[#171717] font-medium border border-[#171717]/8 hover:bg-neutral-50'
          }`}
        >
          Concluídas ({counts.resolvidas})
        </button>
      </div>

      {/* Citizen Vigilante Summary Card - strictly real data */}
      <div className="px-4 my-1">
        <div className="bg-[#171717] text-white p-3.5 rounded-2xl shadow-xs flex items-center justify-between relative overflow-hidden">
          <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full bg-[#FFC928]/10 blur-xl pointer-events-none" />
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-9 h-9 rounded-xl bg-[#FFC928] text-[#171717] flex items-center justify-center font-bold shadow-xs">
              <span className="material-symbols-outlined text-[20px] font-semibold">
                verified
              </span>
            </div>
            <div>
              <p className="font-bold text-[10px] text-[#FFC928] tracking-widest uppercase">
                CIDADÃO DE AGUDOS
              </p>
              <p className="font-semibold text-[14px] text-white leading-tight mt-0.5">
                {incidents.length > 0
                  ? `${counts.resolvidas} de ${counts.todas} demandas resolvidas`
                  : 'Nenhuma solicitação ativa no momento'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 pr-1 relative z-10">
            {incidents.length > 0 ? (
              <span className="text-xs font-bold text-[#FFC928] bg-white/10 px-2 py-1 rounded-lg">
                {Math.round((counts.resolvidas / counts.todas) * 100)}%
              </span>
            ) : (
              <span className="text-[10px] text-gray-400">Sem dados</span>
            )}
          </div>
        </div>
      </div>

      {/* Incident List */}
      <div className="px-4 flex flex-col gap-3 mt-2">
        {filtered.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center text-center bg-white rounded-2xl border border-[#171717]/8 p-6 shadow-xs">
            <div className="w-14 h-14 rounded-2xl bg-[#FFF9EB] shadow-xs flex items-center justify-center text-[#F47721] mb-3 border border-[#FFC928]/30">
              <span className="material-symbols-outlined text-[28px]">assignment</span>
            </div>
            <h4 className="font-bold text-[15px] text-[#171717]">
              As suas solicitações aparecerão aqui quando você registrar uma.
            </h4>
            <p className="text-[12px] text-[#737373] mt-1.5 max-w-[280px] leading-relaxed">
              Se você identificou um problema em Agudos, ajude a cidade registrando uma ocorrência.
            </p>
            <button
              onClick={() => {
                soundFx.playTap();
                onOpenNewReport();
              }}
              className="mt-4 px-5 py-2.5 bg-[#FFC928] text-[#171717] rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-xs hover:brightness-105 active:scale-95 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              <span>Registrar ocorrência em Agudos</span>
            </button>
          </div>
        ) : (
          filtered.map((item) => {
            const isResolved = item.status === 'resolvida';
            const isInterditado = item.isUrgent;
            const isRecebida = item.status === 'recebida';

            return (
              <div
                key={item.id}
                onClick={() => {
                  soundFx.playTap();
                  onSelectIncident(item);
                }}
                className="relative bg-white rounded-2xl p-4 shadow-xs border border-[#171717]/8 flex flex-col gap-3 overflow-hidden transition-all active:scale-[0.99] cursor-pointer hover:shadow-sm"
              >
                {isInterditado && (
                  <div className="absolute top-0 left-0 right-0 h-1.5 hazard-stripe" />
                )}

                <div className={`flex items-center justify-between gap-2 ${isInterditado ? 'pt-1' : ''}`}>
                  <div className="flex items-center gap-2">
                    {isResolved ? (
                      <span className="px-2.5 py-0.5 rounded-full text-white bg-[#171717] font-semibold text-[11px] flex items-center gap-1.5 shadow-xs">
                        <span className="material-symbols-outlined text-[13px] text-[#FFC928]">
                          check_circle
                        </span>
                        Concluída
                      </span>
                    ) : isRecebida ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[#171717] bg-[#FFF9EB] border border-[#FFC928]/50 font-semibold text-[11px] flex items-center gap-1.5 shadow-xs">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#FFC928]" />
                        Recebida
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full text-white bg-[#F47721] font-semibold text-[11px] flex items-center gap-1.5 shadow-xs">
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                        Em andamento
                      </span>
                    )}

                    <span className="text-[11px] text-[#737373]">
                      #{item.protocol}
                    </span>
                  </div>

                  {isInterditado && (
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#FEF2F2] text-[#B91C1C] font-bold text-[10px] tracking-wide uppercase border border-[#FEE2E2]">
                      <span className="material-symbols-outlined text-[13px]">warning</span>
                      <span>INTERDITADO</span>
                    </div>
                  )}

                  {isResolved && (
                    <span className="text-[10px] text-[#065F46] bg-[#ECFDF5] px-2 py-0.5 rounded-full font-semibold border border-[#D1FAE5]">
                      Resolvido
                    </span>
                  )}
                </div>

                <div className="flex gap-3">
                  <div className="relative w-[68px] h-[68px] rounded-xl overflow-hidden flex-shrink-0 bg-neutral-100 border border-black/5 flex items-center justify-center">
                    {item.photoUrl ? (
                      <img
                        alt={item.title}
                        className="w-full h-full object-cover"
                        src={item.photoUrl}
                      />
                    ) : (
                      <span className="material-symbols-outlined text-gray-400 text-[24px]">
                        image
                      </span>
                    )}
                    <div className="absolute bottom-1 right-1 bg-[#171717]/75 backdrop-blur-xs text-white rounded p-0.5 flex items-center">
                      <span className="material-symbols-outlined text-[11px]">
                        photo_camera
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col justify-center flex-1 min-w-0">
                    <h3 className="font-bold text-[14px] leading-snug text-[#171717] line-clamp-1">
                      {item.title}
                    </h3>
                    <p className="text-[11px] text-[#737373] mt-0.5">
                      {item.statusHistory[0]?.date || 'Recentemente'}
                    </p>
                    <div className="flex items-center gap-1 text-[#4e4633] mt-1.5">
                      <span className="material-symbols-outlined text-[15px] text-[#F47721]">
                        location_on
                      </span>
                      <span className="text-[11px] font-medium truncate text-[#525252]">
                        {item.address}
                      </span>
                    </div>
                  </div>
                </div>

                <div
                  className={`rounded-xl p-2.5 flex items-center justify-between border ${
                    isResolved
                      ? 'bg-[#ECFDF5] border-[#A7F3D0]'
                      : 'bg-[#FBF9F9] border-[#171717]/5'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`material-symbols-outlined text-[18px] flex-shrink-0 ${
                        isResolved
                          ? 'text-[#065F46]'
                          : isRecebida
                          ? 'text-[#737373]'
                          : 'text-[#F47721]'
                      }`}
                    >
                      {item.actionIcon || (isResolved ? 'task_alt' : isRecebida ? 'hourglass_top' : 'engineering')}
                    </span>
                    <span
                      className={`text-[12px] font-medium truncate ${
                        isResolved ? 'text-[#065F46] font-semibold' : 'text-[#171717]'
                      }`}
                    >
                      {item.currentActionStep}
                    </span>
                  </div>
                  <span
                    className={`material-symbols-outlined text-[16px] flex-shrink-0 ${
                      isResolved ? 'text-[#065F46]' : 'text-[#737373]'
                    }`}
                  >
                    chevron_right
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Floating Action Button (+ Novo chamado) */}
      <div className="fixed bottom-20 left-1/2 -translate-x-1/2 w-full max-w-[480px] px-4 flex justify-end pointer-events-none z-40">
        <button
          onClick={() => {
            soundFx.playTap();
            onOpenNewReport();
          }}
          className="pointer-events-auto h-12 flex items-center gap-2 bg-[#FFC928] text-[#171717] font-bold text-[14px] px-5 rounded-full shadow-[0_8px_20px_-4px_rgba(244,119,33,0.38)] active:scale-95 transition-all duration-150 border border-[#171717]/10 hover:brightness-105 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[22px] font-bold">add</span>
          <span>Novo chamado</span>
        </button>
      </div>
    </main>
  );
};
