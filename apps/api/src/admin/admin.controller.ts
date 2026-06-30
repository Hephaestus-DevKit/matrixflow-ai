import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminGuard } from './admin.guard';

@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(private admin: AdminService) {}

  @Get('users') users(@Query() q: any) { return this.admin.users(q.page, q.pageSize, q.q); }
  @Get('orgs') orgs(@Query() q: any) { return this.admin.orgs(q.page, q.pageSize); }
  @Get('revenue') revenue() { return this.admin.revenue(); }
  @Get('models') models() { return this.admin.modelMonitor(); }
  @Get('items/pending') pending() { return this.admin.pendingItems(); }
  @Post('items/:id/approve') approve(@Param('id') id: string) { return this.admin.approveItem(id); }
  @Post('items/:id/reject') reject(@Param('id') id: string, @Body() b: { reason: string }) { return this.admin.rejectItem(id, b.reason); }
  @Get('audit') audit(@Query() q: any) { return this.admin.auditLogs(q.page, q.pageSize); }
}
