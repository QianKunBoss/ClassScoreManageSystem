// 项目统一图标来源
// morphicons 消费 Lucide 的图标「数据」(IconNode)，而非组件。
// 用法 A（形变/数据）： import { Menu, X } from '~/utils/icons'
//                     <MorphIcon :icon="open ? X : Menu" />
// 用法 B（按名引用）： <MorphIcon name="arrow-right" />  ← 从下方 iconRegistry 解析
import {
  Menu, X, ChevronDown, ChevronUp, ChevronRight, ChevronLeft,
  Lock, GraduationCap, School, AlertTriangle, Settings, LogOut, LogIn, User,
  CircleUser, Shield, Folder, ArrowLeft, Sun, Moon, Eye, EyeOff, Bell,
  Mail, FileText, LayoutDashboard, Users, Palette, Database, Download, Upload, Check, Filter, Search,
  Plus, Trash2, Edit, Save, RefreshCw, ClipboardList, BarChart3, Home,
  Inbox, Star, BookOpen, Calendar, MapPin, Megaphone, Armchair, TrendingUp,
  Zap, Crown, UserCog, Hand, Smartphone, Ban, CircleCheck, ArrowUp,
  ArrowDown, ArrowUpDown, ArrowRight, Circle, CircleAlert, Undo, Send,
  MailOpen, CircleDot, FilePen, UserPlus, FilePlus, Info, MailCheck, KeyRound, LayoutTemplate,
} from 'lucide'

// 字符串名 → Lucide 图标数据，供 <MorphIcon name="..."> 解析
export const iconRegistry: Record<string, unknown> = {
  menu: Menu, x: X,
  'chevron-down': ChevronDown, 'chevron-up': ChevronUp,
  'chevron-right': ChevronRight, 'chevron-left': ChevronLeft,
  lock: Lock, 'graduation-cap': GraduationCap, school: School,
  'alert-triangle': AlertTriangle, settings: Settings, 'log-out': LogOut,
  user: User, 'circle-user': CircleUser, shield: Shield, folder: Folder,
  'arrow-left': ArrowLeft, sun: Sun, moon: Moon, eye: Eye, 'eye-off': EyeOff,
  bell: Bell, mail: Mail, 'file-text': FileText, 'layout-dashboard': LayoutDashboard,
  users: Users, palette: Palette, check: Check, filter: Filter, search: Search,
  plus: Plus, 'trash-2': Trash2, edit: Edit, save: Save, 'refresh-cw': RefreshCw,
  'clipboard-list': ClipboardList, 'bar-chart-3': BarChart3, home: Home,
  inbox: Inbox, star: Star, 'book-open': BookOpen, calendar: Calendar,
  'map-pin': MapPin, megaphone: Megaphone, armchair: Armchair,
  'trending-up': TrendingUp, zap: Zap, crown: Crown, 'user-cog': UserCog,
  hand: Hand, smartphone: Smartphone, ban: Ban, 'circle-check': CircleCheck,
  'arrow-up': ArrowUp, 'arrow-down': ArrowDown, 'arrow-up-down': ArrowUpDown,
  'arrow-right': ArrowRight, circle: Circle, 'circle-alert': CircleAlert,
  undo: Undo, send: Send, 'mail-open': MailOpen, 'circle-dot': CircleDot,
  'file-pen': FilePen, 'user-plus': UserPlus, 'file-plus': FilePlus, info: Info,
  'mail-check': MailCheck, 'key-round': KeyRound,
  'layout-template': LayoutTemplate,
  'database': Database, 'download': Download, 'upload': Upload,
}

export {
  Menu, X, ChevronDown, ChevronUp, ChevronRight, ChevronLeft,
  Lock, GraduationCap, School, AlertTriangle, Settings, LogOut, LogIn, User,
  CircleUser, Shield, Folder, ArrowLeft, Sun, Moon, Eye, EyeOff, Bell,
  Mail, FileText, LayoutDashboard, Users, Palette, Database, Download, Upload, Check, Filter, Search,
  Plus, Trash2, Edit, Save, RefreshCw, ClipboardList, BarChart3, Home,
  Inbox, Star, BookOpen, Calendar, MapPin, Megaphone, Armchair, TrendingUp,
  Zap, Crown, UserCog, Hand, Smartphone, Ban, CircleCheck, ArrowUp,
  ArrowDown, ArrowUpDown, ArrowRight, Circle, CircleAlert, Undo, Send,
  MailOpen, CircleDot, FilePen, UserPlus, FilePlus, MailCheck, KeyRound, LayoutTemplate,
}
