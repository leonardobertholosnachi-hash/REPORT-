import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '15mb' }));

type UserRole = 'cidadao' | 'agente' | 'moderador' | 'proprietario';

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
  subcategory?: string;
  subcategoryLabel?: string;
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
  role: UserRole;
  avatarUrl: string;
  neighborhood: string;
  organization: string;
  status: 'ativo' | 'suspenso';
  phone?: string;
  soundEffectsEnabled: boolean;
  termsAccepted: boolean;
  createdAt: string;
  ownerVerified?: boolean;
}

interface RoleChangeRequest {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  currentRole: UserRole;
  requestedRole: 'agente' | 'moderador';
  reason: string;
  status: 'PENDENTE' | 'APROVADA' | 'REJEITADA';
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

interface UserNotification {
  id: string;
  userEmail: string;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
}

interface StoredInviteCode {
  id: string;
  codeHash: string;
  codePreview: string;
  targetRole: 'agente' | 'moderador';
  maxUses: number;
  usedCount: number;
  expiresAt: string;
  revoked: boolean;
  createdByEmail: string;
  createdByName: string;
  createdAt: string;
  usedBy: { email: string; name: string; usedAt: string }[];
}

interface AuditLogItem {
  id: string;
  action: string;
  actorEmail: string;
  actorName: string;
  actorRole: UserRole;
  targetEmail?: string;
  details: string;
  createdAt: string;
}

// Strictly NO fake reports. Starts empty.
let incidents: Incident[] = [];

// Users database (in-memory)
let users: User[] = [];

// Invite codes database (stores ONLY SHA-256 hashes, never plaintext)
let inviteCodes: StoredInviteCode[] = [];

// Audit log database
let auditLogs: AuditLogItem[] = [];

// Role change requests database
let roleRequests: RoleChangeRequest[] = [];

// User notifications database
let userNotifications: UserNotification[] = [];

// Strictly NO fake logged-in user by default. Visitor state when null.
let currentUser: User | null = null;

// Track whether initial owner has been configured
function getOwnerEmail(): string | null {
  const envOwner = process.env.OWNER_EMAIL;
  if (!envOwner || typeof envOwner !== 'string' || !envOwner.trim()) {
    return null;
  }
  return envOwner.trim().toLowerCase();
}

function getOwnerPasswordHash(): string {
  if (process.env.OWNER_PASSWORD_HASH && process.env.OWNER_PASSWORD_HASH.trim()) {
    return process.env.OWNER_PASSWORD_HASH.trim().toLowerCase();
  }
  const raw = process.env.OWNER_PASSWORD || '1308121224';
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function recordAudit(
  action: string,
  actor: { email: string; name: string; role: UserRole },
  details: string,
  targetEmail?: string
) {
  auditLogs.unshift({
    id: 'audit-' + Date.now() + '-' + crypto.randomBytes(3).toString('hex'),
    action,
    actorEmail: actor.email,
    actorName: actor.name,
    actorRole: actor.role,
    targetEmail,
    details,
    createdAt: new Date().toISOString(),
  });
}

function hashInviteCode(rawCode: string): string {
  const normalized = rawCode.trim().toUpperCase().replace(/\s+/g, '');
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

function generateSecureInviteCode(): string {
  const part1 = crypto.randomBytes(2).toString('hex').toUpperCase();
  const part2 = crypto.randomBytes(2).toString('hex').toUpperCase();
  const part3 = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `REP-${part1}-${part2}-${part3}`;
}

// Rate limiting for invite code redemption (max 5 failed attempts per 15 min)
const redeemAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_REDEEM_ATTEMPTS = 5;
const REDEEM_WINDOW_MS = 15 * 60 * 1000;

function checkRedeemRateLimit(key: string): { allowed: boolean; retryAfterSec?: number } {
  const now = Date.now();
  const record = redeemAttempts.get(key);
  if (!record || now > record.resetAt) {
    return { allowed: true };
  }
  if (record.count >= MAX_REDEEM_ATTEMPTS) {
    return { allowed: false, retryAfterSec: Math.ceil((record.resetAt - now) / 1000) };
  }
  return { allowed: true };
}

function recordFailedRedeemAttempt(key: string) {
  const now = Date.now();
  const record = redeemAttempts.get(key);
  if (!record || now > record.resetAt) {
    redeemAttempts.set(key, { count: 1, resetAt: now + REDEEM_WINDOW_MS });
  } else {
    record.count += 1;
  }
}

function clearRedeemAttempts(key: string) {
  redeemAttempts.delete(key);
}

// Auth & Role Middlewares
function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!currentUser) {
    return res.status(401).json({ success: false, error: 'Autenticação necessária.' });
  }
  // Always sync currentUser with authoritative users store
  const dbUser = users.find((u) => u.id === currentUser!.id || u.email === currentUser!.email);
  if (!dbUser) {
    currentUser = null;
    return res.status(401).json({ success: false, error: 'Sessão inválida.' });
  }
  currentUser = dbUser;
  next();
}

function requireRole(allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!currentUser) {
      return res.status(401).json({ success: false, error: 'Autenticação necessária.' });
    }
    const dbUser = users.find((u) => u.id === currentUser!.id || u.email === currentUser!.email);
    if (!dbUser || !allowedRoles.includes(dbUser.role)) {
      return res.status(403).json({
        success: false,
        error: 'Acesso negado. Você não possui permissão para esta operação.',
      });
    }
    currentUser = dbUser;
    next();
  };
}

