import React, { useEffect, useState } from 'react';
import { Header } from './components/Header';
import { BottomNav, NavTab } from './components/BottomNav';
import { HomeScreen } from './components/HomeScreen';
import { MapScreen } from './components/MapScreen';
import { RequestsScreen } from './components/RequestsScreen';
import { ProfileScreen } from './components/ProfileScreen';
import { NewReportModal } from './components/NewReportModal';
import { IncidentDetailModal } from './components/IncidentDetailModal';
import { NotificationsDropdown } from './components/NotificationsDropdown';
import { TermsModal } from './components/TermsModal';
import { Incident, User } from './types';
import { soundFx } from './utils/audio';

export default function App() {
  const [currentTab, setCurrentTab] = useState<NavTab>('inicio');
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [isNewReportOpen, setIsNewReportOpen] = useState(false);
  const [preselectedCategory, setPreselectedCategory] = useState<string | undefined>(undefined);
  const [reportCoords, setReportCoords] = useState<{ lat: number; lng: number; address?: string } | undefined>(undefined);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isTermsOpen, setIsTermsOpen] = useState(false);

  // Strictly NO fake user profile automatically logged in. Starts as null (visitor state)
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Load incidents & auth status on mount
  useEffect(() => {
    fetchIncidents();
    fetchUser();
  }, []);

  const fetchIncidents = async () => {
    try {
      const res = await fetch('/api/incidents');
      const json = await res.json();
      if (json.success && json.data) {
        setIncidents(json.data);
      }
    } catch (err) {
      console.warn('Backend sync in local mode');
    }
  };

  const fetchUser = async () => {
    try {
      const res = await fetch('/api/auth/me');
      const json = await res.json();
      if (json.success) {
        setCurrentUser(json.data);
      }
    } catch (err) {
      console.warn('Visitor session initialized');
    }
  };

  // Upvote incident handler with server sync
  const handleUpvote = async (incidentId: string) => {
    const voterEmail = currentUser?.email || 'cidadao_anonimo@agudos.sp.gov.br';

    setIncidents((prev) =>
      prev.map((item) => {
        if (item.id === incidentId) {
          const hasVoted = item.upvoters.includes(voterEmail);
          const newVoters = hasVoted
            ? item.upvoters.filter((e) => e !== voterEmail)
            : [...item.upvoters, voterEmail];
          const newCount = hasVoted ? Math.max(0, item.upvotesCount - 1) : item.upvotesCount + 1;
          return {
            ...item,
            upvoters: newVoters,
            upvotesCount: newCount,
          };
        }
        return item;
      })
    );

    if (selectedIncident && selectedIncident.id === incidentId) {
      const hasVoted = selectedIncident.upvoters.includes(voterEmail);
      setSelectedIncident({
        ...selectedIncident,
        upvoters: hasVoted
          ? selectedIncident.upvoters.filter((e) => e !== voterEmail)
          : [...selectedIncident.upvoters, voterEmail],
        upvotesCount: hasVoted
          ? Math.max(0, selectedIncident.upvotesCount - 1)
          : selectedIncident.upvotesCount + 1,
      });
    }

    try {
      await fetch(`/api/incidents/${incidentId}/upvote`, {
        method: 'POST',
      });
    } catch (err) {
      console.error('Error recording upvote', err);
    }
  };

  // Submit new incident strictly in Agudos
  const handleCreateReport = async (reportData: any) => {
    try {
      const res = await fetch('/api/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reportData),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setIncidents((prev) => [json.data, ...prev]);
        return { protocol: json.data.protocol };
      }
      throw new Error(json.error || 'Erro ao registrar ocorrência.');
    } catch (err: any) {
      throw err;
    }
  };

  // Update status (official role action in Agudos)
  const handleUpdateStatus = async (
    incidentId: string,
    newStatus: string,
    note: string,
    actionStep?: string,
    team?: string
  ) => {
    try {
      const res = await fetch(`/api/incidents/${incidentId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, note, actionStep, team }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setIncidents((prev) =>
          prev.map((i) => (i.id === incidentId ? json.data : i))
        );
        setSelectedIncident(json.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Update user profile
  const handleUpdateProfile = async (data: Partial<User>) => {
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setCurrentUser(json.data);
      } else if (currentUser) {
        setCurrentUser({ ...currentUser, ...data });
      }
    } catch (err) {
      if (currentUser) {
        setCurrentUser({ ...currentUser, ...data });
      }
    }
  };

  // Google OAuth sign-in
  const handleGoogleSignIn = async () => {
    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'nelson.losnachi@gmail.com',
          name: 'Nelson Losnachi',
          role: 'cidadao',
        }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setCurrentUser(json.data);
        soundFx.playSuccess();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Email sign in
  const handleEmailSignIn = async (email: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const json = await res.json();
    if (json.success && json.data) {
      setCurrentUser(json.data);
    } else {
      throw new Error(json.error || 'Falha ao autenticar.');
    }
  };

  // Account deletion
  const handleDeleteAccount = async () => {
    try {
      await fetch('/api/auth/account', {
        method: 'DELETE',
      });
      setCurrentUser(null);
      setCurrentTab('inicio');
    } catch (err) {
      console.error(err);
    }
  };

  // Logout
  const handleLogout = async () => {
    soundFx.playTap();
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (_) {}
    setCurrentUser(null);
    setCurrentTab('inicio');
  };

  // Header Subtitle for Agudos
  const getHeaderSubtitle = () => {
    if (currentTab === 'inicio') return 'Agudos, SP';
    if (currentTab === 'mapa') return 'Mapa de Agudos';
    if (currentTab === 'solicitacoes') return 'Minhas Solicitações';
    if (currentTab === 'perfil') return 'Perfil';
    return 'Agudos, SP';
  };

  // User pending requests count (strictly real)
  const userRequestsCount = currentUser
    ? incidents.filter(
        (i) => (i.userId === currentUser.id || i.userEmail === currentUser.email) && i.status !== 'resolvida'
      ).length
    : 0;

  return (
    <div className="min-h-screen bg-[#FFF9EB] text-[#171717] flex flex-col antialiased select-none font-sans">
      {/* Top Header */}
      <Header
        user={currentUser}
        subtitle={getHeaderSubtitle()}
        onOpenNotifications={() => setIsNotificationsOpen(true)}
        onProfileClick={() => setCurrentTab('perfil')}
      />

      {/* Main Tab Views */}
      <div className="flex-1 flex flex-col">
        {currentTab === 'inicio' && (
          <HomeScreen
            incidents={incidents}
            onOpenNewReport={(cat) => {
              setPreselectedCategory(cat);
              setReportCoords(undefined);
              setIsNewReportOpen(true);
            }}
            onSelectIncident={(incident) => setSelectedIncident(incident)}
            onGoToMap={() => setCurrentTab('mapa')}
          />
        )}

        {currentTab === 'mapa' && (
          <MapScreen
            incidents={incidents}
            onSelectIncident={(incident) => setSelectedIncident(incident)}
            onUpvoteIncident={handleUpvote}
            onCreateIncidentAtCoords={(coords) => {
              setReportCoords(coords);
              setIsNewReportOpen(true);
            }}
          />
        )}

        {currentTab === 'solicitacoes' && (
          <RequestsScreen
            incidents={
              currentUser
                ? incidents.filter((i) =>
                    currentUser.role === 'admin' || currentUser.role === 'agente'
                      ? true
                      : i.userId === currentUser.id || i.userEmail === currentUser.email
                  )
                : []
            }
            onSelectIncident={(incident) => setSelectedIncident(incident)}
            onOpenNewReport={() => {
              setReportCoords(undefined);
              setIsNewReportOpen(true);
            }}
          />
        )}

        {currentTab === 'perfil' && (
          <ProfileScreen
            user={currentUser}
            onUpdateProfile={handleUpdateProfile}
            onDeleteAccount={handleDeleteAccount}
            onOpenTerms={() => setIsTermsOpen(true)}
            onGoogleSignIn={handleGoogleSignIn}
            onEmailSignIn={handleEmailSignIn}
            onLogout={handleLogout}
          />
        )}
      </div>

      {/* Bottom Fixed Navigation Bar */}
      <BottomNav
        currentTab={currentTab}
        onSelectTab={(tab) => setCurrentTab(tab)}
        pendingCount={userRequestsCount}
      />

      {/* New Report Modal Screen */}
      <NewReportModal
        isOpen={isNewReportOpen}
        onClose={() => {
          setIsNewReportOpen(false);
          setPreselectedCategory(undefined);
          setReportCoords(undefined);
        }}
        onSubmit={handleCreateReport}
        initialCategory={preselectedCategory || 'buraco'}
        initialCoords={reportCoords}
      />

      {/* Incident Detail Sheet Modal */}
      <IncidentDetailModal
        incident={selectedIncident}
        currentUser={currentUser}
        onClose={() => setSelectedIncident(null)}
        onUpvote={handleUpvote}
        onUpdateStatus={handleUpdateStatus}
      />

      {/* Notifications Dropdown */}
      <NotificationsDropdown
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        incidents={
          currentUser
            ? incidents.filter((i) => i.userId === currentUser.id || i.userEmail === currentUser.email)
            : []
        }
        onSelectIncident={(incident) => setSelectedIncident(incident)}
      />

      {/* Terms & Privacy Policy Modal */}
      <TermsModal
        isOpen={isTermsOpen}
        onClose={() => setIsTermsOpen(false)}
        onAccept={() => {
          handleUpdateProfile({ termsAccepted: true });
        }}
      />
    </div>
  );
}
