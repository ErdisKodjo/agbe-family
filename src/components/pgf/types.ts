// ============================================================
// PGF — Types partagés (contrats API ↔ UI)
// ============================================================

export interface CurrentMember {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  city?: string | null;
  role: string;
  registryId: string;
  registryName: string;
  mustChangePassword: boolean;
}

export interface RegistryInfo {
  id: string;
  name: string;
  description?: string | null;
  transparency: boolean;
  headMember?: { id: string; firstName: string; lastName: string; phone: string } | null;
  membersCount: number;
  projectsCount: number;
  campaignsCount: number;
  balance: number;
  createdAt: string;
}

export interface MemberRow {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  city?: string | null;
  position?: string | null;
  role: string;
  registry: { id: string; name: string };
  mustChangePassword: boolean;
  joinedAt: string;
  totalPaid: number | null;
  pendingCount: number | null;
}

export interface PledgeDetail {
  memberId: string;
  member: { id: string; firstName: string; lastName: string; phone: string; city?: string | null };
  amountDue: number;
  amountPaid: number;
}

export interface CampaignRow {
  id: string;
  name: string;
  description?: string | null;
  type: string;
  amount: number;
  dueDay: number;
  periodMonth?: number | null;
  periodYear?: number | null;
  targetAmount: number;
  allowCustom: boolean;
  startDate?: string | null;
  endDate?: string | null;
  status: string;
  registry: { id: string; name: string };
  expected: number;
  collected: number;
  contributorsCount: number;
  lateCount: number;
  pendingPayments: number;
  pledges: PledgeDetail[];
  createdAt: string;
}

export interface PaymentRow {
  id: string;
  campaignId?: string | null;
  campaign?: { id: string; name: string; type: string } | null;
  member: { id: string; firstName: string; lastName: string; phone: string; registryId: string };
  amount: number;
  method: string;
  reference?: string | null;
  proofUrl?: string | null;
  note?: string | null;
  status: string;
  paidAt: string;
  validatedAt?: string | null;
  validatedBy?: { id: string; firstName: string; lastName: string } | null;
}

export interface TransactionRow {
  id: string;
  registry: { id: string; name: string };
  type: string;
  date: string;
  label: string;
  category: string;
  amount: number;
  attachmentUrl?: string | null;
  note?: string | null;
  recordedBy?: { id: string; firstName: string; lastName: string } | null;
}

export interface PhaseRow {
  id: string;
  projectId: string;
  name: string;
  position: number;
  progress: number;
  budget?: number | null;
  status: string;
  tasks: TaskRow[];
}

export interface TaskRow {
  id: string;
  projectId: string;
  title: string;
  description?: string | null;
  status: string;
  dueDate?: string | null;
  phase?: { name: string } | null;
  assignee?: { id: string; firstName: string; lastName: string } | null;
}

export interface ContributionRow {
  id: string;
  projectId: string;
  memberId: string;
  member: { id: string; firstName: string; lastName: string };
  amount: number;
  kind: string;
  description?: string | null;
  date: string;
}

export interface ProjectRow {
  id: string;
  name: string;
  description?: string | null;
  registry: { id: string; name: string };
  startDate: string;
  endDate?: string | null;
  budget: number;
  status: string;
  phases: PhaseRow[];
  tasks: TaskRow[];
  contributions: ContributionRow[];
  totalContributed: number;
  phasesProgress: number;
  fundingRatio: number;
  contributionsByMember: { member: any; total: number; cash: number; inKind: number }[];
  myContribution: number;
  myTasks: TaskRow[];
}

export interface AnnouncementRow {
  id: string;
  title: string;
  content: string;
  isGlobal: boolean;
  registry?: { id: string; name: string } | null;
  author: { id: string; firstName: string; lastName: string; role: string };
  createdAt: string;
}

export interface AuditRow {
  id: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  details?: string | null;
  createdAt: string;
  member?: { firstName: string; lastName: string; role: string } | null;
}

export interface AdminStats {
  scope: "admin";
  kpis: {
    totalMembers: number;
    activeMembers: number;
    registriesCount: number;
    activeProjects: number;
    balance: number;
    totalIncome: number;
    totalExpense: number;
    monthCollected: number;
    pendingPayments: number;
    totalCollected: number;
  };
  months: { label: string; income: number; expense: number }[];
  monthlyStatus: {
    id: string;
    name: string;
    amount: number;
    dueDay: number;
    expected: number;
    collected: number;
    paidCount: number;
    totalMembers: number;
    late: { member: any; amountDue: number; amountPaid: number; rest: number }[];
  } | null;
  recentActivity: AuditRow[];
  catIncomes: { category: string; amount: number }[];
}

export interface MemberStats {
  scope: "member";
  kpis: {
    totalPaid: number;
    totalDue: number;
    restToPay: number;
    pendingMine: number;
    myProjectsCount: number;
    myOpenTasks: number;
    myProjectContributions: number;
  };
  myCampaigns: {
    campaign: { id: string; name: string; type: string; dueDay?: number; endDate?: string | null };
    amountDue: number;
    amountPaid: number;
    rest: number;
  }[];
  myTasks: (TaskRow & { project: { name: string } })[];
  myProjects: {
    id: string;
    name: string;
    status: string;
    phasesProgress: number;
    myContribution: number;
    myTasks: TaskRow[];
  }[];
  recentPayments: PaymentRow[];
}