function requireOwnerVerified(req: Request, res: Response, next: NextFunction) {
  if (!currentUser) {
    return res.status(401).json({ success: false, error: 'Autenticação necessária.' });
  }
  const dbUser = users.find((u) => u.id === currentUser!.id || u.email === currentUser!.email);
  if (!dbUser || dbUser.role !== 'proprietario') {
    return res.status(403).json({
      success: false,
      error: 'Acesso negado. Apenas o Proprietário do Sistema pode realizar esta operação.',
    });
  }
  if (!dbUser.ownerVerified) {
    return res.status(403).json({
      success: false,
      error: 'Verificação em duas etapas necessária. Confirme a senha exclusiva do proprietário.',
    });
  }
  currentUser = dbUser;
  next();
}

// AGUDOS, SP Geographic Boundaries Validation
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

// Helper to find or create user on login (STRICTLY assigns 'cidadao' unless OWNER_EMAIL matches)
function findOrCreateUser(email: string, name: string, avatarUrl = ''): User {
  const normalizedEmail = email.trim().toLowerCase();
  const existing = users.find((u) => u.email.toLowerCase() === normalizedEmail);
  const ownerEmail = getOwnerEmail();
  const existingOwner = users.find((u) => u.role === 'proprietario');

  if (existing) {
    // If OWNER_EMAIL is configured and matches this user and no other owner exists, ensure proprietario
    if (ownerEmail && normalizedEmail === ownerEmail && (!existingOwner || existingOwner.email.toLowerCase() === normalizedEmail)) {
      if (existing.role !== 'proprietario') {
        existing.role = 'proprietario';
        recordAudit('OWNER_INITIALIZED', { email: existing.email, name: existing.name, role: 'proprietario' }, 'Proprietário inicial configurado via OWNER_EMAIL.');
      }
    }
    if (avatarUrl && !existing.avatarUrl) {
      existing.avatarUrl = avatarUrl;
    }
    return existing;
  }

  // Determine initial role strictly on backend
  let initialRole: UserRole = 'cidadao';
  if (ownerEmail && normalizedEmail === ownerEmail && !existingOwner) {
    initialRole = 'proprietario';
  }

  const newUser: User = {
    id: 'user-' + Date.now() + '-' + crypto.randomBytes(2).toString('hex'),
    email: normalizedEmail,
    name: name.trim() || normalizedEmail.split('@')[0],
    role: initialRole,
    avatarUrl,
    neighborhood: 'Agudos, SP',
    organization: 'Prefeitura Municipal de Agudos',
    status: 'ativo',
    phone: '',
    soundEffectsEnabled: true,
    termsAccepted: true,
    createdAt: new Date().toISOString(),
  };

  users.push(newUser);
  if (initialRole === 'proprietario') {
    recordAudit('OWNER_INITIALIZED', { email: newUser.email, name: newUser.name, role: 'proprietario' }, 'Conta do Proprietário inicializada via OWNER_EMAIL.');
  } else {
    recordAudit('USER_REGISTERED', { email: newUser.email, name: newUser.name, role: 'cidadao' }, 'Novo usuário cadastrado automaticamente como CIDADÃO.');
  }

  return newUser;
}

