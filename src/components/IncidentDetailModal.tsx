import React, { useState } from 'react';
import { Incident, User } from '../types';
import { soundFx } from '../utils/audio';

interface IncidentDetailModalProps {
  incident: Incident | null;
  currentUser: User | null;
  onClose: () => void;
  onUpvote: (incidentId: string) => void;
  onUpdateStatus: (
    incidentId: string,
    newStatus: string,
    note: string,
    actionStep?: string,
    team?: string
  ) => Promise<void>;
}

export const IncidentDetailModal: React.FC<IncidentDetailModalProps> = ({
  incident,
  currentUser,
  onClose,
  onUpvote,
  onUpdateStatus,
}) => {
  if (!incident) return null;

  const [copiedLink, setCopiedLink] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState(incident.status);
  const [officialNote, setOfficialNote] = useState('');
  const [actionStep, setActionStep] = useState(incident.currentActionStep);
  const [assignedTeam, setAssignedTeam] = useState('Secretaria de Vias Públicas de Agudos');

  const hasUpvoted = currentUser ? incident.upvoters.includes(currentUser.email) : false;

  const handleShare = () => {
    soundFx.playTap();
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({
        title: `Reportaê Agudos - ${incident.title}`,
        text: `Acompanhe este chamado em Agudos, SP: #${incident.protocol}`,
        url,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleOpenExternalMaps = () => {
    soundFx.playTap();
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${incident.lat},${incident.lng}`;
    window.open(mapsUrl, '_blank', 'noopener,noreferrer');
  };

  const handleStatusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdating(true);
    try {
      await onUpdateStatus(
        incident.id,
        selectedStatus,
        officialNote || `Atualização de atendimento por ${currentUser?.name || 'Servidor Municipal de Agudos'}`,
        actionStep,
        assignedTeam
      );
      soundFx.playSuccess();
      setOfficialNote('');
    } catch (err) {
      console.error(err);
    } finally {
      setIsUpdating(false);
    }
  };

  const canManage = currentUser?.role === 'agente' || currentUser?.role === 'moderador' || currentUser?.role === 'proprietario';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex justify-center items-start p-0 sm:p-4 animate-in fade-in">
      <div className="bg-[#FFF9EB] w-full max-w-[480px] min-h-screen sm:min-h-0 sm:rounded-3xl overflow-hidden shadow-2xl flex flex-col pb-12 my-auto">
        {/* Header */}
        <div className="sticky top-0 z-30 bg-[#FFF9EB]/95 backdrop-blur-md px-4 h-14 border-b border-[#171717]/10 flex items-center justify-between">
          <button
            onClick={() => {
              soundFx.playTap();
              onClose();
            }}
            className="w-10 h-10 -ml-2 flex items-center justify-center rounded-full text-[#171717] hover:bg-black/5 active:bg-black/10 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[24px]">arrow_back</span>
          </button>

          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#F47721] animate-pulse" />
            <span className="text-[13px] font-bold text-[#171717] tracking-tight">
              Protocolo #{incident.protocol}
            </span>
          </div>

          <button
            onClick={handleShare}
            title="Compartilhar chamado"
            className="w-10 h-10 -mr-2 flex items-center justify-center rounded-full text-[#171717] hover:bg-black/5 active:scale-95 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">
              {copiedLink ? 'done' : 'share'}
            </span>
          </button>
        </div>

        {/* Hazard Band if urgent */}
        {incident.isUrgent && (
          <div className="w-full h-2 hazard-stripe" />
        )}

        {/* Photo view */}
        <div className="relative w-full h-64 bg-neutral-900 flex items-center justify-center">
          {incident.photoUrl ? (
            <img
              alt={incident.title}
              src={incident.photoUrl}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-gray-400">
              <span className="material-symbols-outlined text-[48px]">image</span>
              <span className="text-xs mt-1">Foto da ocorrência</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 pointer-events-none" />

          <div className="absolute top-3 left-3 flex flex-wrap gap-2">
            <span className="px-2.5 py-1 rounded-full bg-[#171717]/85 backdrop-blur-md text-white text-[11px] font-bold flex items-center gap-1 shadow-sm">
              <span className="material-symbols-outlined text-[14px] text-[#FFC928]">
                {incident.icon}
              </span>
              <span>{incident.categoryLabel}</span>
            </span>

            {incident.isUrgent && (
              <span className="px-2.5 py-1 rounded-full bg-[#B91C1C] text-white text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1 shadow-sm">
                <span className="material-symbols-outlined text-[13px]">warning</span>
                INTERDITADO
              </span>
            )}
          </div>

          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white">
            <span className="text-xs bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-lg">
              Registrado por {incident.userName}
            </span>
            <span className="text-xs bg-[#FFC928] text-[#171717] px-2.5 py-1 rounded-lg font-bold">
              {incident.statusLabel}
            </span>
          </div>
        </div>

        {/* Content body */}
        <div className="p-4 flex flex-col gap-4">
          <div className="bg-white rounded-2xl p-4 border border-[#171717]/8 shadow-xs">
            <h2 className="text-[17px] font-bold text-[#171717] leading-tight">
              {incident.title}
            </h2>
            <p className="text-[13px] text-[#525252] leading-relaxed mt-2 whitespace-pre-wrap">
              {incident.description}
            </p>

            <div className="flex items-center justify-between mt-4 pt-3 border-t border-[#171717]/5">
              <button
                onClick={() => {
                  soundFx.playUpvote();
                  onUpvote(incident.id);
                }}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  hasUpvoted
                    ? 'bg-[#FFC928] text-[#171717] shadow-xs'
                    : 'bg-[#FFF9EB] text-[#171717] hover:bg-[#FFC928]/30 border border-[#FFC928]/30'
                }`}
              >
                <span className="material-symbols-outlined text-[18px] text-[#F47721]">
                  thumb_up
                </span>
                <span>{incident.upvotesCount} {incident.upvotesCount === 1 ? 'apoio' : 'apoios'} em Agudos</span>
              </button>

              <button
                onClick={handleShare}
                className="text-xs text-[#737373] hover:text-[#171717] font-semibold flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[16px]">share</span>
                <span>{copiedLink ? 'Link copiado!' : 'Compartilhar'}</span>
              </button>
            </div>
          </div>

          {/* Location details card in Agudos */}
          <div className="bg-white rounded-2xl p-4 border border-[#171717]/8 shadow-xs flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#171717] uppercase tracking-wide">
                Localização em Agudos, SP
              </span>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-extrabold px-1.5 py-0.5 rounded">
                MUNICÍPIO VALIDADO
              </span>
            </div>

            <div className="flex items-start gap-2.5">
              <span className="material-symbols-outlined text-[#F47721] text-[20px] shrink-0 mt-0.5">
                location_on
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-[#171717]">{incident.address}</p>
                <p className="text-xs text-[#737373] mt-0.5">
                  Bairro {incident.neighborhood} • Agudos, SP
                </p>
                <p className="text-[11px] text-[#8E8E93] mt-0.5 font-mono">
                  Coord: {incident.lat.toFixed(4)}, {incident.lng.toFixed(4)}
                </p>
              </div>
            </div>

            <button
              onClick={handleOpenExternalMaps}
              className="mt-2 w-full h-10 rounded-xl bg-[#FFF9EB] hover:bg-[#FFC928]/25 text-[#171717] font-bold text-xs flex items-center justify-center gap-1.5 border border-[#171717]/10 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px] text-[#F47721]">
                map
              </span>
              <span>Abrir no Google Maps / Waze</span>
              <span className="material-symbols-outlined text-[14px]">open_in_new</span>
            </button>
          </div>

          {/* Next action step */}
          <div className="bg-amber-50 rounded-2xl p-4 border border-[#FFC928]/40 shadow-xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FFC928] text-[#171717] flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[20px]">
                {incident.actionIcon || 'engineering'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#F47721]">
                Etapa Operacional
              </span>
              <p className="text-xs font-bold text-[#171717] mt-0.5">
                {incident.currentActionStep}
              </p>
            </div>
          </div>

          {/* Status Timeline History */}
          <div className="bg-white rounded-2xl p-4 border border-[#171717]/8 shadow-xs flex flex-col gap-3">
            <h3 className="text-xs font-bold text-[#171717] uppercase tracking-wide">
              Histórico de Andamento Oficial
            </h3>

            <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#EAE4D5]">
              {incident.statusHistory.map((hist, idx) => (
                <div key={idx} className="relative">
                  <div className="absolute -left-6 top-1 w-4 h-4 rounded-full bg-[#FFC928] border-2 border-white shadow-xs" />
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#171717] capitalize">
                      {hist.status.replace('_', ' ')}
                    </span>
                    <span className="text-[10px] text-[#737373]">{hist.date}</span>
                  </div>
                  <p className="text-[11px] text-[#8E8E93] font-medium">{hist.author}</p>
                  <p className="text-xs text-[#525252] mt-1 leading-relaxed bg-[#FFF9EB]/60 p-2 rounded-lg border border-[#171717]/5">
                    {hist.note}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Special Agent / Administrator Management Console in Agudos */}
          {canManage && (
            <div className="bg-[#171717] text-white rounded-2xl p-4 shadow-lg border border-[#FFC928]/30 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#FFC928] text-[20px]">
                    admin_panel_settings
                  </span>
                  <h3 className="text-xs font-bold text-[#FFC928] uppercase tracking-wider">
                    Gestão Municipal • Agudos, SP
                  </h3>
                </div>
                <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded text-gray-300">
                  Acesso Autorizado
                </span>
              </div>

              <form onSubmit={handleStatusSubmit} className="flex flex-col gap-3 mt-1">
                <div>
                  <label className="text-[11px] font-semibold text-gray-300 block mb-1">
                    Alterar Status Oficial:
                  </label>
                  <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value as any)}
                    className="w-full bg-[#262626] border border-white/20 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FFC928]"
                  >
                    <option value="recebida">Recebida</option>
                    <option value="triagem">Em triagem técnica</option>
                    <option value="andamento">Em andamento (Equipe em campo)</option>
                    <option value="aguardando_material">Aguardando material / equipamento</option>
                    <option value="resolvida">Resolvida / Reparada</option>
                    <option value="indeferida">Indeferida (Fora de competência / Inexistente)</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-semibold text-gray-300 block mb-1">
                      Órgão / Setor Responsável:
                    </label>
                    <select
                      value={assignedTeam}
                      onChange={(e) => setAssignedTeam(e.target.value)}
                      className="w-full bg-[#262626] border border-white/20 rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none"
                    >
                      <option value="Secretaria de Vias Públicas de Agudos">Secretaria de Vias Públicas</option>
                      <option value="Setor de Iluminação Pública de Agudos">Setor de Iluminação</option>
                      <option value="Defesa Civil de Agudos">Defesa Civil de Agudos</option>
                      <option value="DAE - Água e Esgoto de Agudos">DAE - Água e Esgoto</option>
                      <option value="Prefeitura Municipal de Agudos">Gabinete da Prefeitura</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-gray-300 block mb-1">
                      Etapa Operacional:
                    </label>
                    <input
                      type="text"
                      value={actionStep}
                      onChange={(e) => setActionStep(e.target.value)}
                      placeholder="Ex: Equipe de recapeamento despachada"
                      className="w-full bg-[#262626] border border-white/20 rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-gray-300 block mb-1">
                    Nota Técnica / Despacho:
                  </label>
                  <textarea
                    rows={2}
                    value={officialNote}
                    onChange={(e) => setOfficialNote(e.target.value)}
                    placeholder="Adicione observações para o histórico público do cidadão..."
                    className="w-full bg-[#262626] border border-white/20 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-[#FFC928]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isUpdating}
                  className="w-full h-10 bg-[#FFC928] text-[#171717] font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 active:scale-98 transition-transform hover:brightness-105 cursor-pointer disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[16px]">save</span>
                  <span>{isUpdating ? 'Gravando alteração...' : 'Salvar Atualização Oficial'}</span>
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
