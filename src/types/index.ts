export type Role =
  | 'PLAYER'
  | 'USER'
  | 'user'
  | 'admin'
  | 'MODERATOR'
  | 'ADMIN'
  | 'SUPER_ADMIN';

export type TournamentType = 'SOLO' | 'DUO' | 'SQUAD';
export type GameMode = 'BATTLE_ROYALE' | 'CLASH_SQUAD' | 'LONE_WOLF';
export type TournamentStatus =
  | 'UPCOMING'
  | 'REGISTRATION_OPEN'
  | 'REGISTRATION_FULL'
  | 'ONGOING'
  | 'COMPLETED'
  | 'CANCELLED';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  username: string;
  phoneNumber?: string;
  freeFireUid?: string;
  inGameName?: string;
  role: Role;
  isAdmin?: boolean;
  walletBalance: number;
  pendingBalance: number;
  totalDeposited: number;
  spentFromDeposited?: number;
  totalWithdrawn: number;
  totalEarnings: number;
  spentFromWinning?: number;
  totalKills: number;
  totalWins: number;
  totalMatches: number;
  totalTournaments: number;
  teamId?: string;
  teamName?: string;
  avatarUrl?: string;
  passwordHash?: string;
  isBanned?: boolean;
  banReason?: string;
  banDuration?: string;
  bannedAt?: string;
  banExpiresAt?: string | null;
  bannedBy?: string;
  weeklyWins?: number;
  weeklyKills?: number;
  weeklyEarnings?: number;
  weeklyMatches?: number;
  weekStartIso?: string;
  weekResetAt?: string;
  referCode?: string;
  referredBy?: string;
  referredByCode?: string;
  referralCount?: number;
  referralEarnings?: number;
  createdAt: string;
  updatedAt?: string;
}

