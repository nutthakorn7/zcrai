/**
 * Centralized Icon System
 * Abstracts Heroicons for consistent usage across the app
 * Supports both outline (default) and solid variants
 */

import {
  // Navigation & Layout
  Squares2X2Icon,
  Bars3Icon,
  XMarkIcon,
  
  // Alerts & Security
  ExclamationTriangleIcon,
  ExclamationCircleIcon,
  ShieldCheckIcon,
  ShieldExclamationIcon,
  
  // Data & Files
  DocumentTextIcon,
  CircleStackIcon,
  ServerIcon,
  FolderIcon,
  BuildingOfficeIcon,
  
  // Actions
  Cog6ToothIcon,
  ArrowLeftStartOnRectangleIcon,
  ArrowPathIcon,
  PlusIcon,
  TrashIcon,
  PencilIcon,
  LockClosedIcon,
  KeyIcon,
  
  // Users & Social
  UsersIcon,
  UserIcon,
  UserCircleIcon,
  
  // Charts & Analytics
  ChartBarIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ArrowUpRightIcon,
  
  // Time & Calendar
  CalendarIcon,
  ClockIcon,
  
  // UI Elements
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  EyeIcon,
  EyeSlashIcon,
  ArrowLeftIcon,
  DocumentArrowDownIcon,
  
  // Status
  CheckCircleIcon,
  XCircleIcon,
  InformationCircleIcon,
  
  // Communication
  BellIcon,
  ChatBubbleLeftRightIcon,
  EnvelopeIcon,
  
  // System
  CommandLineIcon,
  CpuChipIcon,
  SignalIcon,
  GlobeAltIcon,
  WrenchIcon
} from '@heroicons/react/24/outline';

import {
  Squares2X2Icon as Squares2X2IconSolid,
  ShieldCheckIcon as ShieldCheckIconSolid,
  ExclamationTriangleIcon as ExclamationTriangleIconSolid,
  CheckCircleIcon as CheckCircleIconSolid,
  XCircleIcon as XCircleIconSolid,
} from '@heroicons/react/24/solid';

export type IconVariant = 'outline' | 'solid';

export interface IconProps {
  className?: string;
  'aria-hidden'?: boolean;
}

/**
 * Icon Library - Outline (Default)
 */
export const Icon = {
  // Navigation
  Dashboard: Squares2X2Icon,
  Menu: Bars3Icon,
  Close: XMarkIcon,
  
  // Alerts & Security
  Alert: ExclamationTriangleIcon,
  AlertCircle: ExclamationCircleIcon,
  Shield: ShieldCheckIcon,
  ShieldAlert: ShieldExclamationIcon,
  
  // Data
  Document: DocumentTextIcon,
  Database: CircleStackIcon,
  Server: ServerIcon,
  Folder: FolderIcon,
  Building: BuildingOfficeIcon,
  
  
  // Actions
  Settings: Cog6ToothIcon,
  Logout: ArrowLeftStartOnRectangleIcon,
  Refresh: ArrowPathIcon,
  Add: PlusIcon,
  Delete: TrashIcon,
  Edit: PencilIcon,
  Lock: LockClosedIcon,
  Key: KeyIcon,
  
  // Users
  Users: UsersIcon,
  User: UserIcon,
  UserCircle: UserCircleIcon,
  
  // Charts
  Chart: ChartBarIcon,
  TrendingUp: ArrowTrendingUpIcon,
  TrendingDown: ArrowTrendingDownIcon,
  ArrowUpRight: ArrowUpRightIcon,
  
  // Time
  Calendar: CalendarIcon,
  Clock: ClockIcon,
  
  // UI
  ChevronLeft: ChevronLeftIcon,
  ChevronRight: ChevronRightIcon,
  ChevronUp: ChevronUpIcon,
  ChevronDown: ChevronDownIcon,
  Search: MagnifyingGlassIcon,
  Filter: FunnelIcon,
  Eye: EyeIcon,
  EyeSlash: EyeSlashIcon,
  ArrowLeft: ArrowLeftIcon,
  FileText: DocumentArrowDownIcon,
  
  // Status
  CheckCircle: CheckCircleIcon,
  XCircle: XCircleIcon,
  Info: InformationCircleIcon,
  
  // Communication
  Bell: BellIcon,
  Chat: ChatBubbleLeftRightIcon,
  Mail: EnvelopeIcon,
  
  // System
  Terminal: CommandLineIcon,
  Cpu: CpuChipIcon,
  Signal: SignalIcon,
  Global: GlobeAltIcon,
  Wrench: WrenchIcon
} as const;

/**
 * Icon Library - Solid Variants
 */
export const IconSolid = {
  Dashboard: Squares2X2IconSolid,
  Shield: ShieldCheckIconSolid,
  Alert: ExclamationTriangleIconSolid,
  CheckCircle: CheckCircleIconSolid,
  XCircle: XCircleIconSolid,
  Info: InformationCircleIcon,
} as const;

/**
 * Icon size presets (Notion-style)
 */
export const iconSizes = {
  xs: 'w-3 h-3',
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
  xl: 'w-8 h-8',
} as const;

export type IconSize = keyof typeof iconSizes;
