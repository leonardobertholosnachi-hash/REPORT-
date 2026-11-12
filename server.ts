import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '15mb' }));

interface StatusHistoryItem {
  status: string;
  date: string;
  author: string;
  note: string;
  badge?: string;
}

interface Incident {
  id: string;
  protocol: string;
  title: string;
  description: string;
  category: string;
  categoryLabel: string;
  icon: string;
  photoUrl: string;
  address: string;
  neighborhood: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
  isUrgent: boolean;
  status: 'recebida' | 'triagem' | 'andamento' | 'aguardando_material' | 'resolvida' | 'indeferida';
  statusLabel: string;
  statusHistory: StatusHistoryItem[];
  upvotesCount: number;
  upvoters: string[];
  createdAt: string;
  updatedAt: string;
  userId: string;
  userEmail: string;
  userName: string;
  currentActionStep: string;
  actionIcon?: string;
}

interface User {
  id: string;
  email: string;
  name: string;
  role: 'cidadao' | 'agente' | 'admin';
  avatarUrl: string;
  neighborhood: string;
  phone?: string;
  soundEffectsEnabled: boolean;
  termsAccepted: boolean;
  createdAt: string;
}

// Strictly NO fake reports. Starts empty.
let incidents: Incident[] = [];

// Strictly NO fake logged-in user by default. Visitor state when null.
let currentUser: User | null = null;

// AGUDOS, SP Geographic Boundaries Validation
// Agudos Center: lat: -22.4694, lng: -48.9867
const AGUDOS_BOUNDS = {
  minLat: -22.65,
  maxLat: -22.35,
  minLng: -49.15,
  maxLng: -48.85,
};

function isPointInAgudos(lat: number, lng: number): boolean {
  if (typeof lat !== 'number' || typeof lng !== 'number') return false;
  return (
    lat >= AGUDOS_BOUNDS.minLat &&
    lat <= AGUDOS_BOUNDS.maxLat &&
    lng >= AGUDOS_BOUNDS.minLng &&
    lng <= AGUDOS_BOUNDS.maxLng
  );
}

// API Routes
app.get('/api/incidents', (req, res) => {
  const { status, category, search, neighborhood, userOnly } = req.query;
  let filtered = [...incidents];

  if (userOnly === 'true' && currentUser) {
    filtered = filtered.filter(i => i.userId === currentUser?.id || i.userEmail === currentUser?.email);
  } else if (userOnly === 'true' && !currentUser) {
    filtered = [];
  }

  if (status && status !== 'todas') {
    if (status === 'abertos' || status === 'aberta') {
      filtered = filtered.filter(i => ['recebida', 'triagem', 'andamento', 'aguardando_material'].includes(i.status));
    } else if (status === 'andamento') {
      filtered = filtered.filter(i => ['andamento', 'triagem', 'aguardando_material'].includes(i.status));
    } else if (status === 'recebidas' || status === 'recebida') {
      filtered = filtered.filter(i => i.status === 'recebida');
    } else if (status === 'resolvidas' || status === 'resolvida' || status === 'concluida') {
      filtered = filtered.filter(i => i.status === 'resolvida');
    } else {
      filtered = filtered.filter(i => i.status === status);
    }
  }

  if (category && category !== 'todas') {
    filtered = filtered.filter(i => i.category === category);
  }

  if (search && typeof search === 'string') {
    const q = search.toLowerCase().trim();
    filtered = filtered.filter(i =>
      i.title.toLowerCase().includes(q) ||
      i.protocol.toLowerCase().includes(q) ||
      i.address.toLowerCase().includes(q) ||
      i.neighborhood.toLowerCase().includes(q) ||
      i.description.toLowerCase().includes(q)
    );
  }

  if (neighborhood && typeof neighborhood === 'string' && neighborhood !== 'todos') {
    filtered = filtered.filter(i => i.neighborhood.toLowerCase() === neighborhood.toLowerCase());
  }

  res.json({
    success: true,
    data: filtered,
    total: filtered.length,
    counts: {
      todas: incidents.length,
      abertos: incidents.filter(i => ['recebida', 'triagem', 'andamento', 'aguardando_material'].includes(i.status)).length,
      andamento: incidents.filter(i => ['andamento', 'triagem', 'aguardando_material'].includes(i.status)).length,
      resolvidos: incidents.filter(i => i.status === 'resolvida').length,
    }
  });
});

