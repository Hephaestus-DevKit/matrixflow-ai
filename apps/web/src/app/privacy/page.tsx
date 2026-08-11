import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal-page';

export const metadata: Metadata = { title: '隐私政策', description: 'MatrixFlow AI 隐私政策' };

export default function PrivacyPage() {
  return (
    <LegalPage title="隐私政策" updated="2026 年 8 月 11 日">
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
          请求会在 Appwrite Function
          中处理；模型密钥不会发送至浏览器。启用第三方模型前，项目维护方应评估对应供应商的数据政策。
        </p>
      </section>
      <section>
        <h2>4. 存储、共享与保留</h2>
        <p>
          账号、业务数据和文件存储于配置的 Appwrite Cloud 项目。除提供服务所必需的基础设施与所选 AI
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
    </LegalPage>
  );
}
