import {
  Bot,
  CreditCard,
  Factory,
  FolderOpen,
  GitFork,
  LayoutDashboard,
  LineChart,
  MessageSquare,
  Settings,
  Store,
  type LucideIcon,
} from 'lucide-react';
import type { Route } from 'next';
import type { MessageKey } from '@/lib/i18n';

export interface DashboardNavigationItem {
  href: Route;
  icon: LucideIcon;
  label: string;
  description: string;
  labelKey: MessageKey;
  descriptionKey: MessageKey;
}

export interface DashboardNavigationGroup {
  label: string;
  items: DashboardNavigationItem[];
  labelKey: MessageKey;
}

export const DASHBOARD_NAVIGATION: DashboardNavigationGroup[] = [
  {
    label: '工作台',
    labelKey: 'dashboard.group.workspace',
    items: [
      {
        href: '/dashboard',
        icon: LayoutDashboard,
        label: '总览',
        description: '团队运行概况',
        labelKey: 'dashboard.overview',
        descriptionKey: 'dashboard.overviewDescription',
      },
      {
        href: '/dashboard/agents',
        icon: Bot,
        label: 'AI 员工',
        description: '角色与技能管理',
        labelKey: 'dashboard.agents',
        descriptionKey: 'dashboard.agentsDescription',
      },
      {
        href: '/dashboard/content',
        icon: Factory,
        label: '内容工厂',
        description: '批量内容生产',
        labelKey: 'dashboard.content',
        descriptionKey: 'dashboard.contentDescription',
      },
      {
        href: '/dashboard/knowledge',
        icon: FolderOpen,
        label: '知识库',
        description: '企业知识与 RAG',
        labelKey: 'dashboard.knowledge',
        descriptionKey: 'dashboard.knowledgeDescription',
      },
      {
        href: '/dashboard/workflows',
        icon: GitFork,
        label: '工作流',
        description: '自动化流程编排',
        labelKey: 'dashboard.workflows',
        descriptionKey: 'dashboard.workflowsDescription',
      },
    ],
  },
  {
    label: '增长与管理',
    labelKey: 'dashboard.group.growth',
    items: [
      {
        href: '/dashboard/crm',
        icon: MessageSquare,
        label: '智能 CRM',
        description: '客户和线索',
        labelKey: 'dashboard.crm',
        descriptionKey: 'dashboard.crmDescription',
      },
      {
        href: '/dashboard/marketplace',
        icon: Store,
        label: '模板市场',
        description: '能力模板生态',
        labelKey: 'dashboard.marketplace',
        descriptionKey: 'dashboard.marketplaceDescription',
      },
      {
        href: '/dashboard/analytics',
        icon: LineChart,
        label: '数据看板',
        description: '用量和趋势',
        labelKey: 'dashboard.analytics',
        descriptionKey: 'dashboard.analyticsDescription',
      },
      {
        href: '/dashboard/billing',
        icon: CreditCard,
        label: '计费套餐',
        description: '订阅和额度',
        labelKey: 'dashboard.billing',
        descriptionKey: 'dashboard.billingDescription',
      },
      {
        href: '/dashboard/settings',
        icon: Settings,
        label: '设置',
        description: '账号与组织',
        labelKey: 'dashboard.settings',
        descriptionKey: 'dashboard.settingsDescription',
      },
    ],
  },
];

export const DASHBOARD_ITEMS = DASHBOARD_NAVIGATION.flatMap((group) => group.items);

export function navigationItemForPath(pathname: string): DashboardNavigationItem {
  return (
    [...DASHBOARD_ITEMS]
      .sort((a, b) => b.href.length - a.href.length)
      .find(
        (item) =>
          pathname === item.href ||
          (item.href !== '/dashboard' && pathname.startsWith(`${item.href}/`)),
      ) ?? DASHBOARD_ITEMS[0]
  );
}
