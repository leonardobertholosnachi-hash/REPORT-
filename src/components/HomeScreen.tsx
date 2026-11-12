import React, { useState } from 'react';
import { Incident } from '../types';
import { soundFx } from '../utils/audio';

interface HomeScreenProps {
  incidents: Incident[];
  onOpenNewReport: (category?: string) => void;
  onSelectIncident: (incident: Incident) => void;
  onGoToMap: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  incidents,
  onOpenNewReport,
  onSelectIncident,
  onGoToMap,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  const categories = [
    { id: 'buraco', title: 'Buraco na rua', desc: 'Asfalto e pista', icon: 'minor_crash' },
    { id: 'lixo', title: 'Lixo acumulado', desc: 'Descarte e entulho', icon: 'delete_sweep' },
    { id: 'sinalizacao', title: 'Sinalização', desc: 'Placas, faixas e semáforos', icon: 'traffic' },
    { id: 'bueiros', title: 'Bueiros', desc: 'Entupimento, tampa e água', icon: 'water_damage' },
    { id: 'calcada', title: 'Calçada danificada', desc: 'Piso e acessibilidade', icon: 'accessible' },
  ];

  // Filtered real incidents
  const filteredIncidents = incidents.filter((item) => {
    if (categoryFilter && item.category !== categoryFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      return (
        item.title.toLowerCase().includes(q) ||
        item.protocol.toLowerCase().includes(q) ||
        item.address.toLowerCase().includes(q) ||
        item.neighborhood.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <main className="flex-1 flex flex-col px-4 pt-3.5 pb-28 gap-4 max-w-[480px] mx-auto w-full">
      {/* 1. Search Bar with Hazard Ribbon on Bottom Edge */}
      <div className="relative flex items-center bg-white rounded-xl shadow-xs border border-[#171717]/10 overflow-hidden h-[44px] px-3">
        <span className="material-symbols-outlined text-[#737373] text-[20px] mr-2 flex-shrink-0">
          search
        </span>
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-transparent text-[#171717] placeholder:text-[#8E8E93] text-[13.5px] font-medium focus:outline-none border-none p-0"
          placeholder="Buscar ruas, bairros ou ocorrências em Agudos..."
          type="text"
        />
        {searchQuery ? (
          <button
            onClick={() => setSearchQuery('')}
            className="text-[#8E8E93] hover:text-[#171717] p-1 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        ) : (
          <button
            onClick={() => {
              soundFx.playTap();
              onGoToMap();
            }}
            title="Abrir mapa de Agudos"
            className="text-[#8E8E93] hover:text-[#F47721] p-1 active:scale-95 transition-transform cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">map</span>
          </button>
        )}
        <div className="absolute bottom-0 left-0 right-0 h-[3px] hazard-stripe-sm" />
      </div>

      {/* 2. Hero Welcome Card: Asphalt #171717 with Hazard Tape Detail */}
      <section className="relative bg-[#171717] rounded-2xl p-5 shadow-md text-white overflow-hidden">
        <div
          className="absolute -top-1 -right-8 rotate-12 shadow-md z-10 flex items-center px-8 py-0.5"
          style={{
            backgroundImage:
              'repeating-linear-gradient(45deg, #FFC928, #FFC928 6px, #171717 6px, #171717 12px)',
          }}
        >
          <span className="bg-[#171717]/90 text-[#FFC928] text-[8.5px] font-extrabold tracking-widest px-1.5 py-0.5 rounded-xs uppercase">
            AGUDOS - SP
          </span>
        </div>

        <div className="relative z-0 pr-8">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 text-[#FFC928] text-[11px] font-semibold mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#FFC928] animate-pulse" />
            Zeladoria Urbana • Agudos
          </div>
          <h2 className="text-[20px] font-bold text-white tracking-tight leading-tight">
            Vamos melhorar Agudos?
          </h2>
          <p className="text-[13px] text-gray-300 font-normal mt-1 leading-snug">
            Encontrou algum problema na sua rua ou no seu bairro em Agudos? Registre aqui.
          </p>
        </div>

        <button
          onClick={() => {
            soundFx.playTap();
            onOpenNewReport();
          }}
          className="mt-4 w-full h-12 bg-[#FFC928] text-[#171717] rounded-xl font-bold text-[15px] flex items-center justify-center gap-2 shadow-sm hover:brightness-105 active:scale-[0.98] transition-all cursor-pointer"
        >
          <span className="material-symbols-outlined text-[22px] font-bold text-[#171717]">
            photo_camera
          </span>
          <span>Registrar problema</span>
        </button>
      </section>

      {/* 3. Categories Section ('O que você encontrou?') */}
      <section className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <h3 className="text-[15px] font-bold text-[#171717]">O que você encontrou?</h3>
          {categoryFilter && (
            <button
              onClick={() => {
                soundFx.playTap();
                setCategoryFilter(null);
              }}
              className="text-[12px] font-semibold text-[#F47721] cursor-pointer hover:underline"
            >
              Limpar filtro
            </button>
          )}
        </div>

        {/* 2x2 Grid of Clean White Rounded Cards */}
        <div className="grid grid-cols-2 gap-2.5">
          {categories.map((cat) => {
            const isSelected = categoryFilter === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => {
                  soundFx.playTap();
                  if (isSelected) {
                    setCategoryFilter(null);
                  } else {
                    setCategoryFilter(cat.id);
                  }
                }}
                className={`flex flex-col items-start p-3 bg-white rounded-xl border transition-all text-left group active:scale-[0.98] cursor-pointer ${
                  isSelected
                    ? 'border-[#171717] ring-2 ring-[#FFC928] shadow-sm bg-amber-50/40'
                    : 'border-[#171717]/8 shadow-xs hover:border-[#F47721]/30 hover:bg-amber-50/20'
                }`}
              >
                <div className="w-9 h-9 rounded-lg bg-[#FFF4E5] text-[#F47721] flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                  <span className="material-symbols-outlined text-[20px]">{cat.icon}</span>
                </div>
                <span className="text-[13px] font-bold text-[#171717] leading-tight">
                  {cat.title}
                </span>
                <span className="text-[11px] text-[#737373] mt-0.5">{cat.desc}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* 4. Real Feed of Community Reports in Agudos */}
      <section className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <h3 className="text-[15px] font-bold text-[#171717]">Ocorrências em Agudos</h3>
            <span className="text-[11px] bg-white px-2 py-0.5 rounded-full border border-[#171717]/10 text-[#737373] font-medium">
              Município de Agudos
            </span>
          </div>
          <span className="text-[11px] text-[#737373] font-medium">
            {incidents.length} {incidents.length === 1 ? 'registro' : 'registros'}
          </span>
        </div>

        {filteredIncidents.length === 0 ? (
          /* Empty state when no incidents recorded */
          <div className="bg-white rounded-2xl p-6 text-center border border-[#171717]/8 shadow-xs flex flex-col items-center">
            <div className="w-14 h-14 rounded-2xl bg-[#FFF9EB] border border-[#FFC928]/30 flex items-center justify-center text-[#F47721] mb-3">
              <span className="material-symbols-outlined text-[30px]">
                location_city
              </span>
            </div>
            <h4 className="text-[15px] font-bold text-[#171717]">
              Nenhuma ocorrência registrada por aqui.
            </h4>
            <p className="text-xs text-[#737373] mt-1.5 max-w-[280px] leading-relaxed">
              Se você identificou um problema em Agudos, ajude a cidade registrando uma ocorrência.
            </p>
            <button
              onClick={() => {
                soundFx.playTap();
                onOpenNewReport(categoryFilter || undefined);
              }}
              className="mt-4 px-5 h-10 bg-[#FFC928] text-[#171717] rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs hover:brightness-105 active:scale-95 transition-transform cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">add_location_alt</span>
              <span>Registrar ocorrência em Agudos</span>
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {filteredIncidents.map((incident) => {
              const isResolved = incident.status === 'resolvida';
              return (
                <div
                  key={incident.id}
                  onClick={() => {
                    soundFx.playTap();
                    onSelectIncident(incident);
                  }}
                  className="bg-white rounded-xl p-3 border border-[#171717]/8 shadow-xs hover:shadow-sm active:scale-[0.99] transition-all cursor-pointer flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          isResolved ? 'bg-emerald-500' : 'bg-[#F47721]'
                        }`}
                      />
                      <span className="text-[12px] font-bold text-[#171717] tracking-tight">
                        #{incident.protocol}
                      </span>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide flex items-center gap-1 ${
                        isResolved
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-[#FFF4E5] text-[#F47721]'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          isResolved ? 'bg-emerald-600' : 'bg-[#F47721]'
                        }`}
                      />
                      {incident.statusLabel}
                    </span>
                  </div>

                  <div className="flex gap-3 items-center">
                    <div className="relative w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 bg-[#FFF9EB] border border-gray-100 flex items-center justify-center">
                      {incident.photoUrl ? (
                        <img
                          className="w-full h-full object-cover"
                          alt={incident.title}
                          src={incident.photoUrl}
                        />
                      ) : (
                        <span className="material-symbols-outlined text-[#737373] text-[24px]">
                          image
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col min-w-0 flex-1">
                      <h4 className="text-[13.5px] font-bold text-[#171717] truncate leading-tight">
                        {incident.title}
                      </h4>
                      <div className="flex items-center text-[#737373] text-[11px] mt-0.5 gap-1 truncate">
                        <span className="material-symbols-outlined text-[14px] text-[#F47721] flex-shrink-0">
                          location_on
                        </span>
                        <span className="truncate">{incident.address}</span>
                      </div>
                      <span className="text-[10px] text-[#8E8E93] mt-1 font-medium">
                        {incident.statusHistory[incident.statusHistory.length - 1]?.date || 'Hoje'} • {incident.upvotesCount} {incident.upvotesCount === 1 ? 'apoio' : 'apoios'}
                      </span>
                    </div>

                    <span className="material-symbols-outlined text-gray-400 text-[18px]">
                      chevron_right
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 5. Footer Slogan */}
      <div className="pt-2 pb-1 flex flex-col items-center justify-center text-center">
        <div className="flex items-center gap-2 text-[#737373] text-[11px] font-medium">
          <span>Fotografe</span>
          <span className="text-[#FFC928] font-black">•</span>
          <span>Registre</span>
          <span className="text-[#FFC928] font-black">•</span>
          <span>Acompanhe</span>
        </div>
        <p className="text-[11px] text-[#8E8E93] mt-0.5">
          Viu um problema em Agudos? <span className="font-bold text-[#171717]">Reportaê!</span>
        </p>
      </div>
    </main>
  );
};
