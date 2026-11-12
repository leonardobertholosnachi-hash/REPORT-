export type IncidentStatus = 
  | 'recebida'
  | 'triagem'
  | 'andamento'
  | 'aguardando_material'
  | 'resolvida'
  | 'indeferida';

export interface StatusHistoryItem {
  status: string;
  date: string;
  author: string;
  note: string;
  badge?: string;
}

export interface Incident {
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
  status: IncidentStatus;
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

export type UserRole = 'cidadao' | 'agente' | 'moderador' | 'proprietario';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatarUrl: string;
  neighborhood: string;
  organization?: string;
  status?: 'ativo' | 'suspenso';
  phone?: string;
  soundEffectsEnabled: boolean;
  termsAccepted: boolean;
  createdAt: string;
  ownerVerified?: boolean;
}

export interface RoleChangeRequest {
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

export interface UserNotification {
  id: string;
  userEmail: string;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
}

export interface Category {
  id: string;
  name: string;
  subtitle: string;
  icon: string;
  count?: number;
}

export interface InviteCodeSummary {
  id: string;
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

export interface AuditLogItem {
  id: string;
  action: string;
  actorEmail: string;
  actorName: string;
  actorRole: UserRole;
  targetEmail?: string;
  details: string;
  createdAt: string;
}
