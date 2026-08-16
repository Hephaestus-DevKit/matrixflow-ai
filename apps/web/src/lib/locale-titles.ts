export type Locale = 'zh-CN' | 'zh-TW' | 'en';

export const localizedPageTitles: Record<Locale, Record<string, string>> = {
  'zh-CN': {
    root: 'MatrixFlow AI — AI 员工操作系统',
    pricing: '定价',
    login: '登录',
    register: '注册',
    recover: '重置密码',
    invite: '团队邀请',
    terms: '服务条款',
    privacy: '隐私政策',
    dashboard: '工作台',
    agents: 'AI 员工',
    agentDetail: 'AI 员工详情',
    agentNew: '部署 AI 员工',
    content: '内容工厂',
    contentNew: '新建内容项目',
    knowledge: '知识库',
    knowledgeDetail: '知识库详情',
    knowledgeNew: '新建知识库',
    workflows: '工作流',
    workflowDetail: '工作流编辑器',
    workflowRuns: '运行记录',
    workflowNew: '新建工作流',
    crm: '智能 CRM',
    crmDetail: '客户详情',
    analytics: '数据看板',
    billing: '计费套餐',
    marketplace: '模板市场',
    marketplaceDetail: '模板详情',
    purchased: '已购模板',
    settings: '设置',
    admin: '管理中心',
    notFound: '页面不存在',
  },
  'zh-TW': {
    root: 'MatrixFlow AI — AI 員工作業系統',
    pricing: '定價',
    login: '登入',
    register: '註冊',
    recover: '重設密碼',
    invite: '團隊邀請',
    terms: '服務條款',
    privacy: '隱私政策',
    dashboard: '工作台',
    agents: 'AI 員工',
    agentDetail: 'AI 員工詳情',
    agentNew: '部署 AI 員工',
    content: '內容工廠',
    contentNew: '建立內容專案',
    knowledge: '知識庫',
    knowledgeDetail: '知識庫詳情',
    knowledgeNew: '建立知識庫',
    workflows: '工作流',
    workflowDetail: '工作流編輯器',
    workflowRuns: '執行記錄',
    workflowNew: '建立工作流',
    crm: '智慧 CRM',
    crmDetail: '客戶詳情',
    analytics: '資料看板',
    billing: '計費方案',
    marketplace: '範本市集',
    marketplaceDetail: '範本詳情',
    purchased: '已購範本',
    settings: '設定',
    admin: '管理中心',
    notFound: '頁面不存在',
  },
  en: {
    root: 'MatrixFlow AI — AI Workforce OS',
    pricing: 'Pricing',
    login: 'Log in',
    register: 'Sign up',
    recover: 'Reset password',
    invite: 'Team invitation',
    terms: 'Terms',
    privacy: 'Privacy',
    dashboard: 'Workspace',
    agents: 'AI workforce',
    agentDetail: 'AI workforce member',
    agentNew: 'Deploy AI workforce member',
    content: 'Content factory',
    contentNew: 'New content project',
    knowledge: 'Knowledge base',
    knowledgeDetail: 'Knowledge base details',
    knowledgeNew: 'New knowledge base',
    workflows: 'Workflows',
    workflowDetail: 'Workflow editor',
    workflowRuns: 'Run history',
    workflowNew: 'New workflow',
    crm: 'Smart CRM',
    crmDetail: 'Customer details',
    analytics: 'Analytics',
    billing: 'Plans and billing',
    marketplace: 'Template marketplace',
    marketplaceDetail: 'Template details',
    purchased: 'Purchased templates',
    settings: 'Settings',
    admin: 'Administration',
    notFound: 'Page not found',
  },
};

export function localizedPageTitle(pathname: string, locale: Locale) {
  const titles = localizedPageTitles[locale];
  if (pathname === '/') return titles.root;
  if (pathname === '/pricing') return `${titles.pricing} | MatrixFlow AI`;
  if (pathname === '/login') return `${titles.login} | MatrixFlow AI`;
  if (pathname === '/register') return `${titles.register} | MatrixFlow AI`;
  if (pathname === '/recover') return `${titles.recover} | MatrixFlow AI`;
  if (pathname === '/invite') return `${titles.invite} | MatrixFlow AI`;
  if (pathname === '/terms') return `${titles.terms} | MatrixFlow AI`;
  if (pathname === '/privacy') return `${titles.privacy} | MatrixFlow AI`;
  if (pathname === '/dashboard') return `${titles.dashboard} | MatrixFlow AI`;
  if (pathname === '/dashboard/agents') return `${titles.agents} | MatrixFlow AI`;
  if (pathname === '/dashboard/agents/new') return `${titles.agentNew} | MatrixFlow AI`;
  if (pathname.startsWith('/dashboard/agents/')) return `${titles.agentDetail} | MatrixFlow AI`;
  if (pathname === '/dashboard/content') return `${titles.content} | MatrixFlow AI`;
  if (pathname === '/dashboard/content/new') return `${titles.contentNew} | MatrixFlow AI`;
  if (pathname === '/dashboard/knowledge') return `${titles.knowledge} | MatrixFlow AI`;
  if (pathname === '/dashboard/knowledge/new') return `${titles.knowledgeNew} | MatrixFlow AI`;
  if (pathname.startsWith('/dashboard/knowledge/'))
    return `${titles.knowledgeDetail} | MatrixFlow AI`;
  if (pathname === '/dashboard/workflows') return `${titles.workflows} | MatrixFlow AI`;
  if (pathname === '/dashboard/workflows/new') return `${titles.workflowNew} | MatrixFlow AI`;
  if (pathname.endsWith('/runs') && pathname.startsWith('/dashboard/workflows/'))
    return `${titles.workflowRuns} | MatrixFlow AI`;
  if (pathname.startsWith('/dashboard/workflows/'))
    return `${titles.workflowDetail} | MatrixFlow AI`;
  if (pathname === '/dashboard/crm') return `${titles.crm} | MatrixFlow AI`;
  if (pathname.startsWith('/dashboard/crm/')) return `${titles.crmDetail} | MatrixFlow AI`;
  if (pathname === '/dashboard/analytics') return `${titles.analytics} | MatrixFlow AI`;
  if (pathname === '/dashboard/billing') return `${titles.billing} | MatrixFlow AI`;
  if (pathname === '/dashboard/marketplace') return `${titles.marketplace} | MatrixFlow AI`;
  if (pathname === '/dashboard/marketplace/purchased') return `${titles.purchased} | MatrixFlow AI`;
  if (pathname.startsWith('/dashboard/marketplace/'))
    return `${titles.marketplaceDetail} | MatrixFlow AI`;
  if (pathname === '/dashboard/settings') return `${titles.settings} | MatrixFlow AI`;
  if (pathname.startsWith('/dashboard/admin')) return `${titles.admin} | MatrixFlow AI`;
  return `${titles.notFound} | MatrixFlow AI`;
}
