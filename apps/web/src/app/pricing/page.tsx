export default function PricingPage() {
  const plans = [
    { name: 'Free', price: '$0', period: '', seats: '1', calls: '100', workflows: '1', kb: '1 个 / 50 文档', cta: '免费开始', highlight: false },
    { name: 'Starter', price: '$29', period: '/月', seats: '3', calls: '1,000', workflows: '5', kb: '3 个 / 500 文档', cta: '开始使用', highlight: false },
    { name: 'Pro', price: '$99', period: '/月', seats: '10', calls: '5,000', workflows: '20', kb: '10 个 / 5,000 文档', cta: '最受欢迎', highlight: true },
    { name: 'Business', price: '$299', period: '/月', seats: '30', calls: '20,000', workflows: '无限', kb: '50 个 / 无限', cta: '企业首选', highlight: false },
  ];

  return (
    <div className="min-h-screen px-4 py-20">
      <div className="mx-auto max-w-5xl">
        <div className="mb-12 text-center">
          <h1 className="text-3xl font-bold">简单透明的定价</h1>
          <p className="mt-3 text-muted-foreground">按需付费，随时升级或降级</p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {plans.map((p) => (
            <div key={p.name} className={`rounded-xl border ${p.highlight ? 'border-primary bg-primary/5' : 'border-border bg-card'} p-6`}>
              <h2 className="text-lg font-semibold">{p.name}</h2>
              <p className="mt-3"><span className="text-3xl font-bold">{p.price}</span><span className="text-sm text-muted-foreground">{p.period}</span></p>
              <ul className="mt-6 space-y-3 text-sm">
                <li>✅ {p.seats} 团队席位</li>
                <li>✅ {p.calls} AI 调用/月</li>
                <li>✅ {p.workflows} 工作流</li>
                <li>✅ {p.kb}</li>
                <li>✅ 模板市场</li>
              </ul>
              <button className={`mt-6 w-full rounded-lg py-2.5 text-sm font-medium ${p.highlight ? 'bg-primary text-primary-foreground' : 'border border-border bg-background hover:bg-muted'}`}>
                {p.cta}
              </button>
            </div>
          ))}
        </div>
        <p className="mt-8 text-center text-sm text-muted-foreground">Enterprise 方案：私有部署 + SSO + 定制开发 → 联系我们</p>
      </div>
    </div>
  );
}
