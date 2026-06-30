export default function NewContentProjectPage() {
  return (
    <div className="max-w-md space-y-4">
      <h1 className="text-xl font-bold">新建内容项目</h1>
      <p className="text-sm text-muted-foreground">请到内容工厂页面直接创建项目并上传商品资料。</p>
      <a href="/dashboard/content" className="inline-block rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">前往内容工厂</a>
    </div>
  );
}
