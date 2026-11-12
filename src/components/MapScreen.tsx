import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Incident } from '../types';
import { soundFx } from '../utils/audio';

interface MapScreenProps {
  incidents: Incident[];
  onSelectIncident: (incident: Incident) => void;
  onUpvoteIncident: (incidentId: string) => void;
  onCreateIncidentAtCoords: (coords: { lat: number; lng: number; address?: string }) => void;
}

// Agudos, SP geographic center and limits
const AGUDOS_CENTER: [number, number] = [-22.4694, -48.9867];
const AGUDOS_BOUNDS = {
  minLat: -22.65,
  maxLat: -22.35,
  minLng: -49.15,
  maxLng: -48.85,
};

function isCoordInAgudos(lat: number, lng: number): boolean {
  return (
    lat >= AGUDOS_BOUNDS.minLat &&
    lat <= AGUDOS_BOUNDS.maxLat &&
    lng >= AGUDOS_BOUNDS.minLng &&
    lng <= AGUDOS_BOUNDS.maxLng
  );
}

export const MapScreen: React.FC<MapScreenProps> = ({
  incidents,
  onSelectIncident,
  onUpvoteIncident,
  onCreateIncidentAtCoords,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const tempMarkerRef = useRef<L.Marker | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'abertos' | 'andamento' | 'resolvidos'>('todos');
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<{ lat: number; lng: number; address: string } | null>(null);
  const [outsideWarning, setOutsideWarning] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // Dynamic counts for status chips
  const counts = {
    todos: incidents.length,
    abertos: incidents.filter(i => ['recebida', 'triagem', 'andamento', 'aguardando_material'].includes(i.status)).length,
    andamento: incidents.filter(i => ['andamento', 'triagem', 'aguardando_material'].includes(i.status)).length,
    resolvidos: incidents.filter(i => i.status === 'resolvida').length,
  };

  // Filtered real incidents
  const visibleIncidents = incidents.filter(item => {
    if (statusFilter === 'abertos') {
      if (!['recebida', 'triagem', 'andamento', 'aguardando_material'].includes(item.status)) return false;
    } else if (statusFilter === 'andamento') {
      if (!['andamento', 'triagem', 'aguardando_material'].includes(item.status)) return false;
    } else if (statusFilter === 'resolvidos') {
      if (item.status !== 'resolvida') return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      return (
        item.title.toLowerCase().includes(q) ||
        item.protocol.toLowerCase().includes(q) ||
        item.address.toLowerCase().includes(q) ||
        item.neighborhood.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Reverse geocoding helper for Agudos
  const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        { headers: { 'Accept-Language': 'pt-BR,pt;q=0.9' } }
      );
      const data = await res.json();
      if (data && data.address) {
        const road = data.address.road || data.address.street || 'Rua';
        const houseNumber = data.address.house_number ? `, ${data.address.house_number}` : '';
        const suburb = data.address.suburb || data.address.neighbourhood || 'Centro';
        return `${road}${houseNumber} - ${suburb}, Agudos - SP`;
      }
    } catch (_) {}
    return `Agudos, SP (Coord: ${lat.toFixed(4)}, ${lng.toFixed(4)})`;
  };

  // Initialize Leaflet Map centered strictly in Agudos, SP
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: AGUDOS_CENTER,
      zoom: 15,
      minZoom: 12,
      maxZoom: 19,
      zoomControl: false,
      attributionControl: false,
      maxBounds: [
        [AGUDOS_BOUNDS.minLat - 0.1, AGUDOS_BOUNDS.minLng - 0.1],
        [AGUDOS_BOUNDS.maxLat + 0.1, AGUDOS_BOUNDS.maxLng + 0.1],
      ],
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map);

    const markersGroup = L.layerGroup().addTo(map);
    markersLayerRef.current = markersGroup;
    mapInstanceRef.current = map;

    // Map click: check if inside Agudos
    map.on('click', async (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      if (!isCoordInAgudos(lat, lng)) {
        soundFx.playTap();
        setOutsideWarning('O Reportaê atende somente ao município de Agudos, SP. Selecione uma localização dentro da cidade.');
        setTimeout(() => setOutsideWarning(null), 5000);
        return;
      }

      setOutsideWarning(null);
      soundFx.playTap();
      const addr = await reverseGeocode(lat, lng);
      setSelectedPoint({ lat, lng, address: addr });
      setSelectedIncident(null);

      // Add temporary selection pin
      if (tempMarkerRef.current) {
        map.removeLayer(tempMarkerRef.current);
      }
      const pinIcon = L.divIcon({
        className: 'custom-map-pin',
        iconSize: [36, 44],
        iconAnchor: [18, 44],
        html: `
          <div style="text-align: center;">
            <div style="width: 36px; height: 36px; background: #FFC928; border: 3px solid #171717; border-radius: 9999px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.3);">
              <span class="material-symbols-outlined" style="font-size: 20px; color: #171717;">add_location_alt</span>
            </div>
            <div style="width: 8px; height: 8px; background: #171717; transform: rotate(45deg); margin: -4px auto 0 auto;"></div>
          </div>
        `,
      });
      tempMarkerRef.current = L.marker([lat, lng], { icon: pinIcon }).addTo(map);
    });

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Sync real incident markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersGroup = markersLayerRef.current;
    if (!map || !markersGroup) return;

    markersGroup.clearLayers();

    visibleIncidents.forEach((item) => {
      const isSelected = selectedIncident?.id === item.id;
      const lat = item.lat;
      const lng = item.lng;

      let iconName = 'warning';
      let bgColor = '#171717';
      let iconColor = '#FFC928';

      if (item.category === 'iluminacao') {
        bgColor = '#FFC928';
        iconColor = '#171717';
        iconName = 'light_mode';
      } else if (item.category === 'lixo') {
        bgColor = '#F47721';
        iconColor = '#FFFFFF';
        iconName = 'delete_sweep';
      } else if (item.category === 'vazamento') {
        bgColor = '#171717';
        iconColor = '#FFC928';
        iconName = 'water_drop';
      } else if (item.category === 'semaforo') {
        bgColor = '#FFC928';
        iconColor = '#171717';
        iconName = 'traffic';
      }

      const customIcon = L.divIcon({
        className: 'custom-map-pin',
        iconSize: [44, 52],
        iconAnchor: [22, 48],
        html: `
          <div style="position: relative; cursor: pointer; text-align: center;">
            ${isSelected ? `
              <div style="position: absolute; top: -24px; left: 50%; transform: translateX(-50%); background: #171717; color: white; padding: 2px 8px; border-radius: 9999px; font-weight: 700; font-size: 10px; white-space: nowrap; box-shadow: 0 4px 6px rgba(0,0,0,0.2); display: flex; align-items: center; gap: 4px;">
                <span style="width: 6px; height: 6px; border-radius: 9999px; background: #F47721;"></span>
                #${item.protocol.slice(-4)} • Ativo
              </div>
              <span style="position: absolute; bottom: -4px; left: 50%; transform: translateX(-50%); width: 36px; height: 36px; border-radius: 9999px; background: rgba(244,119,33,0.35); animation: ping 1.5s infinite;"></span>
            ` : ''}
            <div style="
              width: ${isSelected ? '44px' : '36px'}; 
              height: ${isSelected ? '44px' : '36px'}; 
              background: ${bgColor}; 
              border-radius: 9999px; 
              display: flex; 
              align-items: center; 
              justify-content: center; 
              margin: 0 auto;
              box-shadow: 0 6px 12px rgba(0,0,0,0.25);
              border: ${isSelected ? '3px solid #FFC928' : '2px solid white'};
            ">
              <span class="material-symbols-outlined" style="font-size: ${isSelected ? '22px' : '18px'}; color: ${iconColor};">
                ${iconName}
              </span>
            </div>
            <div style="width: 8px; height: 8px; background: ${bgColor}; transform: rotate(45deg); margin: -4px auto 0 auto;"></div>
          </div>
        `,
      });

      const marker = L.marker([lat, lng], { icon: customIcon });
      marker.on('click', () => {
        soundFx.playTap();
        setSelectedIncident(item);
        setSelectedPoint(null);
        if (tempMarkerRef.current && map) {
          map.removeLayer(tempMarkerRef.current);
          tempMarkerRef.current = null;
        }
        map.panTo([lat, lng], { animate: true });
      });

      markersGroup.addLayer(marker);
    });
  }, [visibleIncidents, selectedIncident]);

  // Recenter strictly on Agudos center
  const handleRecenter = () => {
    soundFx.playTap();
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo(AGUDOS_CENTER, 15, { animate: true });
    }
  };

  // Search address in Agudos via Nominatim
  const handleSearchAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setOutsideWarning(null);

    try {
      const q = encodeURIComponent(`${searchQuery}, Agudos, SP, Brasil`);
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${q}&viewbox=-49.15,-22.35,-48.85,-22.65&bounded=1&limit=3`
      );
      const data = await res.json();

      if (data && data.length > 0) {
        const item = data[0];
        const lat = parseFloat(item.lat);
        const lng = parseFloat(item.lon);

        if (isCoordInAgudos(lat, lng)) {
          if (mapInstanceRef.current) {
            mapInstanceRef.current.flyTo([lat, lng], 17, { animate: true });
          }
          const addr = await reverseGeocode(lat, lng);
          setSelectedPoint({ lat, lng, address: addr });
          setSelectedIncident(null);
        } else {
          setOutsideWarning('O Reportaê atende somente ao município de Agudos, SP. Selecione uma localização dentro da cidade.');
        }
      } else {
        setOutsideWarning('Endereço não localizado em Agudos. Tente o nome da rua ou toque no mapa.');
      }
    } catch (_) {
      setOutsideWarning('Erro ao buscar endereço em Agudos.');
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <main className="relative w-full h-[calc(100vh-56px-64px)] overflow-hidden">
      {/* Real Interactive Leaflet Map Canvas */}
      <div ref={mapContainerRef} className="absolute inset-0 w-full h-full z-0" />

      {/* Outside Agudos Warning Alert */}
      {outsideWarning && (
        <div className="absolute top-20 inset-x-3 z-40 max-w-[420px] mx-auto bg-[#FEF2F2] border-2 border-red-500 rounded-2xl p-3 shadow-xl flex items-center gap-2.5 animate-in fade-in">
          <span className="material-symbols-outlined text-red-600 text-[22px] shrink-0">
            warning
          </span>
          <p className="text-xs text-red-800 font-semibold leading-snug flex-1">
            {outsideWarning}
          </p>
          <button
            onClick={() => setOutsideWarning(null)}
            className="text-red-700 hover:text-red-900"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      )}

      {/* Top Floating Search Bar + Hazard Caution Ribbon + Filter Chips */}
      <div className="absolute top-2.5 inset-x-0 z-30 flex flex-col px-3.5 gap-2.5 max-w-[480px] mx-auto pointer-events-none">
        <form onSubmit={handleSearchAddress} className="flex items-center gap-2 w-full pointer-events-auto">
          <div className="relative flex-1 flex flex-col bg-white rounded-xl shadow-md overflow-hidden border border-[#171717]/8">
            <div className="flex items-center h-11 px-3 gap-2">
              <span className="material-symbols-outlined text-[20px] text-[#737373]">
                {isSearching ? 'progress_activity' : 'search'}
              </span>
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent text-[13px] text-[#171717] placeholder:text-[#8E8E93] focus:outline-none"
                placeholder="Buscar ruas ou bairros em Agudos, SP..."
                type="text"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Limpar busca"
                  className="flex items-center justify-center w-5 h-5 rounded-full text-[#8E8E93] hover:text-[#171717]"
                >
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              )}
            </div>
            <div className="w-full h-1 hazard-stripe" />
          </div>

          <button
            type="button"
            onClick={() => {
              soundFx.playTap();
              const cycle: Record<string, 'todos' | 'abertos' | 'andamento' | 'resolvidos'> = {
                todos: 'abertos',
                abertos: 'andamento',
                andamento: 'resolvidos',
                resolvidos: 'todos',
              };
              setStatusFilter(cycle[statusFilter]);
            }}
            aria-label="Alternar filtros"
            title="Alternar filtros"
            className="flex items-center justify-center w-11 h-11 rounded-xl bg-white text-[#171717] shadow-md border border-[#171717]/10 active:scale-95 transition-transform shrink-0 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">tune</span>
          </button>
        </form>

        {/* Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 no-scrollbar pointer-events-auto">
          <button
            onClick={() => {
              soundFx.playTap();
              setStatusFilter('todos');
            }}
            className={`flex items-center gap-1.5 px-3 h-8 rounded-full text-[11px] font-semibold whitespace-nowrap active:scale-95 shrink-0 transition-all cursor-pointer ${
              statusFilter === 'todos'
                ? 'bg-[#171717] text-white shadow-sm'
                : 'bg-white text-[#171717] shadow-sm border border-[#171717]/10'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-[#FFC928]" />
            <span>Todos ({counts.todos})</span>
          </button>

          <button
            onClick={() => {
              soundFx.playTap();
              setStatusFilter('abertos');
            }}
            className={`flex items-center gap-1.5 px-3 h-8 rounded-full text-[11px] font-semibold whitespace-nowrap active:scale-95 shrink-0 transition-all cursor-pointer ${
              statusFilter === 'abertos'
                ? 'bg-[#171717] text-white shadow-sm'
                : 'bg-white text-[#171717] shadow-sm border border-[#171717]/10'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-[#FFC928]" />
            <span>Abertos ({counts.abertos})</span>
          </button>

          <button
            onClick={() => {
              soundFx.playTap();
              setStatusFilter('andamento');
            }}
            className={`flex items-center gap-1.5 px-3 h-8 rounded-full text-[11px] font-semibold whitespace-nowrap active:scale-95 shrink-0 transition-all cursor-pointer ${
              statusFilter === 'andamento'
                ? 'bg-[#171717] text-white shadow-sm'
                : 'bg-white text-[#171717] shadow-sm border border-[#171717]/10'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-[#F47721]" />
            <span>Em andamento ({counts.andamento})</span>
          </button>

          <button
            onClick={() => {
              soundFx.playTap();
              setStatusFilter('resolvidos');
            }}
            className={`flex items-center gap-1.5 px-3 h-8 rounded-full text-[11px] font-semibold whitespace-nowrap active:scale-95 shrink-0 transition-all cursor-pointer ${
              statusFilter === 'resolvidos'
                ? 'bg-[#171717] text-white shadow-sm'
                : 'bg-white text-[#737373] shadow-sm border border-[#171717]/10'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Resolvidos ({counts.resolvidos})</span>
          </button>
        </div>
      </div>

      {/* Floating Recenter FAB Button: Agudos Center */}
      <div className="absolute bottom-48 right-4 z-30 pointer-events-auto">
        <button
          onClick={handleRecenter}
          aria-label="Centralizar em Agudos"
          title="Centralizar em Agudos, SP"
          className="flex items-center justify-center w-11 h-11 rounded-full bg-white text-[#F47721] shadow-lg border border-[#171717]/10 active:scale-90 transition-transform cursor-pointer"
        >
          <span className="material-symbols-outlined text-[22px]">
            my_location
          </span>
        </button>
      </div>

      {/* Selected Point on Map (Create Report Prompt) */}
      {selectedPoint && !selectedIncident && (
        <div className="absolute bottom-3 inset-x-0 z-30 px-4 pointer-events-auto max-w-[480px] mx-auto animate-in slide-in-from-bottom-2">
          <div className="w-full bg-white rounded-2xl p-4 shadow-xl border-2 border-[#FFC928]">
            <div className="flex items-center justify-between pb-1.5">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#F47721] flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#F47721]" />
                Local Selecionado em Agudos
              </span>
              <button
                onClick={() => setSelectedPoint(null)}
                className="text-gray-400 hover:text-black"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
            <p className="text-xs font-bold text-[#171717] line-clamp-2">
              {selectedPoint.address}
            </p>
            <button
              onClick={() => {
                soundFx.playTap();
                onCreateIncidentAtCoords({
                  lat: selectedPoint.lat,
                  lng: selectedPoint.lng,
                  address: selectedPoint.address,
                });
                setSelectedPoint(null);
              }}
              className="mt-3 w-full h-11 bg-[#FFC928] text-[#171717] font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-xs hover:brightness-105 active:scale-98 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">photo_camera</span>
              <span>Registrar ocorrência neste ponto</span>
            </button>
          </div>
        </div>
      )}

      {/* Empty Map Notice when 0 incidents and no point selected */}
      {visibleIncidents.length === 0 && !selectedPoint && (
        <div className="absolute bottom-4 inset-x-4 z-20 pointer-events-auto max-w-[440px] mx-auto">
          <div className="bg-white/95 backdrop-blur-md rounded-2xl p-3.5 shadow-lg border border-[#171717]/10 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-[#FFF9EB] border border-[#FFC928]/40 flex items-center justify-center text-[#F47721] shrink-0">
                <span className="material-symbols-outlined text-[20px]">pin_drop</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-[#171717] truncate">
                  Mapa de Agudos, SP
                </p>
                <p className="text-[11px] text-[#737373] truncate">
                  Toque no mapa para marcar e relatar um problema.
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                soundFx.playTap();
                onCreateIncidentAtCoords({ lat: AGUDOS_CENTER[0], lng: AGUDOS_CENTER[1] });
              }}
              className="px-3 h-9 bg-[#FFC928] text-[#171717] rounded-xl font-bold text-[11px] whitespace-nowrap active:scale-95 transition-transform shrink-0"
            >
              + Relatar
            </button>
          </div>
        </div>
      )}

      {/* Incident Card when marker is clicked */}
      {selectedIncident && (
        <div className="absolute bottom-3 inset-x-0 z-30 px-4 pointer-events-auto max-w-[480px] mx-auto animate-in slide-in-from-bottom-2">
          <div className="w-full bg-white rounded-2xl p-4 shadow-xl border border-[#171717]/10 transition-all duration-300">
            <div className="flex items-center justify-between pb-2">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#F47721] animate-pulse" />
                <span className="text-[11px] font-bold text-[#F47721] uppercase tracking-wider">
                  PROTOCOLO #{selectedIncident.protocol}
                </span>
              </div>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#F47721]/10 text-[#F47721] font-semibold text-[11px]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#F47721]" />
                {selectedIncident.statusLabel}
              </span>
            </div>

            <div
              className="flex items-center gap-3 cursor-pointer"
              onClick={() => {
                soundFx.playTap();
                onSelectIncident(selectedIncident);
              }}
            >
              <div className="relative w-14 h-14 rounded-xl overflow-hidden shrink-0 bg-[#FFF9EB] border border-[#171717]/10 flex items-center justify-center">
                {selectedIncident.photoUrl ? (
                  <img
                    alt={selectedIncident.title}
                    className="w-full h-full object-cover"
                    src={selectedIncident.photoUrl}
                  />
                ) : (
                  <span className="material-symbols-outlined text-gray-400 text-[20px]">
                    image
                  </span>
                )}
                <span className="absolute bottom-0.5 right-0.5 flex items-center justify-center w-4 h-4 rounded bg-[#171717]/80 text-[#FFC928]">
                  <span className="material-symbols-outlined text-[10px]">photo_camera</span>
                </span>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 text-[11px] text-[#737373] font-medium">
                  <span className="material-symbols-outlined text-[13px] text-[#F47721]">
                    construction
                  </span>
                  <span className="truncate">{selectedIncident.categoryLabel}</span>
                </div>
                <h3 className="text-[14px] font-bold text-[#171717] truncate mt-0.5">
                  {selectedIncident.address}
                </h3>
                <p className="text-[11px] text-[#8E8E93] truncate flex items-center gap-0.5">
                  <span className="material-symbols-outlined text-[12px]">pin_drop</span>
                  {selectedIncident.neighborhood}, Agudos - SP
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-3 pt-2 border-t border-[#171717]/5">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  soundFx.playUpvote();
                  onUpvoteIncident(selectedIncident.id);
                }}
                aria-label="Apoiar este relato"
                className="flex items-center justify-center gap-1 px-3 h-10 rounded-xl bg-[#FFF9EB] text-[#171717] hover:bg-[#FFC928]/20 transition-colors active:scale-95 shrink-0 cursor-pointer border border-[#FFC928]/20"
              >
                <span className="material-symbols-outlined text-[17px] text-[#F47721]">
                  thumb_up
                </span>
                <span className="text-[12px] font-semibold whitespace-nowrap">
                  {selectedIncident.upvotesCount} apoios
                </span>
              </button>

              <button
                onClick={() => {
                  soundFx.playTap();
                  onSelectIncident(selectedIncident);
                }}
                className="flex-1 flex items-center justify-center gap-1.5 h-10 px-3 rounded-xl bg-[#FFC928] text-[#171717] text-[12px] font-bold shadow-xs active:scale-98 transition-transform hover:brightness-105 cursor-pointer"
              >
                <span>Ver detalhes completos</span>
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};
