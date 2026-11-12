import React, { useState } from 'react';
import { User, UserRole } from '../types';
import { soundFx } from '../utils/audio';

interface ProfileScreenProps {
  user: User | null;
  onUpdateProfile: (data: Partial<User>) => Promise<void>;
  onDeleteAccount: () => Promise<void>;
  onOpenTerms: () => void;
  onGoogleSignIn: () => void;
  onEmailSignIn: (email: string) => Promise<void>;
  onLogout: () => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  user,
  onUpdateProfile,
  onDeleteAccount,
  onOpenTerms,
  onGoogleSignIn,
  onEmailSignIn,
  onLogout,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [neighborhood, setNeighborhood] = useState(user?.neighborhood || 'Centro, Agudos');
  const [phone, setPhone] = useState(user?.phone || '');
  const [soundEnabled, setSoundEnabled] = useState(soundFx.isEnabled());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Email login state for visitor mode
  const [emailInput, setEmailInput] = useState('');
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onUpdateProfile({
        name,
        neighborhood,
        phone,
      });
      soundFx.playSuccess();
      setIsEditing(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleSound = (enabled: boolean) => {
    setSoundEnabled(enabled);
    soundFx.setEnabled(enabled);
    if (enabled) {
      soundFx.playNotification();
    }
    if (user) {
      onUpdateProfile({ soundEffectsEnabled: enabled });
    }
  };

  const handleRoleChange = async (newRole: UserRole) => {
    soundFx.playTap();
    await onUpdateProfile({ role: newRole });
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim()) {
      setLoginError('Informe um e-mail válido.');
      return;
    }
    setIsLoggingIn(true);
    setLoginError(null);
    try {
      await onEmailSignIn(emailInput.trim());
      soundFx.playSuccess();
      setShowEmailForm(false);
    } catch (err: any) {
      setLoginError(err.message || 'Erro ao realizar login.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // 1. Visitor Screen when user is null (Strict Section 2 Requirement)
  if (!user) {
    return (
      <main className="flex-1 w-full max-w-[480px] mx-auto pt-4 pb-28 px-4 flex flex-col gap-4">
        <div>
          <h1 className="font-bold text-[24px] text-[#171717] tracking-tight">Meu Perfil</h1>
          <p className="text-[13px] text-[#737373] mt-0.5">
            Acesse sua conta do Reportaê em Agudos, SP.
          </p>
        </div>

        {/* Visitor Card */}
        <div className="bg-white rounded-3xl p-6 border border-[#171717]/8 shadow-xs flex flex-col items-center text-center">
          <div className="w-20 h-20 rounded-full bg-[#FFF9EB] border-2 border-[#171717]/10 flex items-center justify-center text-[#737373] mb-3 shadow-xs">
            <span className="material-symbols-outlined text-[44px]">account_circle</span>
          </div>

          <h2 className="text-base font-bold text-[#171717]">
            Entre na sua conta para acessar seu perfil
          </h2>
          <p className="text-xs text-[#737373] mt-1 max-w-[280px] leading-relaxed">
            Identifique-se para acompanhar suas solicitações municipais e apoiar melhorias em Agudos.
          </p>

          {/* Action: Google Login */}
          <div className="w-full flex flex-col gap-2.5 mt-5">
            <button
              onClick={() => {
                soundFx.playTap();
                onGoogleSignIn();
              }}
              className="w-full h-12 bg-white border border-[#171717]/15 rounded-xl font-bold text-xs text-[#171717] flex items-center justify-center gap-2.5 shadow-xs hover:bg-[#FFF9EB] active:scale-98 transition-all cursor-pointer"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Entrar com Google</span>
            </button>

            {/* Email login toggle */}
            {!showEmailForm ? (
              <button
                onClick={() => {
                  soundFx.playTap();
                  setShowEmailForm(true);
                }}
                className="w-full h-11 bg-[#FFF9EB] border border-[#FFC928]/40 rounded-xl font-bold text-xs text-[#171717] flex items-center justify-center gap-1.5 active:scale-98 transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">mail</span>
                <span>Entrar ou criar conta com e-mail</span>
              </button>
            ) : (
              <form onSubmit={handleEmailSubmit} className="flex flex-col gap-2 mt-2 w-full text-left">
                {loginError && (
                  <p className="text-[11px] text-red-600 font-semibold">{loginError}</p>
                )}
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="seu.email@exemplo.com"
                  className="w-full bg-[#FFF9EB] rounded-xl px-3 py-2.5 text-xs text-[#171717] border border-[#171717]/10 focus:outline-none focus:border-[#171717]"
                  required
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={isLoggingIn}
                    className="flex-1 h-10 bg-[#FFC928] text-[#171717] font-bold text-xs rounded-xl flex items-center justify-center cursor-pointer"
                  >
                    {isLoggingIn ? 'Entrando...' : 'Continuar com e-mail'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowEmailForm(false)}
                    className="px-3 h-10 bg-neutral-100 text-[#737373] font-semibold text-xs rounded-xl"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Preferences in Visitor mode */}
        <div className="bg-white rounded-3xl p-4 border border-[#171717]/8 shadow-xs flex flex-col gap-3">
          <h3 className="text-xs font-bold text-[#171717] uppercase tracking-wide">
            Preferências do Aplicativo
          </h3>

          <div className="flex items-center justify-between p-2 rounded-xl bg-[#FFF9EB]/60 border border-[#171717]/5">
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-[#F47721] text-[20px]">
                {soundEnabled ? 'volume_up' : 'volume_off'}
              </span>
              <div>
                <p className="text-xs font-bold text-[#171717]">Efeitos sonoros</p>
                <p className="text-[11px] text-[#737373]">
                  Feedback sonoro sutil para ações
                </p>
              </div>
            </div>

            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={soundEnabled}
                onChange={(e) => handleToggleSound(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-zinc-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#FFC928]" />
            </label>
          </div>

          <button
            onClick={() => {
              soundFx.playTap();
              onOpenTerms();
            }}
            className="flex items-center justify-between p-2 rounded-xl hover:bg-[#FFF9EB]/60 text-left cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-[#737373] text-[20px]">
                policy
              </span>
              <div>
                <p className="text-xs font-bold text-[#171717]">Termos de Uso e Privacidade</p>
                <p className="text-[11px] text-[#737373]">LGPD e cidadania em Agudos, SP</p>
              </div>
            </div>
            <span className="material-symbols-outlined text-gray-400 text-[18px]">
              chevron_right
            </span>
          </button>
        </div>
      </main>
    );
  }

  // 2. Real Authenticated User Screen
  return (
    <main className="flex-1 w-full max-w-[480px] mx-auto pt-2 pb-28 px-4 flex flex-col gap-4">
      <div className="pt-2">
        <h1 className="font-bold text-[24px] text-[#171717] tracking-tight">Meu Perfil</h1>
        <p className="text-[13px] text-[#737373] mt-0.5">
          Conta de cidadão autenticada em Agudos, SP.
        </p>
      </div>

      {/* Real User Card */}
      <div className="bg-white rounded-3xl p-5 border border-[#171717]/8 shadow-xs flex flex-col items-center text-center relative overflow-hidden">
        <div className="relative mb-3">
          {user.avatarUrl ? (
            <img
              alt={user.name}
              src={user.avatarUrl}
              className="w-20 h-20 rounded-full object-cover ring-4 ring-[#FFC928] shadow-md"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-[#FFF9EB] border-2 border-[#FFC928] flex items-center justify-center text-[#171717] shadow-md">
              <span className="material-symbols-outlined text-[40px]">person</span>
            </div>
          )}
          <span className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-[#171717] text-[#FFC928] flex items-center justify-center text-xs font-bold border-2 border-white shadow-xs">
            {user.role === 'admin' ? '★' : user.role === 'agente' ? '✓' : '●'}
          </span>
        </div>

        <h2 className="text-lg font-bold text-[#171717]">{user.name}</h2>
        <p className="text-xs text-[#737373] mt-0.5 font-medium">{user.email}</p>

        <div className="flex items-center gap-2 mt-2">
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-[#FFF9EB] text-[#F47721] border border-[#FFC928]/40">
            {user.role === 'admin'
              ? 'Administrador Municipal'
              : user.role === 'agente'
              ? 'Agente Público de Agudos'
              : 'Cidadão de Agudos'}
          </span>
          <span className="text-[11px] text-[#737373]">
            {user.neighborhood || 'Agudos, SP'}
          </span>
        </div>

        {/* Persona Switcher */}
        <div className="w-full mt-4 pt-4 border-t border-[#171717]/5 flex flex-col gap-1.5">
          <span className="text-[11px] font-bold text-[#171717] uppercase tracking-wider text-left">
            Perfil de Acesso no Município:
          </span>
          <div className="grid grid-cols-3 gap-1.5 p-1 bg-[#FFF9EB] rounded-xl border border-[#171717]/5">
            <button
              onClick={() => handleRoleChange('cidadao')}
              className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                user.role === 'cidadao'
                  ? 'bg-[#171717] text-white shadow-xs'
                  : 'text-[#737373] hover:text-[#171717]'
              }`}
            >
              Cidadão
            </button>
            <button
              onClick={() => handleRoleChange('agente')}
              className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                user.role === 'agente'
                  ? 'bg-[#F47721] text-white shadow-xs'
                  : 'text-[#737373] hover:text-[#171717]'
              }`}
            >
              Agente
            </button>
            <button
              onClick={() => handleRoleChange('admin')}
              className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                user.role === 'admin'
                  ? 'bg-[#FFC928] text-[#171717] shadow-xs'
                  : 'text-[#737373] hover:text-[#171717]'
              }`}
            >
              Admin
            </button>
          </div>
        </div>
      </div>

      {/* Edit Profile Form */}
      {isEditing ? (
        <form
          onSubmit={handleSaveProfile}
          className="bg-white rounded-3xl p-5 border border-[#171717]/8 shadow-xs flex flex-col gap-3"
        >
          <div className="flex items-center justify-between pb-2 border-b border-[#171717]/5">
            <h3 className="text-sm font-bold text-[#171717]">Editar Informações Básicas</h3>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="text-xs text-[#737373] hover:text-[#171717]"
            >
              Cancelar
            </button>
          </div>

          <div>
            <label className="text-xs font-bold text-[#171717] block mb-1">Nome Completo</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-[#FFF9EB]/60 rounded-xl px-3 py-2 text-xs border border-[#171717]/10 focus:outline-none focus:border-[#171717]"
              required
            />
          </div>

          <div>
            <label className="text-xs font-bold text-[#171717] block mb-1">Bairro em Agudos</label>
            <input
              type="text"
              value={neighborhood}
              onChange={(e) => setNeighborhood(e.target.value)}
              placeholder="Centro, Jardim Cruzeiro, Pampulha..."
              className="w-full bg-[#FFF9EB]/60 rounded-xl px-3 py-2 text-xs border border-[#171717]/10 focus:outline-none focus:border-[#171717]"
              required
            />
          </div>

          <div>
            <label className="text-xs font-bold text-[#171717] block mb-1">Telefone de Contato</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(14) 99876-5432"
              className="w-full bg-[#FFF9EB]/60 rounded-xl px-3 py-2 text-xs border border-[#171717]/10 focus:outline-none focus:border-[#171717]"
            />
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="mt-2 w-full h-10 bg-[#FFC928] text-[#171717] font-bold text-xs rounded-xl flex items-center justify-center gap-1 active:scale-98 transition-transform cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">save</span>
            <span>{isSaving ? 'Salvando...' : 'Salvar Alterações'}</span>
          </button>
        </form>
      ) : (
        <div className="bg-white rounded-3xl p-2 border border-[#171717]/8 shadow-xs flex flex-col">
          <button
            onClick={() => {
              soundFx.playTap();
              setIsEditing(true);
            }}
            className="flex items-center justify-between p-3.5 hover:bg-[#FFF9EB]/50 rounded-2xl transition-colors text-left cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-[#F47721] text-[20px]">
                edit_note
              </span>
              <div>
                <p className="text-xs font-bold text-[#171717]">Editar dados do perfil</p>
                <p className="text-[11px] text-[#737373]">Nome, bairro de Agudos e contato</p>
              </div>
            </div>
            <span className="material-symbols-outlined text-gray-400 text-[18px]">
              chevron_right
            </span>
          </button>
        </div>
      )}

      {/* Preferences */}
      <div className="bg-white rounded-3xl p-4 border border-[#171717]/8 shadow-xs flex flex-col gap-3">
        <h3 className="text-xs font-bold text-[#171717] uppercase tracking-wide">
          Preferências e Acessibilidade
        </h3>

        <div className="flex items-center justify-between p-2 rounded-xl bg-[#FFF9EB]/60 border border-[#171717]/5">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-[#F47721] text-[20px]">
              {soundEnabled ? 'volume_up' : 'volume_off'}
            </span>
            <div>
              <p className="text-xs font-bold text-[#171717]">Efeitos sonoros</p>
              <p className="text-[11px] text-[#737373]">
                Feedback sonoro sutil para ações
              </p>
            </div>
          </div>

          <label className="relative inline-flex items-center cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={soundEnabled}
              onChange={(e) => handleToggleSound(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-zinc-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#FFC928]" />
          </label>
        </div>

        <button
          onClick={() => {
            soundFx.playTap();
            onOpenTerms();
          }}
          className="flex items-center justify-between p-2 rounded-xl hover:bg-[#FFF9EB]/60 text-left cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-[#737373] text-[20px]">
              policy
            </span>
            <div>
              <p className="text-xs font-bold text-[#171717]">Termos de Uso e Privacidade</p>
              <p className="text-[11px] text-[#737373]">LGPD e cidadania em Agudos, SP</p>
            </div>
          </div>
          <span className="material-symbols-outlined text-gray-400 text-[18px]">
            chevron_right
          </span>
        </button>
      </div>

      {/* Account actions: Logout & Delete */}
      <div className="flex flex-col gap-2 pt-1">
        <button
          onClick={() => {
            soundFx.playTap();
            onLogout();
          }}
          className="w-full h-11 bg-white border border-[#171717]/10 text-[#171717] font-bold text-xs rounded-2xl flex items-center justify-center gap-2 hover:bg-[#FFF9EB] transition-colors cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]">logout</span>
          <span>Encerrar sessão</span>
        </button>

        <button
          onClick={() => {
            soundFx.playTap();
            setShowDeleteConfirm(true);
          }}
          className="w-full h-11 text-red-600 hover:bg-red-50 font-bold text-xs rounded-2xl flex items-center justify-center gap-2 transition-colors cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]">delete_forever</span>
          <span>Excluir minha conta</span>
        </button>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-5 max-w-[340px] w-full text-center shadow-2xl">
            <span className="material-symbols-outlined text-[36px] text-red-600 mb-2">
              warning
            </span>
            <h3 className="text-base font-bold text-[#171717]">Excluir Conta Permanentemente?</h3>
            <p className="text-xs text-[#737373] mt-1.5 leading-relaxed">
              Esta ação removerá seus dados de acesso e desvinculará suas solicitações de forma definitiva, conforme previsto na LGPD.
            </p>

            <div className="flex flex-col gap-2 mt-4">
              <button
                onClick={async () => {
                  soundFx.playTap();
                  await onDeleteAccount();
                  setShowDeleteConfirm(false);
                }}
                className="w-full h-11 bg-red-600 text-white font-bold text-xs rounded-xl hover:bg-red-700"
              >
                Sim, confirmar exclusão
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="w-full h-10 bg-neutral-100 text-[#171717] font-bold text-xs rounded-xl"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};