app.get('/api/incidents/:id', (req, res) => {
  const incident = incidents.find(i => i.id === req.params.id || i.protocol === req.params.id);
  if (!incident) {
    return res.status(404).json({ success: false, error: 'Ocorrência não encontrada em Agudos, SP.' });
  }
  res.json({ success: true, data: incident });
});

// Strict validation: must belong to Agudos, SP
app.post('/api/incidents', (req, res) => {
  const { title, description, category, photoUrl, address, neighborhood, city, state, lat, lng, isUrgent } = req.body;

  if (!description || !category) {
    return res.status(400).json({ success: false, error: 'Campos obrigatórios ausentes.' });
  }

  // Geographic validation: check coordinates and city name
  const numLat = Number(lat);
  const numLng = Number(lng);

  if (!isPointInAgudos(numLat, numLng)) {
    return res.status(400).json({
      success: false,
      error: 'O Reportaê atende somente ao município de Agudos, SP. Selecione uma localização dentro da cidade.'
    });
  }

  if (city && typeof city === 'string') {
    const normalizedCity = city.trim().toLowerCase();
    if (normalizedCity !== 'agudos' && normalizedCity.includes('são paulo') && !normalizedCity.includes('agudos')) {
      return res.status(400).json({
        success: false,
        error: 'O Reportaê atende somente ao município de Agudos, SP. Selecione uma localização dentro da cidade.'
      });
    }
    if (normalizedCity.includes('bauru') && !normalizedCity.includes('agudos')) {
      return res.status(400).json({
        success: false,
        error: 'O Reportaê atende somente ao município de Agudos, SP. Selecione uma localização dentro da cidade.'
      });
    }
  }

  const categoryNames: Record<string, { label: string; icon: string }> = {
    buraco: { label: 'Pavimentação • Buraco na via', icon: 'construction' },
    iluminacao: { label: 'Iluminação • Poste ou praça', icon: 'lightbulb' },
    lixo: { label: 'Lixo acumulado • Descarte irregular', icon: 'delete_sweep' },
    calcada: { label: 'Calçada danificada • Piso e pedestres', icon: 'accessible' },
    vazamento: { label: 'Saneamento • Vazamento de água ou esgoto', icon: 'water_drop' },
    semaforo: { label: 'Trânsito • Semáforo com falha', icon: 'traffic' },
    arvore: { label: 'Meio Ambiente • Poda preventiva', icon: 'park' },
  };

  const catMeta = categoryNames[category] || { label: 'Zeladoria Urbana • Agudos', icon: 'report_problem' };
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  const protocol = `REP-AGD-${randomNum}`;

  const now = new Date();
  const timeFormatted = 'Hoje, ' + now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const authorName = currentUser?.name || 'Cidadão de Agudos';
  const authorEmail = currentUser?.email || 'cidadao@agudos.sp.gov.br';
  const authorId = currentUser?.id || 'anon-' + Date.now();

  const newIncident: Incident = {
    id: 'inc-' + Date.now(),
    protocol,
    title: title || `${catMeta.label.split('•')[1]?.trim() || 'Demanda Urbana em Agudos'}`,
    description,
    category,
    categoryLabel: catMeta.label,
    icon: catMeta.icon,
    photoUrl: photoUrl || '',
    address: address || 'Agudos, SP',
    neighborhood: neighborhood || 'Centro',
    city: 'Agudos',
    state: 'SP',
    lat: numLat,
    lng: numLng,
    isUrgent: Boolean(isUrgent),
    status: 'recebida',
    statusLabel: 'Recebida',
    statusHistory: [
      {
        status: 'recebida',
        date: timeFormatted,
        author: authorName,
        note: 'Chamado registrado e geolocalizado com sucesso em Agudos, SP.',
      }
    ],
    upvotesCount: 1,
    upvoters: [authorEmail],
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    userId: authorId,
    userEmail: authorEmail,
    userName: authorName,
    currentActionStep: 'Aguardando triagem na Prefeitura Municipal de Agudos',
    actionIcon: 'hourglass_top',
  };

  incidents.unshift(newIncident);
  res.status(201).json({ success: true, data: newIncident });
});

