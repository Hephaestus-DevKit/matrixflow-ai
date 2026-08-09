import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminGuard } from './admin.guard';
import { rejectMarketplaceItemSchema } from '@matrixflow/shared';

@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(private admin: AdminService) {}

  @Get('users') users(@Query() q: PaginationQuery & { q?: string }) {
    return this.admin.users(optionalNumber(q.page), optionalNumber(q.pageSize), q.q);
  }
  @Get('orgs') orgs(@Query() q: PaginationQuery) {
    return this.admin.orgs(optionalNumber(q.page), optionalNumber(q.pageSize));
  }
  @Get('revenue') revenue() {
    return this.admin.revenue();
  }
  @Get('models') models() {
    return this.admin.modelMonitor();
  }
  @Get('items/pending') pending() {
    return this.admin.pendingItems();
  }
  @Post('items/:id/approve') approve(@Param('id') id: string) {
    return this.admin.approveItem(id);
  }
  @Post('items/:id/reject') reject(@Param('id') id: string, @Body() body: unknown) {
    return this.admin.rejectItem(id, rejectMarketplaceItemSchema.parse(body).reason);
  }
  @Get('audit') audit(@Query() q: PaginationQuery) {
    return this.admin.auditLogs(optionalNumber(q.page), optionalNumber(q.pageSize));
  }
}

interface PaginationQuery {
  page?: string;
  pageSize?: string;
}

function optionalNumber(value: string | undefined): number | undefined {
  return value === undefined ? undefined : Number(value);
}
