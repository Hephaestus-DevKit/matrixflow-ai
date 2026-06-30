// 装饰器：从 req.user 取当前用户
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
export const CurrentUser = createParamDecorator((data: keyof { id: string; email: string; organizationId: string; roleId: string; role: string } | undefined, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest<{ user?: { id: string; email: string; organizationId: string; roleId: string; role: string } }>();
  return data ? req.user?.[data] : req.user;
});
