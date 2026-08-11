import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal-page';

export const metadata: Metadata = { title: '服务条款', description: 'MatrixFlow AI 服务条款' };

export default function TermsPage() {
  return (
    <LegalPage title="服务条款" updated="2026 年 8 月 11 日">
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
    </LegalPage>
  );
}