// ==================== INCIDENTS API ====================

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

app.post('/api/incidents', (req, res) => {
  const { title, description, category, photoUrl, address, neighborhood, city, lat, lng, isUrgent } = req.body;

  if (!description || !category) {
    return res.status(400).json({ success: false, error: 'Campos obrigatórios ausentes.' });
  }

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
    if (normalizedCity !== 'agudos' && (normalizedCity.includes('são paulo') || normalizedCity.includes('bauru')) && !normalizedCity.includes('agudos')) {
      return res.status(400).json({
        success: false,
        error: 'O Reportaê atende somente ao município de Agudos, SP. Selecione uma localização dentro da cidade.'
      });
    }
  }

  const categoryNames: Record<string, { label: string; icon: string }> = {
    buraco: { label: 'Pavimentação • Buraco na via', icon: 'construction' },
    sinalizacao: { label: 'Sinalização • Trânsito e vias', icon: 'traffic' },
    bueiros: { label: 'Bueiros • Drenagem e escoamento', icon: 'water_damage' },
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
    categoryLabel: req.body.subcategoryLabel ? `${catMeta.label} (${req.body.subcategoryLabel})` : catMeta.label,
    subcategory: req.body.subcategory || undefined,
    subcategoryLabel: req.body.subcategoryLabel || undefined,
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

// Update status: strictly requires agente, admin, or proprietario
app.patch('/api/incidents/:id/status', requireRole(['agente', 'moderador', 'proprietario']), (req, res) => {
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

  incident.statusHistory.push({
    status,
    date: timeFormatted,
    author: `${currentUser!.name} (${team || 'Prefeitura de Agudos'})`,
    note: note || `Status atualizado para ${validStatuses[status]}.`,
  });

  res.json({ success: true, data: incident });
});

// ==================== AUTHENTICATION API ====================

app.get('/api/auth/me', (req, res) => {
  if (currentUser) {
    const dbUser = users.find((u) => u.id === currentUser!.id || u.email === currentUser!.email);
    currentUser = dbUser || null;
  }
  res.json({ success: true, data: currentUser });
});

app.post('/api/auth/login', (req, res) => {
  const { email } = req.body;
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ success: false, error: 'E-mail obrigatório.' });
  }
  const cleanName = email.split('@')[0].replace('.', ' ').replace(/^\w/, (c: string) => c.toUpperCase());
  // Backend strictly assigns role (cidadao, or proprietario if OWNER_EMAIL matches)
  currentUser = findOrCreateUser(email, cleanName);
  res.json({ success: true, data: currentUser });
});

app.post('/api/auth/google', (req, res) => {
  const email = req.body.email || 'nelson.losnachi@gmail.com';
  const name = req.body.name || 'Nelson Losnachi';
  const avatarUrl = req.body.avatarUrl || '';
  // Backend strictly ignores req.body.role!
  currentUser = findOrCreateUser(email, name, avatarUrl);
  res.json({ success: true, data: currentUser });
});

app.post('/api/auth/profile', requireAuth, (req, res) => {
  // Users CANNOT change their own role via profile update!
  const { name, neighborhood, phone, soundEffectsEnabled } = req.body;
  if (name) currentUser!.name = name;
  if (neighborhood) currentUser!.neighborhood = neighborhood;
  if (phone !== undefined) currentUser!.phone = phone;
  if (soundEffectsEnabled !== undefined) currentUser!.soundEffectsEnabled = Boolean(soundEffectsEnabled);

  res.json({ success: true, data: currentUser });
});

app.post('/api/auth/logout', (req, res) => {
  if (currentUser) {
    currentUser.ownerVerified = false;
  }
  currentUser = null;
  res.json({ success: true, message: 'Sessão encerrada com sucesso.' });
});

app.delete('/api/auth/account', requireAuth, (req, res) => {
  if (currentUser!.role === 'proprietario') {
    return res.status(403).json({
      success: false,
      error: 'A conta do Proprietário do Sistema não pode ser excluída por esta rota.',
    });
  }
  users = users.filter((u) => u.id !== currentUser!.id);
  currentUser = null;
  res.json({ success: true, message: 'Conta excluída com sucesso.' });
});

