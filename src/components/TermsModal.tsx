import React from 'react';
import { soundFx } from '../utils/audio';

interface TermsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept?: () => void;
  isFirstAccess?: boolean;
}

export const TermsModal: React.FC<TermsModalProps> = ({
  isOpen,
  onClose,
  onAccept,
  isFirstAccess = false,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white rounded-3xl max-w-[420px] w-full max-h-[85vh] flex flex-col shadow-2xl border border-[#171717]/10 overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 bg-[#FFF9EB] border-b border-[#171717]/8 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#F47721] text-[22px]">
              verified_user
            </span>
            <h3 className="text-base font-bold text-[#171717]">
              Termos de Uso e Privacidade
            </h3>
          </div>
          {!isFirstAccess && (
            <button
              onClick={() => {
                soundFx.playTap();
                onClose();
              }}
              className="w-7 h-7 rounded-full flex items-center justify-center text-[#737373] hover:bg-black/5"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          )}
        </div>

        {/* Scrollable text */}
        <div className="p-5 overflow-y-auto space-y-3.5 text-xs text-[#525252] leading-relaxed">
          <p className="font-semibold text-[#171717]">
            Bem-vindo ao Reportaê — Plataforma SaaS de Cidadania Digital e Zeladoria Urbana.
          </p>

          <div>
            <h4 className="font-bold text-[#171717] mb-1">1. Objeto e Finalidade</h4>
            <p>
              O Reportaê é uma ferramenta destinada à colaboração entre cidadãos e poder público para o registro, triagem e acompanhamento de demandas na malha viária, iluminação, saneamento e conservação urbana.
            </p>
          </div>

          <div>
            <h4 className="font-bold text-[#171717] mb-1">2. Privacidade e Proteção de Dados (LGPD)</h4>
            <p>
              Em conformidade com a Lei Geral de Proteção de Dados (Lei 13.709/2018), suas informações pessoais (como e-mail e telefone) não são publicadas publicamente. Somente a foto do problema, endereço da ocorrência, categoria e descrição compõem o feed público para engajamento da vizinhança.
            </p>
          </div>

          <div>
            <h4 className="font-bold text-[#171717] mb-1">3. Responsabilidade pelo Conteúdo</h4>
            <p>
              O usuário declara veracidade nas imagens e descrições submetidas, abstendo-se de fotos que exponham rostos de terceiros sem autorização ou informações ilícitas.
            </p>
          </div>

          <div>
            <h4 className="font-bold text-[#171717] mb-1">4. Notificações e Acompanhamento</h4>
            <p>
              Você poderá receber atualizações do status de seus chamados à medida que as equipes técnicas e secretarias da Prefeitura Municipal de Agudos despacharem ordens de serviço.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#FFF9EB]/70 border-t border-[#171717]/8 flex flex-col gap-2">
          {isFirstAccess ? (
            <button
              onClick={() => {
                soundFx.playSuccess();
                if (onAccept) onAccept();
                onClose();
              }}
              className="w-full h-11 bg-[#FFC928] text-[#171717] font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-sm active:scale-98 transition-transform"
            >
              <span>Concordo e Desejo Continuar</span>
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </button>
          ) : (
            <button
              onClick={() => {
                soundFx.playTap();
                onClose();
              }}
              className="w-full h-10 bg-[#171717] text-white font-bold text-xs rounded-xl"
            >
              Entendido
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
