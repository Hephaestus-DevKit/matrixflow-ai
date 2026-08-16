import { cookies } from 'next/headers';
import type { Metadata } from 'next';
import { LOCALE_COOKIE } from './locale-config';
import { localizedPageTitles, type Locale } from './locale-titles';

export type SupportedLocale = Locale;
export type MetadataPage =
  'root' | 'pricing' | 'login' | 'register' | 'recover' | 'invite' | 'terms' | 'privacy';

const pageDescriptions: Record<SupportedLocale, Record<MetadataPage, string>> = {
  'zh-CN': {
    root: '面向跨境团队的 AI 内容、知识库、AI 员工与可追踪工作流平台。',
    pricing: 'MatrixFlow AI 免费测试版与候补套餐信息。',
    login: '使用 Appwrite 安全登录 MatrixFlow AI 工作台。',
    register: '创建你的 MatrixFlow AI 团队，开始验证跨境运营流程。',
    recover: '通过邮箱安全重置 MatrixFlow AI 账号密码。',
    invite: '接受邀请并加入 MatrixFlow AI 团队空间。',
    terms: 'MatrixFlow AI 服务条款。',
    privacy: 'MatrixFlow AI 隐私政策。',
  },
  'zh-TW': {
    root: '面向跨境團隊的 AI 內容、知識庫、AI 員工與可追蹤工作流平台。',
    pricing: 'MatrixFlow AI 免費測試版與候補方案資訊。',
    login: '使用 Appwrite 安全登入 MatrixFlow AI 工作台。',
    register: '建立你的 MatrixFlow AI 團隊，開始驗證跨境營運流程。',
    recover: '透過電子郵件安全重設 MatrixFlow AI 帳號密碼。',
    invite: '接受邀請並加入 MatrixFlow AI 團隊空間。',
    terms: 'MatrixFlow AI 服務條款。',
    privacy: 'MatrixFlow AI 隱私政策。',
  },
  en: {
    root: 'An AI operations workspace for cross-border teams, with grounded knowledge and traceable runs.',
    pricing: 'MatrixFlow AI free preview and paid-plan waitlist information.',
    login: 'Securely log in to the MatrixFlow AI workspace with Appwrite.',
    register: 'Create a MatrixFlow AI team and start validating cross-border operations.',
    recover: 'Securely reset your MatrixFlow AI account password by email.',
    invite: 'Accept your invitation and join a MatrixFlow AI team workspace.',
    terms: 'MatrixFlow AI terms of service.',
    privacy: 'MatrixFlow AI privacy policy.',
  },
};

export function isSupportedLocale(value: string | undefined): value is SupportedLocale {
  return value === 'zh-CN' || value === 'zh-TW' || value === 'en';
}

export async function getServerLocale(): Promise<SupportedLocale> {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isSupportedLocale(value) ? value : 'zh-CN';
}

export function pageTitle(locale: SupportedLocale, page: MetadataPage) {
  const title = localizedPageTitles[locale][page];
  return page === 'root' ? title : `${title} | MatrixFlow AI`;
}

export function pageDescription(locale: SupportedLocale, page: MetadataPage) {
  return pageDescriptions[locale][page];
}

export function localizedMetadata(
  locale: SupportedLocale,
  page: MetadataPage,
  description: string,
): Metadata {
  return {
    // The root layout supplies the `| MatrixFlow AI` template. Returning the
    // raw localized segment here prevents child routes from duplicating it.
    title: localizedPageTitles[locale][page],
    description: pageDescription(locale, page) || description,
  };
}