// ==================== INVITE CODES REDEMPTION (ANY AUTHENTICATED USER) ====================

app.post('/api/invites/redeem', requireAuth, (req, res) => {
  const { code } = req.body;
  const rateKey = currentUser!.email;
  const rateCheck = checkRedeemRateLimit(rateKey);

  if (!rateCheck.allowed) {
    return res.status(429).json({
      success: false,
      error: `Muitas tentativas inválidas. Aguarde ${Math.ceil((rateCheck.retryAfterSec || 60) / 60)} minuto(s) para tentar novamente.`,
    });
  }

  if (!code || typeof code !== 'string' || !code.trim()) {
    recordFailedRedeemAttempt(rateKey);
    return res.status(400).json({ success: false, error: 'Informe um código de autorização válido.' });
  }

  // Check if the code matches the exclusive owner password
  const rawInputHash = crypto.createHash('sha256').update(code.trim()).digest('hex');
  if (rawInputHash === getOwnerPasswordHash()) {
    const existingOwner = users.find((u) => u.role === 'proprietario' && u.email !== currentUser!.email);
    if (existingOwner) {
      return res.status(403).json({
        success: false,
        error: 'Já existe um Proprietário do Sistema configurado.',
      });
    }
    clearRedeemAttempts(rateKey);
    currentUser!.role = 'proprietario';
    currentUser!.ownerVerified = true;
    recordAudit(
      'OWNER_INITIALIZED',
      { email: currentUser!.email, name: currentUser!.name, role: 'proprietario' },
      'Usuário autenticado como Proprietário do Sistema via código exclusivo.'
    );
    return res.json({
      success: true,
      data: {
        user: currentUser,
        message: 'Código exclusivo confirmado! Você agora é o Proprietário do Sistema.',
      },
    });
  }

  const codeHash = hashInviteCode(code);
  const invite = inviteCodes.find((inv) => inv.codeHash === codeHash);

  if (!invite) {
    recordFailedRedeemAttempt(rateKey);
    return res.status(404).json({ success: false, error: 'Código de autorização inválido ou não encontrado.' });
  }

  if (invite.revoked) {
    recordFailedRedeemAttempt(rateKey);
    return res.status(400).json({ success: false, error: 'Este código de autorização foi revogado pelo proprietário.' });
  }

  if (new Date(invite.expiresAt).getTime() <= Date.now()) {
    recordFailedRedeemAttempt(rateKey);
    return res.status(400).json({ success: false, error: 'Este código de autorização está expirado.' });
  }

  if (invite.usedCount >= invite.maxUses) {
    recordFailedRedeemAttempt(rateKey);
    return res.status(400).json({ success: false, error: 'Este código de autorização já atingiu o limite máximo de utilizações.' });
  }

  if (invite.usedBy.some((u) => u.email === currentUser!.email)) {
    return res.status(400).json({ success: false, error: 'Você já utilizou este código de autorização.' });
  }

  // Prevent invite from ever granting proprietario
  if ((invite.targetRole as string) === 'proprietario') {
    return res.status(403).json({ success: false, error: 'Códigos de convite não podem conceder o cargo de proprietário.' });
  }

  // Do not downgrade proprietario
  if (currentUser!.role === 'proprietario') {
    return res.status(400).json({ success: false, error: 'Você já possui o cargo máximo de Proprietário do Sistema.' });
  }

  // Atomic synchronous update
  invite.usedCount += 1;
  invite.usedBy.push({
    email: currentUser!.email,
    name: currentUser!.name,
    usedAt: new Date().toISOString(),
  });

  const previousRole = currentUser!.role;
  currentUser!.role = invite.targetRole;
  clearRedeemAttempts(rateKey);

  recordAudit(
    'INVITE_REDEEMED',
    { email: currentUser!.email, name: currentUser!.name, role: currentUser!.role },
    `Código ${invite.codePreview} utilizado. Cargo alterado de ${previousRole.toUpperCase()} para ${invite.targetRole.toUpperCase()}.`,
    currentUser!.email
  );

  res.json({
    success: true,
    data: currentUser,
    message: `Código validado! Seu cargo foi atualizado para ${invite.targetRole.toUpperCase()}.`,
  });
});

// ==================== ROLE CHANGE REQUESTS & NOTIFICATIONS ====================

