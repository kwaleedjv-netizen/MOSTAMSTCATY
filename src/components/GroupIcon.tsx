import React from 'react';
import {
  Folder,
  User,
  Users,
  Briefcase,
  GraduationCap,
  CreditCard,
  Home,
  Shield,
  IdCard,
  FileText,
  Landmark,
  Building2,
  Car,
  Plane,
  Heart,
  Stethoscope,
  Wallet,
  BookOpen,
  Award,
  Key,
  Scale,
  Globe,
  Star,
  Archive,
} from 'lucide-react';

export interface SystemGroupIconOption {
  id: string;
  label: string;
  component: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
}

export const SYSTEM_GROUP_ICONS: SystemGroupIconOption[] = [
  { id: 'Folder', label: 'مجلد عام', component: Folder },
  { id: 'User', label: 'شخصي', component: User },
  { id: 'Users', label: 'عائلي', component: Users },
  { id: 'Briefcase', label: 'وظيفي / عمل', component: Briefcase },
  { id: 'GraduationCap', label: 'دراسي / تعليمي', component: GraduationCap },
  { id: 'CreditCard', label: 'مالي / بطاقات', component: CreditCard },
  { id: 'Home', label: 'عقاري / سكن', component: Home },
  { id: 'IdCard', label: 'هويات رسمية', component: IdCard },
  { id: 'FileText', label: 'وثائق ومستندات', component: FileText },
  { id: 'Shield', label: 'أمني / محمي', component: Shield },
  { id: 'Landmark', label: 'دوائر حكومية', component: Landmark },
  { id: 'Building2', label: 'شركات ومؤسسات', component: Building2 },
  { id: 'Car', label: 'مركبات وقيادة', component: Car },
  { id: 'Plane', label: 'سفر وجوازات', component: Plane },
  { id: 'Heart', label: 'صحي وعائلي', component: Heart },
  { id: 'Stethoscope', label: 'تقارير طبية', component: Stethoscope },
  { id: 'Wallet', label: 'محفظة وحسابات', component: Wallet },
  { id: 'BookOpen', label: 'سجلات وشهادات', component: BookOpen },
  { id: 'Award', label: 'شهادات وتقدير', component: Award },
  { id: 'Key', label: 'تراخيص ومفاتيح', component: Key },
  { id: 'Scale', label: 'قانوني ووكالات', component: Scale },
  { id: 'Globe', label: 'معاملات دولية', component: Globe },
  { id: 'Star', label: 'مهم / مميز', component: Star },
  { id: 'Archive', label: 'أرشيف خاص', component: Archive },
];

const SYSTEM_ICON_MAP: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> =
  Object.fromEntries(SYSTEM_GROUP_ICONS.map((item) => [item.id, item.component]));

export function isCustomImageIcon(icon?: string): boolean {
  return Boolean(icon && (icon.startsWith('data:image/') || icon.startsWith('http://') || icon.startsWith('https://')));
}

export function isCustomEmojiIcon(icon?: string): boolean {
  return Boolean(icon && icon.startsWith('emoji:'));
}

interface GroupIconProps {
  icon?: string;
  color?: string;
  className?: string;
}

export const GroupIcon: React.FC<GroupIconProps> = ({ icon, color = '#2563eb', className = 'w-4 h-4' }) => {
  if (isCustomImageIcon(icon)) {
    return (
      <img
        src={icon}
        alt=""
        className={`${className} rounded-sm object-cover shrink-0`}
      />
    );
  }

  if (isCustomEmojiIcon(icon)) {
    return (
      <span className={`${className} inline-flex items-center justify-center leading-none text-sm shrink-0`}>
        {icon!.slice(6)}
      </span>
    );
  }

  const IconComponent = (icon && SYSTEM_ICON_MAP[icon]) || Folder;
  return <IconComponent className={`${className} shrink-0`} style={{ color }} />;
};
