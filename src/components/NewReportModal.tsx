import React, { useState, useRef, useEffect } from 'react';
import { soundFx } from '../utils/audio';

interface NewReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (reportData: {
    title: string;
    description: string;
    category: string;
    subcategory?: string;
    subcategoryLabel?: string;
    photoUrl: string;
    address: string;
    neighborhood: string;
    city: string;
    state: string;
    lat: number;
    lng: number;
    isUrgent: boolean;
  }) => Promise<{ protocol: string } | null>;
  initialCategory?: string;
  initialCoords?: { lat: number; lng: number; address?: string };
}

// Agudos geographic center and boundary
const AGUDOS_CENTER = { lat: -22.4694, lng: -48.9867 };
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

export const NewReportModal: React.FC<NewReportModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialCategory = 'buraco',
  initialCoords,
}) => {
  const [category, setCategory] = useState(initialCategory);
  const [subcategory, setSubcategory] = useState('');
  const [subcategoryLabel, setSubcategoryLabel] = useState('');
  const [description, setDescription] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string>('');
  const [photoName, setPhotoName] = useState('');
  const [photoSize, setPhotoSize] = useState('');
  const [hasPhoto, setHasPhoto] = useState(false);

  const [address, setAddress] = useState('Av. Coronel João Valério, Centro, Agudos - SP');
  const [neighborhood, setNeighborhood] = useState('Centro');
  const [coords, setCoords] = useState<{ lat: number; lng: number }>(AGUDOS_CENTER);

  const [isUrgent, setIsUrgent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdProtocol, setCreatedProtocol] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialCoords && isCoordInAgudos(initialCoords.lat, initialCoords.lng)) {
      setCoords({ lat: initialCoords.lat, lng: initialCoords.lng });
      if (initialCoords.address) {
        setAddress(initialCoords.address);
      }
    }
  }, [initialCoords]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage('A imagem deve ter no máximo 10MB.');
      return;
    }

    setPhotoName(file.name);
    setPhotoSize((file.size / (1024 * 1024)).toFixed(1) + ' MB');

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setPhotoUrl(event.target.result as string);
        setHasPhoto(true);
        setErrorMessage(null);
        soundFx.playTap();
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDetectGPS = () => {
    soundFx.playTap();
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;

          // STRICT CHECK: Is user actually in Agudos?
          if (!isCoordInAgudos(lat, lng)) {
            setErrorMessage('O Reportaê atende somente ao município de Agudos, SP. Selecione uma localização dentro da cidade.');
            return;
          }

          setCoords({ lat, lng });
          setErrorMessage(null);

          // Reverse geocode in Agudos
          try {
            const res = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`
            );
            const data = await res.json();
            if (data?.address) {
              const road = data.address.road || 'Rua';
              const num = data.address.house_number ? `, ${data.address.house_number}` : '';
              const sub = data.address.suburb || data.address.neighbourhood || 'Centro';
              setAddress(`${road}${num} - ${sub}, Agudos - SP`);
              setNeighborhood(sub);
            }
          } catch (_) {
            setAddress(`Agudos, SP (GPS: ${lat.toFixed(4)}, ${lng.toFixed(4)})`);
          }
        },
        () => {
          setErrorMessage('Não foi possível obter a localização do GPS. Por favor, ajuste o ponto em Agudos.');
        },
        { enableHighAccuracy: true, timeout: 6000 }
      );
    } else {
      setErrorMessage('Geolocalização não suportada no seu navegador.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Verify coordinates belong to Agudos
    if (!isCoordInAgudos(coords.lat, coords.lng)) {
      setErrorMessage('O Reportaê atende somente ao município de Agudos, SP. Selecione uma localização dentro da cidade.');
      return;
    }

    if (!hasPhoto) {
      setErrorMessage('Por favor, adicione uma foto do problema.');
      return;
    }
    if (!description.trim()) {
      setErrorMessage('Por favor, descreva o problema.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await onSubmit({
        title: description.slice(0, 48) + (description.length > 48 ? '...' : ''),
        description,
        category,
        subcategory: subcategory || undefined,
        subcategoryLabel: subcategoryLabel || undefined,
        photoUrl,
        address,
        neighborhood,
        city: 'Agudos',
        state: 'SP',
        lat: coords.lat,
        lng: coords.lng,
        isUrgent,
      });

      if (res && res.protocol) {
        soundFx.playSuccess();
        setCreatedProtocol(res.protocol);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao registrar ocorrência em Agudos. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#FFF9EB] flex flex-col antialiased">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Top Header */}
      <header className="sticky top-0 inset-x-0 z-50 bg-[#FFF9EB]/95 backdrop-blur-md border-b border-[#F0E6D2]/80 pt-safe">
        <div className="w-full max-w-[480px] mx-auto h-14 px-4 flex items-center justify-between">
          <button
            aria-label="Voltar"
            onClick={() => {
              soundFx.playTap();
              onClose();
            }}
            className="w-10 h-10 -ml-1.5 flex items-center justify-center rounded-full text-[#171717] hover:bg-black/5 active:bg-black/10 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[24px]">arrow_back</span>
          </button>

          <div className="flex items-center justify-center flex-1 px-2">
            <img
              alt="Reportaê Agudos"
              className="h-8 max-w-[140px] w-auto object-contain"
              src="/assets/aistudio/Logo_minimalista_Reporta__em_amarelo_e_carv_o_268a0ba2.png"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = '/logo.png';
              }}
            />
          </div>

          <button
            aria-label="Fechar"
            onClick={() => {
              soundFx.playTap();
              onClose();
            }}
            className="w-10 h-10 -mr-1.5 flex items-center justify-center rounded-full text-[#171717]/70 hover:bg-black/5 active:bg-black/10 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </div>
      </header>

      {/* Form Container */}
      <main className="flex-1 flex flex-col w-full max-w-[480px] mx-auto px-4 pt-4 pb-24">
        <div className="flex items-center justify-between py-2">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#F47721] animate-pulse" />
            <h2 className="text-sm font-bold tracking-tight text-[#171717] uppercase">
              NOVA OCORRÊNCIA EM AGUDOS
            </h2>
          </div>
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#F3EAD3] text-[#171717]/80">
            Agudos, SP
          </span>
        </div>

        {errorMessage && (
          <div className="mt-2 p-3 bg-red-50 border-2 border-red-400 text-red-800 text-xs rounded-xl flex items-start gap-2 shadow-xs">
            <span className="material-symbols-outlined text-[18px] text-red-600 shrink-0 mt-0.5">
              error
            </span>
            <span className="font-semibold leading-relaxed">{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
          {/* 1. Photo Upload Card */}
          <section className="flex flex-col gap-1.5">
            <label className="text-[13px] font-bold text-[#171717] flex items-center justify-between">
              <span>
                Foto do problema <span className="text-red-500">*</span>
              </span>
              <span className="text-[11px] font-normal text-[#737373]">Máx. 10MB</span>
            </label>

            <div className="bg-white rounded-2xl p-3 border-2 border-dashed border-[#E3D9C3] shadow-xs flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-[#FFF9EB] flex items-center justify-center text-[#171717] shrink-0 border border-[#EADBBD]">
                  <span className="material-symbols-outlined text-[24px]">photo_camera</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-[#171717] leading-tight">
                    Adicione uma foto do problema em Agudos
                  </p>
                  <p className="text-[11px] text-[#737373] mt-0.5">
                    Ajuda na identificação rápida pelas equipes municipais
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="h-9 px-2 rounded-xl bg-[#FFF9EB] border border-[#E3D9C3] text-[#171717] text-xs font-semibold flex items-center justify-center gap-1.5 active:bg-[#F0E6D2] transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px] text-[#F47721]">
                    camera
                  </span>
                  Tirar foto agora
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="h-9 px-2 rounded-xl bg-[#FFF9EB] border border-[#E3D9C3] text-[#171717] text-xs font-semibold flex items-center justify-center gap-1.5 active:bg-[#F0E6D2] transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px] text-[#171717]">
                    add_photo_alternate
                  </span>
                  Escolher da galeria
                </button>
              </div>

              {/* Thumbnail Preview Item if photo added */}
              {hasPhoto ? (
                <div className="bg-[#FFF9EB]/70 rounded-xl p-2 border border-[#EBE1CB] flex items-center gap-2.5">
                  <div className="relative w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-neutral-200 border border-black/10">
                    <img
                      alt="Foto anexada"
                      className="w-full h-full object-cover"
                      src={photoUrl}
                    />
                    <span className="absolute bottom-0 right-0 bg-[#FFC928] text-[#171717] p-0.5 rounded-tl flex items-center justify-center">
                      <span className="material-symbols-outlined text-[10px] font-bold">check</span>
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-[#171717] truncate">{photoName}</p>
                    <p className="text-[11px] text-[#737373]">{photoSize} • Agudos, SP</p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      title="Substituir foto"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-8 h-8 rounded-lg bg-white border border-[#E2D8C3] text-[#171717] flex items-center justify-center active:scale-95 transition-transform cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px]">swap_horiz</span>
                    </button>
                    <button
                      type="button"
                      title="Remover foto"
                      onClick={() => {
                        soundFx.playTap();
                        setHasPhoto(false);
                        setPhotoUrl('');
                      }}
                      className="w-8 h-8 rounded-lg bg-white border border-red-200 text-red-500 flex items-center justify-center active:scale-95 transition-transform cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px]">delete</span>
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-amber-800 bg-amber-50 p-2 rounded-lg text-center font-medium">
                  Nenhuma imagem selecionada. Tire uma foto ou escolha um arquivo do dispositivo.
                </p>
              )}
            </div>
          </section>

          {/* 2. Category Selection */}
          <section className="flex flex-col gap-1.5">
            <label className="text-[13px] font-bold text-[#171717] flex items-center justify-between">
              <span>
                Selecione a categoria <span className="text-red-500">*</span>
              </span>
              <span className="text-[11px] text-[#737373] font-normal">Toque para selecionar</span>
            </label>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  soundFx.playTap();
                  setCategory('buraco');
                }}
                className={`col-span-1 h-12 px-3 rounded-xl flex items-center gap-2.5 font-semibold text-xs shadow-xs transition-all text-left cursor-pointer ${
                  category === 'buraco'
                    ? 'bg-[#FFC928] border-2 border-[#171717] text-[#171717]'
                    : 'bg-white border border-[#E4DBC5] text-[#171717]/80 hover:bg-neutral-50'
                }`}
              >
                <span className="material-symbols-outlined text-[20px] text-[#171717] shrink-0">
                  construction
                </span>
                <span className="truncate">Buraco na via</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  soundFx.playTap();
                  setCategory('sinalizacao');
                  setSubcategory('');
                  setSubcategoryLabel('');
                }}
                className={`col-span-1 h-12 px-3 rounded-xl flex items-center gap-2.5 font-semibold text-xs shadow-xs transition-all text-left cursor-pointer ${
                  category === 'sinalizacao'
                    ? 'bg-[#FFC928] border-2 border-[#171717] text-[#171717]'
                    : 'bg-white border border-[#E4DBC5] text-[#171717]/80 hover:bg-neutral-50'
                }`}
              >
                <span className="material-symbols-outlined text-[20px] text-[#F47721] shrink-0">
                  traffic
                </span>
                <span className="truncate">Sinalização</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  soundFx.playTap();
                  setCategory('bueiros');
                  setSubcategory('');
                  setSubcategoryLabel('');
                }}
                className={`col-span-1 h-12 px-3 rounded-xl flex items-center gap-2.5 font-semibold text-xs shadow-xs transition-all text-left cursor-pointer ${
                  category === 'bueiros'
                    ? 'bg-[#FFC928] border-2 border-[#171717] text-[#171717]'
                    : 'bg-white border border-[#E4DBC5] text-[#171717]/80 hover:bg-neutral-50'
                }`}
              >
                <span className="material-symbols-outlined text-[20px] text-blue-600 shrink-0">
                  water_damage
                </span>
                <span className="truncate">Bueiros</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  soundFx.playTap();
                  setCategory('lixo');
                }}
                className={`col-span-1 h-12 px-3 rounded-xl flex items-center gap-2.5 font-semibold text-xs shadow-xs transition-all text-left cursor-pointer ${
                  category === 'lixo'
                    ? 'bg-[#FFC928] border-2 border-[#171717] text-[#171717]'
                    : 'bg-white border border-[#E4DBC5] text-[#171717]/80 hover:bg-neutral-50'
                }`}
              >
                <span className="material-symbols-outlined text-[20px] text-[#171717]/70 shrink-0">
                  delete
                </span>
                <span className="truncate">Lixo / Entulho</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  soundFx.playTap();
                  setCategory('calcada');
                }}
                className={`col-span-1 h-12 px-3 rounded-xl flex items-center gap-2.5 font-semibold text-xs shadow-xs transition-all text-left cursor-pointer ${
                  category === 'calcada'
                    ? 'bg-[#FFC928] border-2 border-[#171717] text-[#171717]'
                    : 'bg-white border border-[#E4DBC5] text-[#171717]/80 hover:bg-neutral-50'
                }`}
              >
                <span className="material-symbols-outlined text-[20px] text-[#171717]/70 shrink-0">
                  accessible_forward
                </span>
                <span className="truncate">Calçada</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  soundFx.playTap();
                  setCategory('vazamento');
                }}
                className={`col-span-2 h-11 px-3 rounded-xl flex items-center justify-center gap-2 font-medium text-xs shadow-xs transition-all text-left cursor-pointer ${
                  category === 'vazamento'
                    ? 'bg-[#FFC928] border-2 border-[#171717] text-[#171717] font-semibold'
                    : 'bg-white border border-[#E4DBC5] text-[#171717]/80 hover:bg-neutral-50'
                }`}
              >
                <span className="material-symbols-outlined text-[19px] text-blue-500 shrink-0">
                  water_drop
                </span>
                <span>Vazamento de água ou esgoto</span>
              </button>
            </div>

            {category === 'sinalizacao' && (
              <div className="mt-2 bg-white rounded-2xl p-3.5 border border-[#E4DBC5] flex flex-col gap-2">
                <p className="text-xs font-bold text-[#171717]">
                  Qual problema de sinalização você deseja denunciar?
                </p>
                <div className="grid grid-cols-1 gap-1.5">
                  {[
                    { id: 'placas', label: 'Placas', desc: 'Placas de trânsito ausentes, danificadas, apagadas ou ilegíveis.', icon: 'signpost' },
                    { id: 'faixas_pedestre', label: 'Faixas de pedestre', desc: 'Faixas apagadas, desgastadas ou inexistentes.', icon: 'directions_walk' },
                    { id: 'semaforos', label: 'Semáforos', desc: 'Semáforos apagados, quebrados ou com funcionamento incorreto.', icon: 'traffic' },
                    { id: 'sinalizacao_solo', label: 'Sinalização de solo', desc: 'Linhas, setas e outras marcações de trânsito apagadas ou danificadas.', icon: 'edit_road' },
                    { id: 'sinalizacao_advertencia', label: 'Sinalização de advertência', desc: 'Ausência ou danos em placas e avisos de perigo.', icon: 'warning' },
                    { id: 'outros_sinalizacao', label: 'Outros', desc: 'Problemas de sinalização que não se encaixem nas opções anteriores.', icon: 'more_horiz' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        soundFx.playTap();
                        setSubcategory(opt.id);
                        setSubcategoryLabel(opt.label);
                      }}
                      className={`p-2.5 rounded-xl flex items-start gap-2.5 text-left transition-all cursor-pointer border ${
                        subcategory === opt.id
                          ? 'bg-[#FFC928]/25 border-[#171717]'
                          : 'bg-[#FFF9EB] border-[#E4DBC5]/70 hover:bg-[#FFC928]/10'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[18px] text-[#F47721] mt-0.5 shrink-0">{opt.icon}</span>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[#171717]">{opt.label}</p>
                        <p className="text-[11px] text-[#737373] leading-snug">{opt.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {category === 'bueiros' && (
              <div className="mt-2 bg-white rounded-2xl p-3.5 border border-[#E4DBC5] flex flex-col gap-2">
                <p className="text-xs font-bold text-[#171717]">
                  Qual problema você encontrou no bueiro?
                </p>
                <div className="grid grid-cols-1 gap-1.5">
                  {[
                    { id: 'bueiro_entupido', label: 'Bueiro entupido', desc: 'Água acumulada ou dificuldade de escoamento.', icon: 'water_damage' },
                    { id: 'tampa_danificada', label: 'Tampa danificada', desc: 'Tampa quebrada, solta ou danificada.', icon: 'broken_image' },
                    { id: 'bueiro_sem_tampa', label: 'Bueiro sem tampa', desc: 'Abertura exposta que oferece risco aos pedestres.', icon: 'dangerous' },
                    { id: 'mau_cheiro', label: 'Mau cheiro', desc: 'Odor desagradável vindo do bueiro.', icon: 'air' },
                    { id: 'alagamento', label: 'Alagamento', desc: 'Água acumulada ao redor do bueiro.', icon: 'flood' },
                    { id: 'outros_bueiros', label: 'Outros', desc: 'Problemas que não se encaixem nas opções anteriores.', icon: 'more_horiz' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        soundFx.playTap();
                        setSubcategory(opt.id);
                        setSubcategoryLabel(opt.label);
                      }}
                      className={`p-2.5 rounded-xl flex items-start gap-2.5 text-left transition-all cursor-pointer border ${
                        subcategory === opt.id
                          ? 'bg-[#FFC928]/25 border-[#171717]'
                          : 'bg-[#FFF9EB] border-[#E4DBC5]/70 hover:bg-[#FFC928]/10'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[18px] text-blue-600 mt-0.5 shrink-0">{opt.icon}</span>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[#171717]">{opt.label}</p>
                        <p className="text-[11px] text-[#737373] leading-snug">{opt.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* 3. Description Field */}
          <section className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="description" className="text-[13px] font-bold text-[#171717]">
                Descrição do problema <span className="text-red-500">*</span>
              </label>
              <span className="text-[11px] font-medium text-[#737373]">
                {description.length}/500
              </span>
            </div>
            <textarea
              id="description"
              rows={3}
              maxLength={500}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva o problema e detalhes da rua em Agudos..."
              className="w-full bg-white rounded-2xl p-3.5 border border-[#E4DBC5] text-[#171717] text-[13px] placeholder:text-[#737373]/60 leading-relaxed shadow-xs focus:border-[#171717] focus:ring-1 focus:ring-[#171717] outline-none resize-none transition-all"
            />
          </section>

          {/* 4. Location Card (Agudos Exclusive) */}
          <section className="flex flex-col gap-1.5">
            <label className="text-[13px] font-bold text-[#171717]">
              Localização em Agudos, SP
            </label>
            <div className="bg-white rounded-2xl p-3 border border-[#E4DBC5] shadow-xs flex flex-col gap-2.5">
              <div className="flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-full bg-[#FFC928]/25 flex items-center justify-center shrink-0 text-[#171717] mt-0.5">
                  <span className="material-symbols-outlined text-[19px] text-[#F47721]">
                    location_on
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-wide px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                      AGUDOS - SP
                    </span>
                    <span className="text-[11px] text-[#737373]">Área municipal validada</span>
                  </div>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full text-xs font-bold text-[#171717] mt-1 bg-transparent border-b border-[#171717]/15 focus:outline-none focus:border-[#F47721]"
                  />
                  <p className="text-[10px] text-[#8E8E93] mt-0.5">
                    Coordenadas: {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
                  </p>
                </div>
              </div>

              {/* Detect / Adjust location button */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleDetectGPS}
                  className="flex-1 h-8 rounded-lg bg-[#FFF9EB] border border-[#E3D9C3] text-[11px] font-bold text-[#171717] flex items-center justify-center gap-1 active:bg-[#F0E6D2] cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[15px] text-[#F47721]">
                    my_location
                  </span>
                  Obter GPS atual
                </button>
              </div>
            </div>
          </section>

          {/* 5. Urgent/Interdição Toggle */}
          <section className="bg-white rounded-2xl p-3 border border-[#E4DBC5] shadow-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-orange-100 flex items-center justify-center text-[#F47721] shrink-0">
                <span className="material-symbols-outlined text-[20px]">warning</span>
              </div>
              <div>
                <p className="text-xs font-bold text-[#171717] leading-tight">
                  Problema oferece risco iminente ou interdição de via?
                </p>
                <p className="text-[11px] text-[#737373] mt-0.5">
                  Sinaliza prioridade para as equipes de Agudos
                </p>
              </div>
            </div>

            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={isUrgent}
                onChange={(e) => {
                  soundFx.playTap();
                  setIsUrgent(e.target.checked);
                }}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-zinc-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#F47721]" />
            </label>
          </section>

          {/* 6. Submit Button & Guarantee Note */}
          <div className="pt-2 flex flex-col gap-2.5">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-12 bg-[#FFC928] text-[#171717] font-bold text-[15px] rounded-xl flex items-center justify-center gap-2 shadow-[0_4px_16px_rgba(255,201,40,0.5)] active:scale-[0.99] transition-all hover:brightness-105 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-[20px]">
                    progress_activity
                  </span>
                  <span>Enviando para Prefeitura de Agudos...</span>
                </>
              ) : (
                <>
                  <span>Enviar ocorrência</span>
                  <span className="material-symbols-outlined text-[19px]">arrow_forward</span>
                </>
              )}
            </button>

            <p className="text-[11px] text-center text-[#737373] flex items-center justify-center gap-1">
              <span className="material-symbols-outlined text-[14px] text-[#F47721]">
                verified
              </span>
              Ocorrência encaminhada diretamente à Prefeitura Municipal de Agudos.
            </p>
          </div>
        </form>
      </main>

      {/* Success Notification Modal */}
      {createdProtocol && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-[340px] bg-white rounded-3xl p-5 text-center shadow-2xl flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-[#FFC928]/30 flex items-center justify-center text-[#171717] mb-3">
              <span className="material-symbols-outlined text-[36px] text-[#171717]">
                check_circle
              </span>
            </div>
            <h3 className="text-lg font-bold text-[#171717]">Ocorrência Registrada!</h3>
            <div className="mt-1 px-3 py-1 bg-[#FFF9EB] rounded-lg border border-[#E5DBBE] text-xs font-mono font-bold text-[#171717]">
              Protocolo: #{createdProtocol}
            </div>
            <p className="text-xs text-[#737373] mt-2 leading-relaxed">
              Sua solicitação em <span className="font-semibold text-[#171717]">{address}</span> foi protocolada com sucesso e já está disponível para triagem da Prefeitura Municipal de Agudos.
            </p>
            <button
              onClick={() => {
                soundFx.playTap();
                setCreatedProtocol(null);
                onClose();
              }}
              className="w-full h-11 bg-[#171717] text-white font-bold text-xs rounded-xl mt-4 active:bg-neutral-800 transition-colors cursor-pointer"
            >
              Ver no Mapa / Concluir
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