app.post('/api/role-requests', requireAuth, (req, res) => {
  const { requestedRole, reason } = req.body;
  if (!['agente', 'moderador'].includes(requestedRole)) {
    return res.status(400).json({
      success: false,
      error: 'Cargo solicitado inválido. Escolha Agente ou Moderador.',
    });
  }
  if (!reason || typeof reason !== 'string' || reason.trim().length < 5) {
    return res.status(400).json({
      success: false,
      error: 'Informe um motivo válido (mínimo 5 caracteres).',
    });
  }
  if (currentUser!.role === 'proprietario') {
    return res.status(400).json({
      success: false,
      error: 'O Proprietário já possui controle total do sistema.',
    });
  }

  const existingPending = roleRequests.find(
    (r) => r.userEmail === currentUser!.email && r.status === 'PENDENTE'
  );
  if (existingPending) {
    return res.status(400).json({
      success: false,
      error: 'Você já possui uma solicitação de mudança de cargo pendente.',
    });
  }

  const newReq: RoleChangeRequest = {
    id: 'req-' + Date.now() + '-' + crypto.randomBytes(2).toString('hex'),
    userId: currentUser!.id,
    userName: currentUser!.name,
    userEmail: currentUser!.email,
    currentRole: currentUser!.role,
    requestedRole,
    reason: reason.trim(),
    status: 'PENDENTE',
    createdAt: new Date().toISOString(),
  };

  roleRequests.unshift(newReq);

  recordAudit(
    'ROLE_REQUEST_CREATED',
    { email: currentUser!.email, name: currentUser!.name, role: currentUser!.role },
    `Solicitou mudança de cargo para ${requestedRole.toUpperCase()}. Motivo: ${newReq.reason}`
  );

  res.status(201).json({ success: true, data: newReq });
});

app.get('/api/notifications', requireAuth, (req, res) => {
  const list = userNotifications.filter((n) => n.userEmail === currentUser!.email);
  res.json({ success: true, data: list });
});

app.post('/api/notifications/read', requireAuth, (req, res) => {
  userNotifications.forEach((n) => {
    if (n.userEmail === currentUser!.email) {
      n.read = true;
    }
  });
  res.json({ success: true });
});

// ==================== OWNER SYSTEM MANAGEMENT API (PROPRIETARIO ONLY) ====================

app.post('/api/owner/verify-password', requireRole(['proprietario']), (req, res) => {
  const { password } = req.body;
  const rateKey = `owner-pw:${currentUser!.email}`;
  const rateCheck = checkRedeemRateLimit(rateKey);

  if (!rateCheck.allowed) {
    return res.status(429).json({
      success: false,
      error: `Muitas tentativas incorretas. Tente novamente em ${rateCheck.retryAfterSec} segundos.`,
    });
  }

  if (!password || typeof password !== 'string') {
    return res.status(400).json({ success: false, error: 'Informe a senha exclusiva do proprietário.' });
  }

  const inputHash = crypto.createHash('sha256').update(password).digest('hex');
  if (inputHash !== getOwnerPasswordHash()) {
    recordFailedRedeemAttempt(rateKey);
    recordAudit(
      'OWNER_VERIFY_FAILED',
      { email: currentUser!.email, name: currentUser!.name, role: currentUser!.role },
      'Tentativa de verificação de senha exclusiva do proprietário falhou.'
    );
    return res.status(401).json({ success: false, error: 'Senha exclusiva do proprietário incorreta.' });
  }

  clearRedeemAttempts(rateKey);
  currentUser!.ownerVerified = true;

  recordAudit(
    'OWNER_VERIFIED',
    { email: currentUser!.email, name: currentUser!.name, role: currentUser!.role },
    'Proprietário verificado com senha exclusiva.'
  );

  res.json({ success: true, data: currentUser });
});

app.get('/api/owner/overview', requireOwnerVerified, (req, res) => {
  res.json({
    success: true,
    data: {
      totalUsers: users.length,
      citizensCount: users.filter((u) => u.role === 'cidadao').length,
      agentsCount: users.filter((u) => u.role === 'agente').length,
      moderatorsCount: users.filter((u) => u.role === 'moderador').length,
      pendingRequestsCount: roleRequests.filter((r) => r.status === 'PENDENTE').length,
      totalIncidents: incidents.length,
    },
  });
});

