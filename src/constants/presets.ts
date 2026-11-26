import { StandardDocumentPreset, PaperPreset, UnitType, DocumentGroup } from '../types';

export const DOCUMENT_PRESETS: StandardDocumentPreset[] = [
  {
    id: 'unified_id',
    nameAr: 'بطاقة الهوية الموحدة',
    nameEn: 'Unified National ID',
    widthMm: 85.6,
    heightMm: 54,
    defaultOrientation: 'landscape',
    defaultSides: 2,
    frontLabel: 'الوجه الأمامي',
    backLabel: 'الوجه الخلفي',
    defaultRadiusMm: 3.18,
    description: 'بطاقة الهوية الوطنية الموحدة الرسمية (قياس ID-1)',
    category: 'id',
    icon: 'IdCard',
  },
  {
    id: 'voter_card',
    nameAr: 'بطاقة الناخب',
    nameEn: 'Voter Card',
    widthMm: 85.6,
    heightMm: 54,
    defaultOrientation: 'landscape',
    defaultSides: 2,
    frontLabel: 'الوجه الأمامي (الصورة والبيانات)',
    backLabel: 'الوجه الخلفي (الباركود والرمز)',
    defaultRadiusMm: 3.18,
    description: 'البطاقة البايومترية للمفوضية العليا للانتخابات',
    category: 'official',
    icon: 'Vote',
  },
  {
    id: 'driving_license',
    nameAr: 'إجازة القيادة',
    nameEn: 'Driving License',
    widthMm: 85.6,
    heightMm: 54,
    defaultOrientation: 'landscape',
    defaultSides: 2,
    frontLabel: 'الوجه الأمامي (بيانات السائق)',
    backLabel: 'الوجه الخلفي (فئات المركبات)',
    defaultRadiusMm: 3.18,
    description: 'إجازة السوق القياسية الدولية والمحلية',
    category: 'official',
    icon: 'Car',
  },
  {
    id: 'covid_vaccine',
    nameAr: 'بطاقة تلقيح كوفيد',
    nameEn: 'COVID Vaccination Card',
    widthMm: 85.6,
    heightMm: 54,
    defaultOrientation: 'landscape',
    defaultSides: 2,
    frontLabel: 'الوجه الأمامي (معلومات اللقاح)',
    backLabel: 'الوجه الخلفي (رمز QR)',
    defaultRadiusMm: 3.18,
    description: 'شهادة التطعيم واللقاح الدولية',
    category: 'official',
    icon: 'ShieldAlert',
  },
  {
    id: 'passport',
    nameAr: 'جواز السفر',
    nameEn: 'Passport',
    widthMm: 125,
    heightMm: 88,
    defaultOrientation: 'landscape',
    defaultSides: 1,
    frontLabel: 'صفحة البيانات الرئيسية',
    backLabel: 'صفحة التمديد أو التأشيرات',
    defaultRadiusMm: 2,
    description: 'جواز السفر الإلكتروني القياسي (قياس ID-3)',
    category: 'travel',
    icon: 'BookOpen',
  },
  {
    id: 'ration_card_new',
    nameAr: 'البطاقة التموينية (الإصدار الجديد)',
    nameEn: 'Ration Card (New Edition)',
    widthMm: 85.6,
    heightMm: 54,
    defaultOrientation: 'landscape',
    defaultSides: 2,
    frontLabel: 'الوجه الأمامي',
    backLabel: 'الوجه الخلفي',
    defaultRadiusMm: 3.18,
    description: 'البطاقة التموينية الإلكترونية الذكية الجديدة',
    category: 'official',
    icon: 'CreditCard',
  },
  {
    id: 'ration_card_old',
    nameAr: 'البطاقة التموينية (الإصدار القديم)',
    nameEn: 'Ration Card (Old Edition)',
    widthMm: 210,
    heightMm: 80,
    defaultOrientation: 'landscape',
    defaultSides: 2,
    frontLabel: 'الوجه الأمامي (بيانات العائلة)',
    backLabel: 'الوجه الخلفي (القسائم التموينية)',
    defaultRadiusMm: 1,
    description: 'دفتر البطاقة التموينية الورقي التقليدي',
    category: 'official',
    icon: 'FileSpreadsheet',
  },
  {
    id: 'property_deed_new',
    nameAr: 'سند المنزل (الإصدار الجديد)',
    nameEn: 'Property Deed (New Smart)',
    widthMm: 85.6,
    heightMm: 54,
    defaultOrientation: 'landscape',
    defaultSides: 2,
    frontLabel: 'الوجه الأمامي (بيانات العقار)',
    backLabel: 'الوجه الخلفي (الرمز الإلكتروني)',
    defaultRadiusMm: 3.18,
    description: 'السند العقاري الذكي والبطاقة العقارية الحديثة',
    category: 'property',
    icon: 'Home',
  },
  {
    id: 'property_deed_old',
    nameAr: 'سند المنزل (الإصدار القديم)',
    nameEn: 'Property Deed (Old A4)',
    widthMm: 210,
    heightMm: 297,
    defaultOrientation: 'portrait',
    defaultSides: 1,
    frontLabel: 'السند العقاري الكامل',
    backLabel: 'المخطط الهندسي الخلفي',
    defaultRadiusMm: 0,
    description: 'السند العقاري الورقي القديم (قياس ورقة A4 كاملة)',
    category: 'property',
    icon: 'FileText',
  },
  {
    id: 'residence_card_new',
    nameAr: 'بطاقة السكن (الإصدار الجديد)',
    nameEn: 'Residence Card (New)',
    widthMm: 85.6,
    heightMm: 54,
    defaultOrientation: 'landscape',
    defaultSides: 2,
    frontLabel: 'الوجه الأمامي (العنوان والاسم)',
    backLabel: 'الوجه الخلفي (بيانات المركز والمختار)',
    defaultRadiusMm: 3.18,
    description: 'بطاقة السكن الإلكترونية الحديثة (قابلة لتعديل الأبعاد)',
    category: 'official',
    icon: 'MapPin',
  },
  {
    id: 'residence_card_old',
    nameAr: 'بطاقة السكن (الإصدار القديم)',
    nameEn: 'Residence Card (Old)',
    widthMm: 85.6,
    heightMm: 54,
    defaultOrientation: 'landscape',
    defaultSides: 2,
    frontLabel: 'الوجه الأمامي',
    backLabel: 'الوجه الخلفي',
    defaultRadiusMm: 2,
    description: 'بطاقة السكن المقواة التقليدية',
    category: 'official',
    icon: 'Navigation',
  },
  {
    id: 'weapon_permit',
    nameAr: 'إجازة حمل السلاح',
    nameEn: 'Firearm License',
    widthMm: 85.6,
    heightMm: 54,
    defaultOrientation: 'landscape',
    defaultSides: 2,
    frontLabel: 'الوجه الأمامي (البيانات والصورة)',
    backLabel: 'الوجه الخلفي (بيانات السلاح والرقم)',
    defaultRadiusMm: 3.18,
    description: 'إجازة حيازة وحمل السلاح الرسمية الصادرة من وزارة الداخلية',
    category: 'official',
    icon: 'Crosshair',
  },
  {
    id: 'salary_card',
    nameAr: 'بطاقة الراتب',
    nameEn: 'Salary Card',
    widthMm: 85.6,
    heightMm: 54,
    defaultOrientation: 'landscape',
    defaultSides: 2,
    frontLabel: 'الوجه الأمامي (كي كارد / الماستر)',
    backLabel: 'الوجه الخلفي (الشريط والرمز)',
    defaultRadiusMm: 3.18,
    description: 'بطاقة استلام الرواتب والمستحقات الوظيفية والتقاعدية',
    category: 'financial',
    icon: 'Briefcase',
  },
  {
    id: 'bank_card',
    nameAr: 'بطاقة البنك',
    nameEn: 'Bank / Debit Card',
    widthMm: 85.6,
    heightMm: 54,
    defaultOrientation: 'landscape',
    defaultSides: 2,
    frontLabel: 'الوجه الأمامي (رقم الحساب)',
    backLabel: 'الوجه الخلفي (رمز CVV والتوقيع)',
    defaultRadiusMm: 3.18,
    description: 'بطاقة الصراف الآلي والفيزا والماستركارد البنكية',
    category: 'financial',
    icon: 'Wallet',
  },
  {
    id: 'passport_photo',
    nameAr: 'صورة جواز السفر',
    nameEn: 'Passport Photo',
    widthMm: 35,
    heightMm: 45,
    defaultOrientation: 'portrait',
    defaultSides: 1,
    frontLabel: 'الصورة الشخصية الرسمية',
    backLabel: 'خلفية الصورة',
    defaultRadiusMm: 0,
    description: 'الصورة الشخصية القياسية للمعاملات وجوازات السفر (35×45 mm)',
    category: 'id',
    icon: 'User',
  },
  {
    id: 'custom',
    nameAr: 'مستمسك مخصص',
    nameEn: 'Custom Document',
    widthMm: 85.6,
    heightMm: 54,
    defaultOrientation: 'landscape',
    defaultSides: 2,
    frontLabel: 'الوجه الأول',
    backLabel: 'الوجه الثاني',
    defaultRadiusMm: 3,
    description: 'تحديد أبعاد وقياسات مخصصة بوحدات mm أو cm أو inch أو px',
    category: 'custom',
    icon: 'SlidersHorizontal',
  },
];

