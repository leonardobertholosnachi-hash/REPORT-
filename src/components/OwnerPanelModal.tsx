import React, { useEffect, useState } from 'react';
import { AuditLogItem, InviteCodeSummary, RoleChangeRequest, User, UserRole } from '../types';
import { soundFx } from '../utils/audio';

interface OwnerPanelModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  onUserUpdated?: () => void;
}

type OwnerTab = 'visao_geral' | 'solicitacoes' | 'usuarios' | 'cargos' | 'convites' | 'auditoria' | 'configuracoes';

interface OverviewStats {
  totalUsers: number;
  citizensCount: number;
  agentsCount: number;
  moderatorsCount: number;
  pendingRequestsCount: number;
  totalIncidents: number;
}

export const OwnerPanelModal: React.FC<OwnerPanelModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onUserUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<OwnerTab>('visao_geral');
  const [overview, setOverview] = useState<OverviewStats | null>(null);
  const [usersList, setUsersList] = useState<User[]>([]);
  const [invitesList, setInvitesList] = useState<InviteCodeSummary[]>([]);
  const [roleRequests, setRoleRequests] = useState<RoleChangeRequest[]>([]);
  const [requestStatusFilter, setRequestStatusFilter] = useState<'PENDENTE' | 'APROVADA' | 'REJEITADA' | 'TODAS'>('PENDENTE');
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Owner 2-step password verification
  const [ownerPassword, setOwnerPassword] = useState('');
  const [verifyingPassword, setVerifyingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'todos' | UserRole>('todos');

  // Invite creation state
  const [targetRole, setTargetRole] = useState<'agente' | 'moderador'>('agente');
  const [maxUses, setMaxUses] = useState<number>(1);
  const [expiresInDays, setExpiresInDays] = useState<number>(7);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Confirmation modal for role change
  const [pendingRoleChange, setPendingRoleChange] = useState<{
    user: User;
    newRole: 'cidadao' | 'agente' | 'moderador';
  } | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (isOpen && currentUser.role === 'proprietario' && currentUser.ownerVerified) {
      loadAllOwnerData();
    }
  }, [isOpen, currentUser.role, currentUser.ownerVerified]);

  if (!isOpen || currentUser.role !== 'proprietario') return null;

  const loadAllOwnerData = async () => {
    setLoading(true);
    try {
      const [oRes, uRes, iRes, rRes, aRes] = await Promise.all([
        fetch('/api/owner/overview'),
        fetch('/api/owner/users'),
        fetch('/api/owner/invites'),
        fetch('/api/owner/role-requests'),
        fetch('/api/owner/audit'),
      ]);
      const [oJson, uJson, iJson, rJson, aJson] = await Promise.all([
        oRes.json(),
        uRes.json(),
        iRes.json(),
        rRes.json(),
        aRes.json(),
      ]);
      if (oJson.success) setOverview(oJson.data);
      if (uJson.success) setUsersList(uJson.data);
      if (iJson.success) setInvitesList(iJson.data);
      if (rJson.success) setRoleRequests(rJson.data);
      if (aJson.success) setAuditLogs(aJson.data);
    } catch (err) {
      console.error('Erro ao carregar dados do proprietário:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOwnerPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setVerifyingPassword(true);
    try {
      const res = await fetch('/api/owner/verify-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: ownerPassword }),
      });
      const json = await res.json();
      if (json.success) {
        soundFx.playSuccess();
        setOwnerPassword('');
        if (onUserUpdated) onUserUpdated();
      } else {
        setPasswordError(json.error || 'Senha incorreta.');
      }
    } catch {
      setPasswordError('Erro de conexão ao verificar senha.');
    } finally {
      setVerifyingPassword(false);
    }
  };

  const handleApproveRequest = async (id: string) => {
    soundFx.playTap();
    try {
      const res = await fetch(`/api/owner/role-requests/${id}/approve`, { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        soundFx.playSuccess();
        setFeedbackMsg({ type: 'success', text: 'Solicitação aprovada e cargo atualizado!' });
        await loadAllOwnerData();
        if (onUserUpdated) onUserUpdated();
      } else {
        setFeedbackMsg({ type: 'error', text: json.error || 'Erro ao aprovar.' });
      }
    } catch {
      setFeedbackMsg({ type: 'error', text: 'Erro de conexão.' });
    }
  };

  const handleRejectRequest = async (id: string) => {
    soundFx.playTap();
    try {
      const res = await fetch(`/api/owner/role-requests/${id}/reject`, { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        soundFx.playNotification();
        setFeedbackMsg({ type: 'success', text: 'Solicitação rejeitada.' });
        await loadAllOwnerData();
      } else {
        setFeedbackMsg({ type: 'error', text: json.error || 'Erro ao rejeitar.' });
      }
    } catch {
      setFeedbackMsg({ type: 'error', text: 'Erro de conexão.' });
    }
  };

  const handleGenerateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    setFeedbackMsg(null);
    try {
      const res = await fetch('/api/owner/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetRole, maxUses, expiresInDays }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        soundFx.playSuccess();
        setGeneratedCode(json.data.plaintextCode);
        setCopiedCode(false);
        await loadAllOwnerData();
      } else {
        setFeedbackMsg({ type: 'error', text: json.error || 'Erro ao gerar código.' });
      }
    } catch (err) {
      setFeedbackMsg({ type: 'error', text: 'Erro de conexão ao gerar código.' });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRevokeInvite = async (inviteId: string) => {
    soundFx.playTap();
    try {
      const res = await fetch(`/api/owner/invites/${inviteId}/revoke`, {
        method: 'POST',
      });
      const json = await res.json();
      if (json.success) {
        soundFx.playNotification();
        await loadAllOwnerData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleConfirmRoleChange = async () => {
    if (!pendingRoleChange) return;
    soundFx.playTap();
    try {
      const res = await fetch(`/api/owner/users/${pendingRoleChange.user.id}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: pendingRoleChange.newRole }),
      });
      const json = await res.json();
      if (json.success) {
        soundFx.playSuccess();
        setFeedbackMsg({
          type: 'success',
          text: `Cargo de ${pendingRoleChange.user.name} atualizado para ${pendingRoleChange.newRole.toUpperCase()}.`,
        });
        setPendingRoleChange(null);
        await loadAllOwnerData();
        if (onUserUpdated) onUserUpdated();
      } else {
        setFeedbackMsg({ type: 'error', text: json.error || 'Erro ao alterar cargo.' });
        setPendingRoleChange(null);
      }
    } catch (err) {
      setFeedbackMsg({ type: 'error', text: 'Erro de conexão.' });
      setPendingRoleChange(null);
    }
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'proprietario':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-[#171717] text-[#FFC928] border border-[#FFC928]">
            Proprietário
          </span>
        );
      case 'moderador':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-[#FFF4E5] text-[#F47721] border border-[#F47721]/40">
            Moderador
          </span>
        );
      case 'agente':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-blue-50 text-blue-700 border border-blue-200">
            Agente
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-neutral-100 text-neutral-700 border border-neutral-200">
            Cidadão
          </span>
        );
    }
  };

  const filteredUsers = usersList.filter((u) => {
    if (roleFilter !== 'todos' && u.role !== roleFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#FFF9EB] flex flex-col antialiased">
      {/* Header */}
      <header className="sticky top-0 inset-x-0 z-40 bg-[#171717] text-white border-b border-[#FFC928]/30 pt-safe">
        <div className="w-full max-w-[540px] mx-auto h-14 px-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#FFC928] text-[#171717] flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">shield_person</span>
            </div>
            <div>
              <h2 className="text-sm font-bold text-white leading-tight">
                Gerenciamento do Sistema
              </h2>
              <p className="text-[10px] text-[#FFC928] font-semibold">
                Painel Exclusivo do Proprietário
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              soundFx.playTap();
              onClose();
            }}
            className="w-9 h-9 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="w-full max-w-[540px] mx-auto px-4 pb-2.5 flex gap-1.5 overflow-x-auto no-scrollbar">
          {(
            [
              { id: 'visao_geral', label: 'Visão geral', icon: 'dashboard' },
              { id: 'solicitacoes', label: 'Autorizações pendentes', icon: 'assignment_ind' },
              { id: 'usuarios', label: 'Usuários', icon: 'group' },
              { id: 'cargos', label: 'Cargos e permissões', icon: 'manage_accounts' },
              { id: 'auditoria', label: 'Histórico', icon: 'history' },
              { id: 'configuracoes', label: 'Configurações', icon: 'settings' },
            ] as { id: OwnerTab; label: string; icon: string }[]
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                soundFx.playTap();
                setActiveTab(tab.id);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-[#FFC928] text-[#171717]'
                  : 'bg-white/10 text-gray-300 hover:bg-white/20'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-[540px] mx-auto px-4 py-4 pb-20 flex flex-col gap-4">
        {feedbackMsg && (
          <div
            className={`p-3 rounded-2xl text-xs font-semibold flex items-center justify-between border ${
              feedbackMsg.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-red-50 text-red-800 border-red-200'
            }`}
          >
            <span>{feedbackMsg.text}</span>
            <button onClick={() => setFeedbackMsg(null)}>
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>
        )}

        {!currentUser.ownerVerified ? (
          <form
            onSubmit={handleVerifyOwnerPassword}
            className="bg-white rounded-2xl p-5 border border-[#171717]/10 shadow-xs flex flex-col gap-3 mt-4"
          >
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-[#171717] text-[#FFC928] flex items-center justify-center">
                <span className="material-symbols-outlined text-[20px]">lock</span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#171717]">Verificação em Duas Etapas</h3>
                <p className="text-[11px] text-[#737373]">
                  Confirme a senha exclusiva do proprietário para acessar o painel.
                </p>
              </div>
            </div>

            <input
              type="password"
              value={ownerPassword}
              onChange={(e) => setOwnerPassword(e.target.value)}
              placeholder="Senha exclusiva do proprietário"
              required
              className="w-full bg-[#FFF9EB] border border-[#171717]/15 rounded-xl px-3 h-11 text-sm text-[#171717] focus:outline-none focus:border-[#FFC928]"
            />

            {passwordError && (
              <p className="text-xs font-semibold text-red-600">{passwordError}</p>
            )}

            <button
              type="submit"
              disabled={verifyingPassword}
              className="w-full h-11 rounded-xl bg-[#171717] text-[#FFC928] font-bold text-sm hover:bg-black transition-colors disabled:opacity-60 cursor-pointer"
            >
              {verifyingPassword ? 'Verificando...' : 'Desbloquear Painel'}
            </button>
          </form>
        ) : (
          <>
            {loading && (
              <div className="py-6 text-center text-xs text-[#737373]">
                Sincronizando dados do sistema...
              </div>
            )}

        {/* TAB: VISÃO GERAL */}
        {activeTab === 'visao_geral' && (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-2.5">
              <div className="bg-white rounded-2xl p-3.5 border border-[#171717]/8 shadow-xs">
                <p className="text-[11px] font-bold text-[#737373] uppercase">Total de Usuários</p>
                <p className="text-2xl font-extrabold text-[#171717] mt-1">{overview?.totalUsers ?? 0}</p>
              </div>
              <div className="bg-white rounded-2xl p-3.5 border border-[#171717]/8 shadow-xs">
                <p className="text-[11px] font-bold text-[#737373] uppercase">Denúncias Registradas</p>
                <p className="text-2xl font-extrabold text-[#F47721] mt-1">{overview?.totalIncidents ?? 0}</p>
              </div>
              <div className="bg-white rounded-2xl p-3.5 border border-[#171717]/8 shadow-xs">
                <p className="text-[11px] font-bold text-[#737373] uppercase">Cidadãos</p>
                <p className="text-xl font-extrabold text-[#171717] mt-1">{overview?.citizensCount ?? 0}</p>
              </div>
              <div className="bg-white rounded-2xl p-3.5 border border-[#171717]/8 shadow-xs">
                <p className="text-[11px] font-bold text-[#737373] uppercase">Agentes</p>
                <p className="text-xl font-extrabold text-blue-700 mt-1">{overview?.agentsCount ?? 0}</p>
              </div>
              <div className="bg-white rounded-2xl p-3.5 border border-[#171717]/8 shadow-xs">
                <p className="text-[11px] font-bold text-[#737373] uppercase">Moderadores</p>
                <p className="text-xl font-extrabold text-[#F47721] mt-1">{overview?.moderatorsCount ?? 0}</p>
              </div>
              <div className="bg-white rounded-2xl p-3.5 border border-[#FFC928] shadow-xs">
                <p className="text-[11px] font-bold text-[#737373] uppercase">Autorizações Pendentes</p>
                <p className="text-xl font-extrabold text-[#171717] mt-1">{overview?.pendingRequestsCount ?? 0}</p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 1: USUÁRIOS */}
        {activeTab === 'usuarios' && (
          <div className="flex flex-col gap-3">
            <div className="bg-white rounded-2xl p-3 border border-[#171717]/10 shadow-xs flex flex-col gap-2.5">
              <div className="flex items-center gap-2 bg-[#FFF9EB] rounded-xl px-3 h-10 border border-[#171717]/10">
                <span className="material-symbols-outlined text-[#737373] text-[18px]">search</span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Pesquisar por nome ou e-mail..."
                  className="w-full bg-transparent text-xs text-[#171717] focus:outline-none"
                />
              </div>

              <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
                {(['todos', 'proprietario', 'moderador', 'agente', 'cidadao'] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => {
                      soundFx.playTap();
                      setRoleFilter(r);
                    }}
                    className={`px-3 py-1 rounded-full text-[11px] font-bold capitalize cursor-pointer ${
                      roleFilter === r
                        ? 'bg-[#171717] text-white'
                        : 'bg-[#FFF9EB] text-[#171717] border border-[#171717]/10'
                    }`}
                  >
                    {r === 'todos' ? `Todos (${usersList.length})` : r}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              {filteredUsers.map((u) => (
                <div
                  key={u.id}
                  className="bg-white rounded-2xl p-3.5 border border-[#171717]/8 shadow-xs flex flex-col gap-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-[#171717] truncate">{u.name}</p>
                      <p className="text-xs text-[#737373] truncate">{u.email}</p>
                    </div>
                    {getRoleBadge(u.role)}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#737373] pt-1 border-t border-[#171717]/5">
                    <span>Org: {u.organization || 'Prefeitura de Agudos'}</span>
                    <span>•</span>
                    <span>Status: {u.status || 'ativo'}</span>
                    <span>•</span>
                    <span>Cadastro: {new Date(u.createdAt).toLocaleDateString('pt-BR')}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 2: GERENCIAR CARGOS */}
        {activeTab === 'cargos' && (
          <div className="flex flex-col gap-3">
            <div className="bg-amber-50 border border-[#FFC928] rounded-2xl p-3 text-xs text-[#171717]">
              <strong>Controle Hierárquico:</strong> Promova cidadãos a agentes, agentes a administradores ou revogue permissões. O cargo de Proprietário é exclusivo e protegido.
            </div>

            {usersList.map((u) => (
              <div
                key={u.id}
                className="bg-white rounded-2xl p-3.5 border border-[#171717]/8 shadow-xs flex flex-col gap-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[#171717] truncate">{u.name}</p>
                    <p className="text-xs text-[#737373] truncate">{u.email}</p>
                  </div>
                  {getRoleBadge(u.role)}
                </div>

                {u.role !== 'proprietario' ? (
                  <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-[#171717]/5">
                    <button
                      disabled={u.role === 'cidadao'}
                      onClick={() => setPendingRoleChange({ user: u, newRole: 'cidadao' })}
                      className="py-1.5 px-2 rounded-xl text-[11px] font-bold border border-[#171717]/10 bg-[#FFF9EB] text-[#171717] disabled:opacity-40 cursor-pointer"
                    >
                      Cidadão
                    </button>
                    <button
                      disabled={u.role === 'agente'}
                      onClick={() => setPendingRoleChange({ user: u, newRole: 'agente' })}
                      className="py-1.5 px-2 rounded-xl text-[11px] font-bold border border-blue-200 bg-blue-50 text-blue-700 disabled:opacity-40 cursor-pointer"
                    >
                      Agente
                    </button>
                    <button
                      disabled={u.role === 'moderador'}
                      onClick={() => setPendingRoleChange({ user: u, newRole: 'moderador' })}
                      className="py-1.5 px-2 rounded-xl text-[11px] font-bold border border-[#F47721]/30 bg-[#FFF4E5] text-[#F47721] disabled:opacity-40 cursor-pointer"
                    >
                      Moderador
                    </button>
                  </div>
                ) : (
                  <p className="text-[11px] text-[#737373] italic pt-1 border-t border-[#171717]/5">
                    Conta protegida do Proprietário do Sistema.
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* TAB: SOLICITAÇÕES DE CARGOS */}
        {activeTab === 'solicitacoes' && (
          <div className="flex flex-col gap-3">
            {roleRequests.length === 0 ? (
              <div className="bg-white rounded-2xl p-6 text-center border border-[#171717]/8 text-xs text-[#737373]">
                Nenhuma solicitação de mudança de cargo registrada.
              </div>
            ) : (
              roleRequests.map((req) => (
                <div
                  key={req.id}
                  className="bg-white rounded-2xl p-3.5 border border-[#171717]/8 shadow-xs flex flex-col gap-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-[#171717] truncate">{req.userName}</p>
                      <p className="text-xs text-[#737373] truncate">{req.userEmail}</p>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                        req.status === 'PENDENTE'
                          ? 'bg-amber-100 text-amber-800'
                          : req.status === 'APROVADA'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {req.status}
                    </span>
                  </div>

                  <p className="text-xs text-[#171717]">
                    Solicita: <strong className="uppercase">{req.requestedRole}</strong> (atual: {req.currentRole.toUpperCase()})
                  </p>
                  <p className="text-xs text-[#737373] bg-[#FFF9EB] p-2.5 rounded-xl border border-[#171717]/5">
                    "{req.reason}"
                  </p>

                  {req.status === 'PENDENTE' && (
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        onClick={() => handleApproveRequest(req.id)}
                        className="py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 cursor-pointer"
                      >
                        Aprovar
                      </button>
                      <button
                        onClick={() => handleRejectRequest(req.id)}
                        className="py-2 rounded-xl bg-red-50 text-red-700 border border-red-200 text-xs font-bold hover:bg-red-100 cursor-pointer"
                      >
                        Rejeitar
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB 3: CONVITES */}
        {activeTab === 'convites' && (
          <div className="flex flex-col gap-4">
            <form
              onSubmit={handleGenerateInvite}
              className="bg-white rounded-2xl p-4 border border-[#171717]/10 shadow-xs flex flex-col gap-3"
            >
              <h3 className="text-sm font-bold text-[#171717] flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[#F47721] text-[20px]">add_moderator</span>
                Gerar código de convite
              </h3>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11px] font-bold text-[#171717] block mb-1">
                    Cargo concedido
                  </label>
                  <select
                    value={targetRole}
                    onChange={(e) => setTargetRole(e.target.value as 'agente' | 'moderador')}
                    className="w-full bg-[#FFF9EB] border border-[#171717]/15 rounded-xl px-2.5 py-2 text-xs font-semibold text-[#171717]"
                  >
                    <option value="agente">Agente Público</option>
                    <option value="moderador">Moderador</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-[#171717] block mb-1">
                    Limite de utilizações
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={maxUses}
                    onChange={(e) => setMaxUses(Number(e.target.value))}
                    className="w-full bg-[#FFF9EB] border border-[#171717]/15 rounded-xl px-2.5 py-2 text-xs font-semibold text-[#171717]"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-[#171717] block mb-1">
                  Validade (em dias)
                </label>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={expiresInDays}
                  onChange={(e) => setExpiresInDays(Number(e.target.value))}
                  className="w-full bg-[#FFF9EB] border border-[#171717]/15 rounded-xl px-2.5 py-2 text-xs font-semibold text-[#171717]"
                />
              </div>

              <button
                type="submit"
                disabled={isGenerating}
                className="w-full h-11 bg-[#FFC928] text-[#171717] font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-xs hover:brightness-105 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">vpn_key</span>
                <span>{isGenerating ? 'Gerando...' : 'Gerar código seguro'}</span>
              </button>

              {generatedCode && (
                <div className="mt-2 p-3 bg-[#171717] text-white rounded-2xl flex flex-col gap-2">
                  <span className="text-[10px] text-[#FFC928] font-bold uppercase tracking-wider">
                    Código gerado (copie agora — não será exibido novamente):
                  </span>
                  <div className="flex items-center justify-between gap-2 bg-white/10 px-3 py-2 rounded-xl">
                    <code className="text-sm font-mono font-bold tracking-wider text-white">
                      {generatedCode}
                    </code>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(generatedCode);
                        setCopiedCode(true);
                        soundFx.playTap();
                      }}
                      className="px-2.5 py-1 bg-[#FFC928] text-[#171717] rounded-lg text-[11px] font-bold cursor-pointer"
                    >
                      {copiedCode ? 'Copiado!' : 'Copiar'}
                    </button>
                  </div>
                </div>
              )}
            </form>

            {/* List of existing invites */}
            <div className="flex flex-col gap-2.5">
              <h4 className="text-xs font-bold text-[#171717] uppercase tracking-wider">
                Códigos Registrados ({invitesList.length})
              </h4>

              {invitesList.length === 0 ? (
                <div className="bg-white rounded-2xl p-5 text-center text-xs text-[#737373] border border-[#171717]/8">
                  Nenhum código de convite gerado ainda.
                </div>
              ) : (
                invitesList.map((inv) => {
                  const isExpired = new Date(inv.expiresAt).getTime() <= Date.now();
                  const isExhausted = inv.usedCount >= inv.maxUses;
                  const isActive = !inv.revoked && !isExpired && !isExhausted;

                  return (
                    <div
                      key={inv.id}
                      className="bg-white rounded-2xl p-3.5 border border-[#171717]/8 shadow-xs flex flex-col gap-2"
                    >
                      <div className="flex items-center justify-between">
                        <code className="text-xs font-mono font-bold text-[#171717]">
                          {inv.codePreview}
                        </code>
                        <div className="flex items-center gap-1.5">
                          {getRoleBadge(inv.targetRole)}
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              isActive
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {inv.revoked
                              ? 'Revogado'
                              : isExpired
                              ? 'Expirado'
                              : isExhausted
                              ? 'Esgotado'
                              : 'Ativo'}
                          </span>
                        </div>
                      </div>

                      <div className="text-[11px] text-[#737373] flex flex-wrap gap-x-3">
                        <span>
                          Usos: <strong>{inv.usedCount}/{inv.maxUses}</strong>
                        </span>
                        <span>•</span>
                        <span>Expira: {new Date(inv.expiresAt).toLocaleDateString('pt-BR')}</span>
                      </div>

                      {inv.usedBy.length > 0 && (
                        <div className="text-[11px] bg-[#FFF9EB] p-2 rounded-xl border border-[#171717]/5">
                          <span className="font-bold text-[#171717]">Utilizado por: </span>
                          {inv.usedBy.map((u) => u.email).join(', ')}
                        </div>
                      )}

                      {isActive && (
                        <button
                          onClick={() => handleRevokeInvite(inv.id)}
                          className="self-end px-3 py-1 rounded-lg bg-red-50 text-red-600 font-bold text-[11px] hover:bg-red-100 cursor-pointer"
                        >
                          Revogar código
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* TAB 4: AUDITORIA */}
        {activeTab === 'auditoria' && (
          <div className="flex flex-col gap-2.5">
            <h4 className="text-xs font-bold text-[#171717] uppercase tracking-wider">
              Histórico de Atividades ({auditLogs.length})
            </h4>

            {auditLogs.length === 0 ? (
              <div className="bg-white rounded-2xl p-5 text-center text-xs text-[#737373] border border-[#171717]/8">
                Nenhuma atividade registrada até o momento.
              </div>
            ) : (
              auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="bg-white rounded-2xl p-3.5 border border-[#171717]/8 shadow-xs flex flex-col gap-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#F47721]">
                      {log.action}
                    </span>
                    <span className="text-[10px] text-[#737373]">
                      {new Date(log.createdAt).toLocaleString('pt-BR')}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-[#171717]">{log.details}</p>
                  <p className="text-[11px] text-[#737373]">
                    Responsável: {log.actorName} ({log.actorEmail})
                  </p>
                </div>
              ))
            )}
          </div>
        )}
        {/* TAB: CONFIGURAÇÕES */}
        {activeTab === 'configuracoes' && (
          <div className="flex flex-col gap-3">
            <div className="bg-white rounded-2xl p-4 border border-[#171717]/10 shadow-xs flex flex-col gap-2">
              <h4 className="text-xs font-extrabold uppercase text-[#171717]">Conta Proprietária</h4>
              <p className="text-xs text-[#171717]"><strong>Nome:</strong> {currentUser.name}</p>
              <p className="text-xs text-[#171717]"><strong>E-mail:</strong> {currentUser.email}</p>
              <p className="text-xs text-[#171717]"><strong>Cargo:</strong> PROPRIETÁRIO DO SISTEMA</p>
            </div>
            <div className="bg-white rounded-2xl p-4 border border-[#171717]/10 shadow-xs flex flex-col gap-2">
              <h4 className="text-xs font-extrabold uppercase text-[#171717]">Segurança e Autenticação</h4>
              <p className="text-xs text-emerald-700 font-semibold">✓ Verificação em duas etapas ativa</p>
              <p className="text-xs text-emerald-700 font-semibold">✓ Autenticação validada no backend</p>
              <p className="text-[11px] text-[#737373]">
                O cargo de Proprietário é exclusivo e protegido contra alterações ou transferências.
              </p>
            </div>
            <div className="bg-white rounded-2xl p-4 border border-[#171717]/10 shadow-xs flex flex-col gap-1">
              <h4 className="text-xs font-extrabold uppercase text-[#171717]">Sistema</h4>
              <p className="text-xs text-[#171717]">Reportaê — Agudos, SP</p>
              <p className="text-[11px] text-[#737373]">Painel Administrativo Exclusivo do Proprietário</p>
            </div>
          </div>
        )}
          </>
        )}
      </main>

      {/* Role Change Confirmation Dialog */}
      {pendingRoleChange && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-5 max-w-[340px] w-full text-center shadow-2xl">
            <span className="material-symbols-outlined text-[36px] text-[#F47721] mb-2">
              admin_panel_settings
            </span>
            <h3 className="text-base font-bold text-[#171717]">Confirmar Alteração de Cargo</h3>
            <p className="text-xs text-[#737373] mt-1.5 leading-relaxed">
              Deseja alterar o cargo de <strong>{pendingRoleChange.user.name}</strong> ({pendingRoleChange.user.email}) para{' '}
              <strong className="uppercase">{pendingRoleChange.newRole}</strong>?
            </p>
            <div className="flex flex-col gap-2 mt-4">
              <button
                onClick={handleConfirmRoleChange}
                className="w-full h-11 bg-[#FFC928] text-[#171717] font-bold text-xs rounded-xl cursor-pointer"
              >
                Confirmar alteração
              </button>
              <button
                onClick={() => setPendingRoleChange(null)}
                className="w-full h-10 bg-neutral-100 text-[#171717] font-bold text-xs rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