// Upvote incident
app.post('/api/incidents/:id/upvote', (req, res) => {
  const incident = incidents.find(i => i.id === req.params.id);
  if (!incident) {
    return res.status(404).json({ success: false, error: 'Ocorrência não encontrada.' });
  }

  const userEmail = currentUser?.email || 'visitante@agudos.sp.gov.br';
  const hasUpvoted = incident.upvoters.includes(userEmail);

  if (hasUpvoted) {
    incident.upvoters = incident.upvoters.filter(e => e !== userEmail);
    incident.upvotesCount = Math.max(0, incident.upvotesCount - 1);
  } else {
    incident.upvoters.push(userEmail);
    incident.upvotesCount += 1;
  }

  incident.updatedAt = new Date().toISOString();
  res.json({
    success: true,
    data: {
      upvoted: !hasUpvoted,
      count: incident.upvotesCount
    }
  });
});

// Update status (Privileged: agente or admin)
app.patch('/api/incidents/:id/status', (req, res) => {
  if (currentUser && currentUser.role !== 'agente' && currentUser.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Apenas agentes públicos e administradores de Agudos podem alterar o status oficial.'
    });
  }

  const { status, note, actionStep, team } = req.body;
  const incident = incidents.find(i => i.id === req.params.id);
  if (!incident) {
    return res.status(404).json({ success: false, error: 'Ocorrência não encontrada.' });
  }

  const validStatuses: Record<string, string> = {
    recebida: 'Recebida',
    triagem: 'Em triagem técnica',
    andamento: 'Em andamento',
    aguardando_material: 'Aguardando equipe/material',
    resolvida: 'Resolvida',
    indeferida: 'Indeferida'
  };

  if (!validStatuses[status]) {
    return res.status(400).json({ success: false, error: 'Status inválido fornecido.' });
  }

  incident.status = status as any;
  incident.statusLabel = validStatuses[status];
  incident.updatedAt = new Date().toISOString();

  if (actionStep) {
    incident.currentActionStep = actionStep;
  }

  const now = new Date();
  const timeFormatted = now.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) + ', ' + now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const authorName = currentUser?.name || 'Servidor Municipal de Agudos';
  incident.statusHistory.push({
    status,
    date: timeFormatted,
    author: `${authorName} (${team || 'Prefeitura de Agudos'})`,
    note: note || `Status atualizado para ${validStatuses[status]}.`,
  });

  res.json({ success: true, data: incident });
});

// Auth Routes - Return null if not logged in (visitor state)
app.get('/api/auth/me', (req, res) => {
  res.json({ success: true, data: currentUser });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, error: 'E-mail obrigatório.' });
  }
  const cleanName = email.split('@')[0].replace('.', ' ').replace(/^\w/, (c: string) => c.toUpperCase());
  currentUser = {
    id: 'user-' + Date.now(),
    email,
    name: cleanName,
    role: 'cidadao',
    avatarUrl: '',
    neighborhood: 'Centro, Agudos',
    phone: '',
    soundEffectsEnabled: true,
    termsAccepted: true,
    createdAt: new Date().toISOString(),
  };
  res.json({ success: true, data: currentUser });
});

