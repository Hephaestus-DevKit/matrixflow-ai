'use client';

import type { ReactNode } from 'react';
import { LegalPage } from '@/components/legal-page';
import { useLocale, type Locale } from '@/lib/i18n';

const COPY: Record<Locale, { privacy: ReactNode; terms: ReactNode }> = {
  'zh-CN': {
    privacy: (
      <>
        <section>
          <h2>1. 适用范围</h2>
          <p>
            本政策说明 MatrixFlow AI 在账号注册、团队协作、文件处理和 AI
            功能中如何处理信息。当前产品处于公开测试阶段。
          </p>
        </section>
        <section>
          <h2>2. 我们处理的信息</h2>
          <ul>
            <li>账号信息：邮箱、显示名称、邮箱验证状态和团队成员关系。</li>
            <li>业务内容：你主动提交的商品资料、提示词、工作流、客户记录和知识库文件。</li>
            <li>运行信息：调用次数、Token 用量、执行状态、错误信息与必要的安全审计事件。</li>
          </ul>
        </section>
        <section>
          <h2>3. 使用目的与处理方式</h2>
          <p>
            上述信息仅用于提供身份验证、组织隔离、内容生成、知识检索、工作流执行、安全防护和故障排查。AI
            请求会在 Appwrite Function 中处理；模型密钥不会发送至浏览器。我们还会使用 Vercel
            Analytics 与 Speed Insights
            记录匿名的页面使用和性能指标。启用第三方模型前，项目维护方应评估对应供应商的数据政策。
          </p>
        </section>
        <section>
          <h2>4. 存储、共享与保留</h2>
          <p>
            账号、业务数据和文件存储于配置的 Appwrite Cloud 项目。除提供服务所必需的基础设施与所选
            AI
            模型供应商外，我们不会出售业务数据。数据在账号或团队存续期间保留；删除能力覆盖的资源会在请求完成后从活动数据中移除，备份副本可能按照基础设施周期延迟清除。
          </p>
        </section>
        <section>
          <h2>5. 你的选择</h2>
          <p>
            你可以在产品中修改个人资料、删除支持删除的资源，或通过 GitHub 仓库的 Security/Issue
            渠道申请数据导出、账号或团队数据删除。请求前需要完成身份和权限验证。
          </p>
        </section>
        <section>
          <h2>6. 安全与未成年人</h2>
          <p>
            我们使用团队权限、行级权限、服务端校验、加密存储、审计与速率限制保护数据。本服务不面向未满
            18 周岁的用户，也不应上传支付卡、政府证件、密码或其他非业务所必需的高度敏感信息。
          </p>
        </section>
        <section>
          <h2>7. 联系与变更</h2>
          <p>
            安全问题请使用 GitHub Security 私密报告；一般隐私请求可通过仓库 Issue
            提交。重大变更会更新本页日期，并在必要时于产品内提示。
          </p>
        </section>
      </>
    ),
    terms: (
      <>
        <section>
          <h2>1. 服务说明</h2>
          <p>
            MatrixFlow AI 提供团队化的 AI 内容生成、知识库、AI
            员工与工作流工具。当前为测试版本，标记为“预览”“即将开放”或“连接器未配置”的功能不构成可用性承诺。
          </p>
        </section>
        <section>
          <h2>2. 账号与团队责任</h2>
          <p>
            你应提供真实可用的邮箱，妥善保护账号凭据，并对团队成员授权和团队空间中的操作负责。不得绕过权限、额度、速率限制或安全控制。
          </p>
        </section>
        <section>
          <h2>3. 可接受使用</h2>
          <ul>
            <li>不得生成、上传或传播违法、侵权、欺诈、恶意软件或骚扰内容。</li>
            <li>不得上传无权处理的个人信息、商业秘密或受版权保护的材料。</li>
            <li>不得将 AI 输出直接用于高风险决策；发布前应由具备业务知识的人员复核。</li>
          </ul>
        </section>
        <section>
          <h2>4. 内容与 AI 输出</h2>
          <p>
            你保留对合法提交内容的权利，并授权系统在提供服务所需范围内处理这些内容。AI
            输出可能不准确、不完整或与第三方内容相似；你负责核验事实、权利和适用规则。
          </p>
        </section>
        <section>
          <h2>5. 费用与测试额度</h2>
          <p>
            当前免费测试额度受产品内显示的限制约束。付费结账尚未开放，任何展示的付费方案均为候补信息，不会在未明确确认订单与付款前产生扣款。
          </p>
        </section>
        <section>
          <h2>6. 可用性与责任限制</h2>
          <p>
            测试服务按现状提供，可能调整、暂停或出现错误。对因未经复核的 AI
            输出、第三方服务中断、错误配置或超出授权的使用造成的损失，项目维护方在法律允许范围内不承担间接或后果性责任。
          </p>
        </section>
        <section>
          <h2>7. 暂停、终止与变更</h2>
          <p>
            对滥用、安全风险或违反条款的账号可限制或终止服务。条款更新时会修改生效日期；继续使用即表示接受更新后的条款。
          </p>
        </section>
      </>
    ),
  },
  'zh-TW': {
    privacy: (
      <>
        <section>
          <h2>1. 適用範圍</h2>
          <p>
            本政策說明 MatrixFlow AI 在帳號註冊、團隊協作、檔案處理與 AI
            功能中如何處理資訊。目前產品處於公開測試階段。
          </p>
        </section>
        <section>
          <h2>2. 我們處理的資訊</h2>
          <ul>
            <li>帳號資訊：電子郵件、顯示名稱、電子郵件驗證狀態與團隊成員關係。</li>
            <li>業務內容：你主動提交的商品資料、提示詞、工作流、客戶記錄與知識庫檔案。</li>
            <li>執行資訊：呼叫次數、Token 用量、執行狀態、錯誤資訊與必要的安全稽核事件。</li>
          </ul>
        </section>
        <section>
          <h2>3. 使用目的與處理方式</h2>
          <p>
            上述資訊僅用於提供身分驗證、組織隔離、內容生成、知識檢索、工作流執行、安全防護與故障排查。AI
            請求會在 Appwrite Function 中處理；模型金鑰不會傳送至瀏覽器。我們也會使用 Vercel
            Analytics 與 Speed Insights
            記錄匿名的頁面使用與效能指標。啟用第三方模型前，專案維護方應評估供應商的資料政策。
          </p>
        </section>
        <section>
          <h2>4. 儲存、共享與保留</h2>
          <p>
            帳號、業務資料與檔案儲存於設定的 Appwrite Cloud 專案。除提供服務所需的基礎設施與所選 AI
            模型供應商外，我們不會出售業務資料。資料在帳號或團隊存續期間保留；支援刪除的資源會在請求完成後從活動資料移除，備份副本可能依基礎設施週期延遲清除。
          </p>
        </section>
        <section>
          <h2>5. 你的選擇</h2>
          <p>
            你可以在產品中修改個人資料、刪除支援刪除的資源，或透過 GitHub 儲存庫的 Security/Issue
            管道申請資料匯出、帳號或團隊資料刪除。提出請求前需要完成身分與權限驗證。
          </p>
        </section>
        <section>
          <h2>6. 安全與未成年人</h2>
          <p>
            我們使用團隊權限、資料列權限、伺服器驗證、加密儲存、稽核與速率限制保護資料。本服務不面向未滿
            18 歲的使用者，也不應上傳支付卡、政府證件、密碼或其他非業務必要的高度敏感資訊。
          </p>
        </section>
        <section>
          <h2>7. 聯絡與變更</h2>
          <p>
            安全問題請使用 GitHub Security 私密報告；一般隱私請求可透過儲存庫 Issue
            提交。重大變更會更新本頁日期，並在必要時於產品內提示。
          </p>
        </section>
      </>
    ),
    terms: (
      <>
        <section>
          <h2>1. 服務說明</h2>
          <p>
            MatrixFlow AI 提供團隊化的 AI 內容生成、知識庫、AI
            員工與工作流工具。目前為測試版本，標記為「預覽」「即將開放」或「連接器未設定」的功能不構成可用性承諾。
          </p>
        </section>
        <section>
          <h2>2. 帳號與團隊責任</h2>
          <p>
            你應提供真實可用的電子郵件，妥善保護帳號憑據，並對團隊成員授權及團隊空間中的操作負責。不得繞過權限、額度、速率限制或安全控制。
          </p>
        </section>
        <section>
          <h2>3. 可接受使用</h2>
          <ul>
            <li>不得生成、上傳或傳播違法、侵權、詐欺、惡意軟體或騷擾內容。</li>
            <li>不得上傳無權處理的個人資料、商業秘密或受版權保護的材料。</li>
            <li>不得將 AI 輸出直接用於高風險決策；發佈前應由具備業務知識的人員複核。</li>
          </ul>
        </section>
        <section>
          <h2>4. 內容與 AI 輸出</h2>
          <p>
            你保留對合法提交內容的權利，並授權系統在提供服務所需範圍內處理這些內容。AI
            輸出可能不準確、不完整或與第三方內容相似；你負責核驗事實、權利與適用規則。
          </p>
        </section>
        <section>
          <h2>5. 費用與測試額度</h2>
          <p>
            目前免費測試額度受產品內顯示的限制約束。付費結帳尚未開放，任何展示的付費方案均為候補資訊，未明確確認訂單與付款前不會產生扣款。
          </p>
        </section>
        <section>
          <h2>6. 可用性與責任限制</h2>
          <p>
            測試服務按現況提供，可能調整、暫停或出現錯誤。對因未經複核的 AI
            輸出、第三方服務中斷、錯誤設定或超出授權的使用造成的損失，專案維護方在法律允許範圍內不承擔間接或後果性責任。
          </p>
        </section>
        <section>
          <h2>7. 暫停、終止與變更</h2>
          <p>
            對濫用、安全風險或違反條款的帳號可限制或終止服務。條款更新時會修改生效日期；繼續使用即表示接受更新後的條款。
          </p>
        </section>
      </>
    ),
  },
  en: {
    privacy: (
      <>
        <section>
          <h2>1. Scope</h2>
          <p>
            This policy explains how MatrixFlow AI handles information during account registration,
            team collaboration, file processing, and AI features. The product is currently in public
            preview.
          </p>
        </section>
        <section>
          <h2>2. Information we process</h2>
          <ul>
            <li>Account data: email, display name, verification state, and team memberships.</li>
            <li>
              Business content: product material, prompts, workflows, customer records, and
              knowledge-base files you submit.
            </li>
            <li>
              Runtime data: call counts, token usage, execution state, errors, and necessary
              security audit events.
            </li>
          </ul>
        </section>
        <section>
          <h2>3. Purpose and processing</h2>
          <p>
            We use this information to provide authentication, organization isolation, content
            generation, retrieval, workflow execution, security, and troubleshooting. AI requests
            are processed in the Appwrite Function; model keys never reach the browser. We also use
            Vercel Analytics and Speed Insights for aggregated, anonymous page usage and performance
            metrics. Before enabling a third-party model, the project operator should review that
            provider&apos;s data policy.
          </p>
        </section>
        <section>
          <h2>4. Storage, sharing, and retention</h2>
          <p>
            Accounts, business data, and files are stored in the configured Appwrite Cloud project.
            We do not sell business data, except that selected infrastructure and AI model providers
            process data as needed to deliver the service. Data is retained while the account or
            team exists; deleted resources are removed from active data after the request completes,
            while backups may expire on the infrastructure schedule.
          </p>
        </section>
        <section>
          <h2>5. Your choices</h2>
          <p>
            You can edit your profile, delete supported resources, or request an export or deletion
            of account or team data through the GitHub repository Security or Issue channels.
            Identity and permission checks are required before processing a request.
          </p>
        </section>
        <section>
          <h2>6. Security and minors</h2>
          <p>
            We use team permissions, row-level checks, server validation, encrypted storage, audit
            logs, and rate limits to protect data. The service is not directed to people under 18.
            Do not upload payment cards, government IDs, passwords, or other highly sensitive data
            that is not required for business operations.
          </p>
        </section>
        <section>
          <h2>7. Contact and changes</h2>
          <p>
            Report security issues privately through GitHub Security; submit general privacy
            requests through the repository Issue channel. Material changes update the date on this
            page and may be announced in-product.
          </p>
        </section>
      </>
    ),
    terms: (
      <>
        <section>
          <h2>1. Service description</h2>
          <p>
            MatrixFlow AI provides team-based AI content generation, knowledge bases, AI workers,
            and workflow tools. The product is in preview; features marked preview, coming soon, or
            connector not configured are not availability commitments.
          </p>
        </section>
        <section>
          <h2>2. Account and team responsibility</h2>
          <p>
            Provide a real, reachable email, protect your credentials, and take responsibility for
            member permissions and activity in your team workspace. Do not bypass permissions,
            quotas, rate limits, or security controls.
          </p>
        </section>
        <section>
          <h2>3. Acceptable use</h2>
          <ul>
            <li>
              Do not generate, upload, or distribute unlawful, infringing, fraudulent, malicious, or
              harassing content.
            </li>
            <li>
              Do not upload personal data, trade secrets, or copyrighted material you are not
              authorized to process.
            </li>
            <li>
              Do not use AI output directly for high-risk decisions; a qualified person must review
              it before publication.
            </li>
          </ul>
        </section>
        <section>
          <h2>4. Content and AI output</h2>
          <p>
            You retain rights to lawful content you submit and authorize the system to process it as
            needed to provide the service. AI output may be inaccurate, incomplete, or similar to
            third-party content; you are responsible for checking facts, rights, and applicable
            rules.
          </p>
        </section>
        <section>
          <h2>5. Fees and preview quotas</h2>
          <p>
            Free preview quotas are subject to the limits shown in the product. Paid checkout is not
            available yet. Displayed paid plans are waitlist information and will not create a
            charge before an explicit order and payment confirmation.
          </p>
        </section>
        <section>
          <h2>6. Availability and limits</h2>
          <p>
            The preview service is provided as-is and may change, pause, or contain errors. To the
            extent permitted by law, the project operator is not liable for indirect or
            consequential loss caused by unreviewed AI output, third-party outages,
            misconfiguration, or use beyond authorization.
          </p>
        </section>
        <section>
          <h2>7. Suspension, termination, and changes</h2>
          <p>
            Accounts may be limited or terminated for abuse, security risk, or violations. Updates
            change the effective date; continued use means you accept the updated terms.
          </p>
        </section>
      </>
    ),
  },
};

export function PrivacyContent() {
  const { locale } = useLocale();
  return (
    <LegalPage
      title={locale === 'en' ? 'Privacy policy' : locale === 'zh-TW' ? '隱私政策' : '隐私政策'}
      updated="2026-08-16"
    >
      {COPY[locale].privacy}
    </LegalPage>
  );
}

export function TermsContent() {
  const { locale } = useLocale();
  return (
    <LegalPage
      title={locale === 'en' ? 'Terms of service' : locale === 'zh-TW' ? '服務條款' : '服务条款'}
      updated="2026-08-16"
    >
      {COPY[locale].terms}
    </LegalPage>
  );
}