app.get('/api/owner/users', requireOwnerVerified, (req, res) => {
  res.json({ success: true, data: users });
});

app.patch('/api/owner/users/:id/role', requireOwnerVerified, (req, res) => {
  const { role } = req.body;
  const targetUser = users.find((u) => u.id === req.params.id);

  if (!targetUser) {
    return res.status(404).json({ success: false, error: 'Usuário não encontrado.' });
  }

  if (!['cidadao', 'agente', 'moderador'].includes(role)) {
    return res.status(400).json({
      success: false,
      error: 'Cargo inválido. Somente Cidadão, Agente ou Moderador podem ser atribuídos.',
    });
  }

  if (targetUser.role === 'proprietario') {
    return res.status(403).json({
      success: false,
      error: 'O cargo do Proprietário do Sistema não pode ser alterado ou rebaixado.',
    });
  }

  const previousRole = targetUser.role;
  targetUser.role = role;

  recordAudit(
    'ROLE_CHANGED',
    { email: currentUser!.email, name: currentUser!.name, role: currentUser!.role },
    `Cargo de ${targetUser.email} alterado de ${previousRole.toUpperCase()} para ${role.toUpperCase()}.`,
    targetUser.email
  );

  res.json({ success: true, data: targetUser });
});

app.get('/api/owner/invites', requireOwnerVerified, (req, res) => {
  // Never return codeHash in API responses, only safe metadata
  const safeInvites = inviteCodes.map(({ codeHash, ...rest }) => rest);
  res.json({ success: true, data: safeInvites });
});

app.post('/api/owner/invites', requireOwnerVerified, (req, res) => {
  const { targetRole, maxUses, expiresInDays } = req.body;

  if (!['agente', 'moderador'].includes(targetRole)) {
    return res.status(400).json({
      success: false,
      error: 'Cargo inválido para convite. Escolha Agente ou Moderador.',
    });
  }

  const uses = Math.max(1, Math.min(100, parseInt(maxUses, 10) || 1));
  const days = Math.max(1, Math.min(365, parseInt(expiresInDays, 10) || 7));

  const rawCode = generateSecureInviteCode();
  const codeHash = hashInviteCode(rawCode);
  const codePreview = `REP-****-****-${rawCode.slice(-4)}`;
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

  const newInvite: StoredInviteCode = {
    id: 'inv-' + Date.now() + '-' + crypto.randomBytes(2).toString('hex'),
    codeHash,
    codePreview,
    targetRole,
    maxUses: uses,
    usedCount: 0,
    expiresAt,
    revoked: false,
    createdByEmail: currentUser!.email,
    createdByName: currentUser!.name,
    createdAt: new Date().toISOString(),
    usedBy: [],
  };

  inviteCodes.unshift(newInvite);

  recordAudit(
    'INVITE_CREATED',
    { email: currentUser!.email, name: currentUser!.name, role: currentUser!.role },
    `Código ${codePreview} gerado para o cargo ${targetRole.toUpperCase()} (${uses} uso(s), válido por ${days} dia(s)).`
  );

  const { codeHash: _, ...safeInvite } = newInvite;
  res.status(201).json({
    success: true,
    data: {
      invite: safeInvite,
      plaintextCode: rawCode, // Returned ONCE upon creation so owner can copy it
    },
  });
});

app.post('/api/owner/invites/:id/revoke', requireOwnerVerified, (req, res) => {
  const invite = inviteCodes.find((i) => i.id === req.params.id);
  if (!invite) {
    return res.status(404).json({ success: false, error: 'Código de convite não encontrado.' });
  }

  invite.revoked = true;
  recordAudit(
    'INVITE_REVOKED',
    { email: currentUser!.email, name: currentUser!.name, role: currentUser!.role },
    `Código ${invite.codePreview} (${invite.targetRole.toUpperCase()}) revogado.`
  );

  const { codeHash: _, ...safeInvite } = invite;
  res.json({ success: true, data: safeInvite });
});

app.get('/api/owner/role-requests', requireOwnerVerified, (req, res) => {
  res.json({ success: true, data: roleRequests });
});