app.post('/api/auth/google', (req, res) => {
  currentUser = {
    id: 'user-google-' + Date.now(),
    email: req.body.email || 'nelson.losnachi@gmail.com',
    name: req.body.name || 'Nelson Losnachi',
    role: req.body.role || 'cidadao',
    avatarUrl: req.body.avatarUrl || '',
    neighborhood: 'Agudos, SP',
    phone: '',
    soundEffectsEnabled: true,
    termsAccepted: true,
    createdAt: new Date().toISOString()
  };
  res.json({ success: true, data: currentUser });
});

app.post('/api/auth/profile', (req, res) => {
  if (!currentUser) {
    return res.status(401).json({ success: false, error: 'Nenhum usuário autenticado.' });
  }
  const { name, role, neighborhood, phone, soundEffectsEnabled } = req.body;
  if (name) currentUser.name = name;
  if (role && ['cidadao', 'agente', 'admin'].includes(role)) {
    currentUser.role = role;
  }
  if (neighborhood) currentUser.neighborhood = neighborhood;
  if (phone !== undefined) currentUser.phone = phone;
  if (soundEffectsEnabled !== undefined) currentUser.soundEffectsEnabled = Boolean(soundEffectsEnabled);

  res.json({ success: true, data: currentUser });
});

app.post('/api/auth/logout', (req, res) => {
  currentUser = null;
  res.json({ success: true, message: 'Sessão encerrada com sucesso.' });
});

app.delete('/api/auth/account', (req, res) => {
  currentUser = null;
  res.json({ success: true, message: 'Conta excluída com sucesso.' });
});

// Categories with real counts calculated strictly from Agudos incidents
app.get('/api/categories', (req, res) => {
  const baseCategories = [
    { id: 'buraco', name: 'Buraco na rua', subtitle: 'Asfalto e vias urbanas', icon: 'construction' },
    { id: 'lixo', name: 'Lixo acumulado', subtitle: 'Descarte e entulho', icon: 'delete_sweep' },
    { id: 'iluminacao', name: 'Luz apagada', subtitle: 'Poste ou praça pública', icon: 'lightbulb' },
    { id: 'calcada', name: 'Calçada danificada', subtitle: 'Acessibilidade e pedestres', icon: 'accessible' },
    { id: 'vazamento', name: 'Vazamento de água', subtitle: 'Rede ou esgoto sanitário', icon: 'water_drop' },
    { id: 'semaforo', name: 'Semáforo desligado', subtitle: 'Sinalização de trânsito', icon: 'traffic' },
    { id: 'arvore', name: 'Poda de árvore', subtitle: 'Risco de queda / fiação', icon: 'park' },
  ];

  const enriched = baseCategories.map(cat => ({
    ...cat,
    count: incidents.filter(i => i.category === cat.id).length
  }));

  res.json({ success: true, data: enriched });
});

// Municipal statistics for Agudos, SP - ONLY REAL DATA
app.get('/api/stats', (req, res) => {
  const total = incidents.length;
  const resolved = incidents.filter(i => i.status === 'resolvida').length;
  const inProgress = incidents.filter(i => ['andamento', 'triagem', 'aguardando_material'].includes(i.status)).length;
  const rate = total > 0 ? `${Math.round((resolved / total) * 100)}%` : null;

  res.json({
    success: true,
    data: {
      municipio: 'Agudos, SP',
      total,
      resolved,
      inProgress,
      responseRate: rate,
      hasEnoughData: total > 0,
      orgaosResponsaveis: [
        'Prefeitura Municipal de Agudos',
        'Secretaria de Vias Públicas e Serviços Urbanos',
        'Setor de Iluminação Pública de Agudos',
        'Defesa Civil de Agudos',
        'DAE - Água e Esgoto de Agudos'
      ]
    }
  });
});

async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Reportaê Agudos-SP running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