export interface AdminRecord {
  uid: string;
  displayName: string;
  phoneNumber?: string;
  email: string;
  role: 'ADMIN' | 'SUPER_ADMIN';
  avatarId?: string;
  addedBy?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface PublicAdminRecord {
  id: string;
  displayName: string;
  avatarId?: string;
  createdAt: string;
}

export type MatchCategory =
  | 'FREE MATCH'
  | 'BR MATCH'
  | 'LONE WOLF'
  | 'CS 4V4'
  | 'CS 1V1, 2V2'
  | 'LONE WOLF HEADSHOT'
  | 'LOST TO WIN'
  | 'LOSS TO WIN';

export interface Tournament {
  id: string;
  title: string;
  titleBn: string;
  bannerUrl: string;
  gameMode: GameMode;
  type: TournamentType;
  category?: MatchCategory | string;
  map: string;
  entryFee: number;
  prizePool: number;
  firstPrize: number;
  secondPrize: number;
  thirdPrize: number;
  fourthPrize?: number;
  fifthPrize?: number;
  perKillPrize: number;
  maxSlots: number;
  registeredCount: number;
  status: TournamentStatus;
  matchDate: string;
  matchTime: string;
  registrationDeadline: string;
  rules: string;
  rulesBn: string;
  scoringRules?: {
    killPoints: number;
    placements: Record<string, number>;
  };
  showParticipants?: boolean;
  createdBy?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface PlayerSlotInfo {
  uid?: string;
  name: string;
  freeFireUid: string;
  inGameName: string;
  phone?: string;
}

export interface TournamentRegistration {
  id: string;
  tournamentId: string;
  tournamentTitle?: string;
  matchDate?: string;
  matchTime?: string;
  userId: string;
  userName: string;
  teamId?: string;
  teamName?: string;
  type: TournamentType;
  status: 'CONFIRMED' | 'PENDING' | 'REJECTED' | 'CANCELLED';
  slotNumber: number;
  playerUids: string[];
  players: PlayerSlotInfo[];
  entryFeePaid: number;
  paymentTrxId?: string;
  createdAt: string;
}

export interface RoomCredential {
  id: string; // matches tournamentId
  tournamentId: string;
  roomId: string;
  roomPassword: string;
  releaseTime: string; // ISO string
  isPublished: boolean;
  updatedAt?: string;
}

export interface TeamMember {
  uid: string;
  name: string;
  freeFireUid?: string;
  inGameName?: string;
  role: 'LEADER' | 'CO_LEADER' | 'MEMBER';
}

export interface Team {
  id: string;
  name: string;
  tag: string;
  logoUrl?: string;
  leaderId: string;
  leaderName: string;
  memberIds: string[];
  members: TeamMember[];
  wins: number;
  matches: number;
  kills: number;
  createdAt: string;
}

export interface TeamInvitation {
  id: string;
  teamId: string;
  teamName: string;
  leaderId: string;
  invitedUserId: string;
  invitedUsername: string;
  invitedUserEmail: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  createdAt: string;
}

export type PaymentMethod = 'bKash' | 'Nagad';

export interface DepositRequest {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  method: PaymentMethod;
  amount: number;
  senderNumber?: string;
  transactionId: string;
  screenshotUrl?: string;
  status: 'PENDING' | 'APPROVED' | 'SUCCESS' | 'REJECTED';
  adminNote?: string;
  createdAt: string;
  processedAt?: string;
}

export interface WithdrawalRequest {
  id: string;
  userId: string;
  userName: string;
  inGameName?: string;
  userEmail: string;
  method: PaymentMethod;
  accountNumber: string;
  amount: number;
  deductedFromDeposited?: number;
  deductedFromWinning?: number;
  status: 'PENDING' | 'PROCESSING' | 'APPROVED' | 'PAID' | 'REJECTED';
  adminNote?: string;
  createdAt: string;
  processedAt?: string;
}

export type TransactionType = 'DEPOSIT' | 'WITHDRAWAL' | 'ENTRY_FEE' | 'PRIZE' | 'REFUND';

export interface WalletTransaction {
  id: string;
  userId: string;
  type: TransactionType;
  amount: number;
  status: 'COMPLETED' | 'PENDING' | 'REJECTED';
  referenceId?: string;
  tournamentId?: string;
  tournamentTitle?: string;
  tournamentTitleBn?: string;
  matchCategory?: string;
  placement?: number;
  kills?: number;
  killPrize?: number;
  winPrize?: number;
  reversed?: boolean;
  description: string;
  descriptionBn: string;
  balanceAfter: number;
  createdAt: string;
}

export interface TeamPlacementResult {
  placement: number;
  teamId?: string;
  teamName: string;
  playerUids: string[];
  players: PlayerSlotInfo[];
  kills: number;
  placementPoints: number;
  killPoints: number;
  totalPoints: number;
  placementPrizeWon?: number;
  killPrizeWon?: number;
  prizeWon: number;
}

export interface DistributedPrizeRecord {
  uid: string;
  playerName?: string;
  placement: number;
  kills: number;
  winPrizeCredited: number;
  killPrizeCredited: number;
  prizeCredited: number;
  winCredited: number;
  weekStartIso?: string;
  trxId?: string;
  notifId?: string;
  payoutStatus?: 'PENDING' | 'PAID';
  payoutPaidAt?: string;
  payoutPaidBy?: string;
}

export interface WinnerPayoutEntry {
  status: 'PENDING' | 'PAID';
  amount?: number;
  paidAt?: string;
  paidBy?: string;
}

export interface MatchResult {
  id: string; // matches tournamentId
  tournamentId: string;
  tournamentTitle: string;
  matchCategory?: string;
  standings: TeamPlacementResult[];
  distributedRecords?: DistributedPrizeRecord[];
  winnerPayouts?: Record<string, WinnerPayoutEntry>;
  totalDistributedAmount?: number;
  isVerified: boolean;
  isPrizeDistributed: boolean;
  publishedAt?: string;
  editedAt?: string;
  reversedAt?: string;
  createdAt: string;
}

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  titleBn: string;
  message: string;
  messageBn: string;
  type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ALERT';
  link?: string;
  read: boolean;
  createdAt: string;
}

export interface SupportTicketReply {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  message: string;
  createdAt: string;
}

export interface SupportTicket {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  subject: string;
  category: 'PAYMENT' | 'TOURNAMENT' | 'ACCOUNT' | 'REPORT_PLAYER' | 'OTHER';
  message: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  replies: SupportTicketReply[];
  createdAt: string;
  updatedAt: string;
}

export interface PlatformAnnouncement {
  id: string;
  title: string;
  titleBn: string;
  content: string;
  contentBn: string;
  priority: 'NORMAL' | 'IMPORTANT' | 'CRITICAL';
  targetType?: 'ALL_USERS' | 'TOURNAMENT';
  tournamentId?: string;
  tournamentTitle?: string;
  createdBy?: string;
  createdAt: string;
}

export interface AppSettings {
  id?: string;
  bkashNumber: string;
  bkashType: string; // 'Personal' | 'Merchant'
  nagadNumber: string;
  nagadType: string;
  supportPhone: string;
  supportWhatsapp: string;
  supportEmail: string;
  noticeBanner?: string;
  noticeBannerBn?: string;
  scoringRules: {
    killPoints: number;
    placements: Record<string, number>;
  };
  updatedAt?: string;
}

export interface AuditLogEntry {
  id: string;
  adminId: string;
  adminEmail: string;
  action: string;
  details: string;
  createdAt: string;
}