app.post('/api/owner/role-requests/:id/approve', requireOwnerVerified, (req, res) => {
  const request = roleRequests.find((r) => r.id === req.params.id);
  if (!request) {
    return res.status(404).json({ success: false, error: 'Solicitação não encontrada.' });
  }
  if (request.status !== 'PENDENTE') {
    return res.status(400).json({ success: false, error: 'Esta solicitação já foi analisada.' });
  }

  const targetUser = users.find((u) => u.email.toLowerCase() === request.userEmail.toLowerCase());
  if (!targetUser) {
    return res.status(404).json({ success: false, error: 'Usuário solicitante não encontrado.' });
  }

  if (targetUser.role === 'proprietario') {
    return res.status(403).json({ success: false, error: 'Não é possível alterar o cargo do Proprietário.' });
  }

  targetUser.role = request.requestedRole;
  request.status = 'APROVADA';
  request.reviewedAt = new Date().toISOString();
  request.reviewedBy = currentUser!.email;

  userNotifications.unshift({
    id: 'notif-' + Date.now() + '-' + crypto.randomBytes(2).toString('hex'),
    userEmail: targetUser.email,
    title: 'Solicitação de cargo aprovada',
    message: `Sua solicitação para o cargo ${request.requestedRole.toUpperCase()} foi aprovada pelo Proprietário.`,
    createdAt: new Date().toISOString(),
    read: false,
  });

  recordAudit(
    'ROLE_REQUEST_APPROVED',
    { email: currentUser!.email, name: currentUser!.name, role: currentUser!.role },
    `Solicitação de ${targetUser.email} aprovada para ${request.requestedRole.toUpperCase()}.`,
    targetUser.email
  );

  res.json({ success: true, data: request });
});

app.post('/api/owner/role-requests/:id/reject', requireOwnerVerified, (req, res) => {
  const request = roleRequests.find((r) => r.id === req.params.id);
  if (!request) {
    return res.status(404).json({ success: false, error: 'Solicitação não encontrada.' });
  }
  if (request.status !== 'PENDENTE') {
    return res.status(400).json({ success: false, error: 'Esta solicitação já foi analisada.' });
  }

  request.status = 'REJEITADA';
  request.reviewedAt = new Date().toISOString();
  request.reviewedBy = currentUser!.email;

  userNotifications.unshift({
    id: 'notif-' + Date.now() + '-' + crypto.randomBytes(2).toString('hex'),
    userEmail: request.userEmail,
    title: 'Solicitação de cargo rejeitada',
    message: `Sua solicitação para o cargo ${request.requestedRole.toUpperCase()} foi rejeitada. Você permanece como ${request.currentRole.toUpperCase()}.`,
    createdAt: new Date().toISOString(),
    read: false,
  });

  recordAudit(
    'ROLE_REQUEST_REJECTED',
    { email: currentUser!.email, name: currentUser!.name, role: currentUser!.role },
    `Solicitação de ${request.userEmail} para ${request.requestedRole.toUpperCase()} foi rejeitada.`,
    request.userEmail
  );

  res.json({ success: true, data: request });
});

app.get('/api/owner/audit', requireOwnerVerified, (req, res) => {
  res.json({ success: true, data: auditLogs });
});

// ==================== CATEGORIES & STATS ====================

app.get('/api/categories', (req, res) => {
  const baseCategories = [
    { id: 'buraco', name: 'Buraco na rua', subtitle: 'Asfalto e vias urbanas', icon: 'construction' },
    { id: 'lixo', name: 'Lixo acumulado', subtitle: 'Descarte e entulho', icon: 'delete_sweep' },
    { id: 'sinalizacao', name: 'Sinalização', subtitle: 'Placas, faixas e semáforos', icon: 'traffic' },
    { id: 'bueiros', name: 'Bueiros', subtitle: 'Entupimento, tampa e alagamento', icon: 'water_damage' },
    { id: 'calcada', name: 'Calçada danificada', subtitle: 'Acessibilidade e pedestres', icon: 'accessible' },
    { id: 'vazamento', name: 'Vazamento de água', subtitle: 'Rede ou esgoto sanitário', icon: 'water_drop' },
    { id: 'arvore', name: 'Poda de árvore', subtitle: 'Risco de queda / fiação', icon: 'park' },
  ];

  const enriched = baseCategories.map(cat => ({
    ...cat,
    count: incidents.filter(i => i.category === cat.id).length
  }));

  res.json({ success: true, data: enriched });
});

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
    const { createServer: createViteServer } = await import('vite');
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