export const PAPER_PRESETS: PaperPreset[] = [
  { id: 'a4', name: 'A4 (210 × 297 mm)', widthMm: 210, heightMm: 297 },
  { id: 'a3', name: 'A3 (297 × 420 mm)', widthMm: 297, heightMm: 420 },
  { id: 'a5', name: 'A5 (148 × 210 mm)', widthMm: 148, heightMm: 210 },
  { id: 'a6', name: 'A6 (105 × 148 mm)', widthMm: 105, heightMm: 148 },
  { id: 'a2', name: 'A2 (420 × 594 mm)', widthMm: 420, heightMm: 594 },
  { id: 'a1', name: 'A1 (594 × 841 mm)', widthMm: 594, heightMm: 841 },
  { id: 'a0', name: 'A0 (841 × 1189 mm)', widthMm: 841, heightMm: 1189 },
  { id: 'letter', name: 'Letter (215.9 × 279.4 mm)', widthMm: 215.9, heightMm: 279.4 },
  { id: 'legal', name: 'Legal (215.9 × 355.6 mm)', widthMm: 215.9, heightMm: 355.6 },
  { id: 'custom', name: 'قياس مخصص (Custom)', widthMm: 210, heightMm: 297 },
];

export const DEFAULT_GROUPS: Omit<DocumentGroup, 'createdAt' | 'updatedAt'>[] = [
  {
    id: 'grp_personal',
    name: 'مستمسكات شخصية',
    color: '#3b82f6',
    icon: 'User',
    description: 'الهوية الموحدة، جواز السفر، إجازة القيادة، الصور الشخصية',
    isLocked: false,
  },
  {
    id: 'grp_family',
    name: 'مستمسكات عائلية',
    color: '#10b981',
    icon: 'Users',
    description: 'البطاقة التموينية، بطاقة السكن، عقود الزواج، وثائق الأولاد',
    isLocked: false,
  },
  {
    id: 'grp_job',
    name: 'مستمسكات وظيفية',
    color: '#f59e0b',
    icon: 'Briefcase',
    description: 'بطاقة الراتب، هويات الدائرة، كتب التعيين والعلاوات',
    isLocked: false,
  },
  {
    id: 'grp_academic',
    name: 'مستمسكات دراسية',
    color: '#8b5cf6',
    icon: 'GraduationCap',
    description: 'الشهادات المدرسية والجامعية والجداريات والوثائق المصدقة',
    isLocked: false,
  },
  {
    id: 'grp_financial',
    name: 'مستمسكات مالية',
    color: '#06b6d4',
    icon: 'CreditCard',
    description: 'بطاقات الصراف، كشوفات الحساب، الوثائق الضريبية',
    isLocked: false,
  },
  {
    id: 'grp_property',
    name: 'مستمسكات عقارية',
    color: '#ec4899',
    icon: 'Home',
    description: 'سندات الدور والأراضي والمزارع وعقود الإيجار والخرائط',
    isLocked: false,
  },
  {
    id: 'grp_other',
    name: 'مستمسكات أخرى',
    color: '#64748b',
    icon: 'Folder',
    description: 'وكالات عامة وخاصة، مذكرات، ووثائق متنوعة',
    isLocked: false,
  },
];

/**
 * Physical Units Conversion Engine
 * 1 cm = 10 mm
 * 1 inch = 25.4 mm
 * 1 px = (px / DPI) * 25.4 mm
 */
export function convertToMm(value: number, unit: UnitType, dpi: number = 300): number {
  if (isNaN(value) || value <= 0) return 0;
  switch (unit) {
    case 'mm':
      return value;
    case 'cm':
      return value * 10;
    case 'inch':
      return value * 25.4;
    case 'px':
      return (value / dpi) * 25.4;
    default:
      return value;
  }
}

export function convertFromMm(mmValue: number, toUnit: UnitType, dpi: number = 300): number {
  if (isNaN(mmValue) || mmValue <= 0) return 0;
  switch (toUnit) {
    case 'mm':
      return Number(mmValue.toFixed(2));
    case 'cm':
      return Number((mmValue / 10).toFixed(3));
    case 'inch':
      return Number((mmValue / 25.4).toFixed(3));
    case 'px':
      return Math.round((mmValue / 25.4) * dpi);
    default:
      return mmValue;
  }
}
