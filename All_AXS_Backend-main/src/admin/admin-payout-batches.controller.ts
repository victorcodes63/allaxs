import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from '../domain/enums';
import { PayoutBatchesService } from './payout-batches.service';
import { CreatePayoutBatchDraftDto } from './dto/create-payout-batch-draft.dto';
import { MarkPayoutBatchPaidDto } from './dto/mark-payout-batch-paid.dto';
import type { PayoutBatch } from '../domain/payout-batch.entity';

@ApiTags('admin')
@Controller('admin/payout-batches')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@ApiBearerAuth()
export class AdminPayoutBatchesController {
  constructor(private readonly payoutBatchesService: PayoutBatchesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a draft payout batch from current available balances',
  })
  async createDraft(
    @GetUser() user: CurrentUser,
    @Body() dto: CreatePayoutBatchDraftDto,
  ) {
    const batch = await this.payoutBatchesService.createDraft(
      dto.organizerIds,
      user.id,
    );
    return { batch: this.serializeBatch(batch) };
  }

  @Get()
  @ApiOperation({ summary: 'List payout batches' })
  async list(
    @Query('limit') limitRaw?: string,
    @Query('offset') offsetRaw?: string,
  ) {
    const limit = Math.min(
      50,
      Math.max(1, parseInt(limitRaw ?? '20', 10) || 20),
    );
    const offset = Math.max(0, parseInt(offsetRaw ?? '0', 10) || 0);
    const { batches, total } = await this.payoutBatchesService.listBatches({
      limit,
      offset,
    });
    return {
      total,
      batches: batches.map((b) => this.serializeBatch(b)),
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one payout batch with lines' })
  @ApiParam({ name: 'id' })
  async getOne(@Param('id') id: string) {
    const batch = await this.payoutBatchesService.getBatch(id);
    return { batch: this.serializeBatch(batch) };
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve a draft batch' })
  async approve(@Param('id') id: string) {
    const batch = await this.payoutBatchesService.approve(id);
    return { batch: this.serializeBatch(batch) };
  }

  @Post(':id/export')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mark batch as exported (e.g. CSV downloaded for bank)',
  })
  async export(@Param('id') id: string) {
    const batch = await this.payoutBatchesService.markExported(id);
    return { batch: this.serializeBatch(batch) };
  }

  @Post(':id/mark-paid')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Post payout debits to organizer ledgers and close the batch (after bank run)',
  })
  async markPaid(
    @Param('id') id: string,
    @Body() body: MarkPayoutBatchPaidDto,
  ) {
    const batch = await this.payoutBatchesService.markPaid(
      id,
      body.externalReference,
    );
    return { batch: this.serializeBatch(batch) };
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel a batch that is not yet marked paid' })
  async cancel(@Param('id') id: string) {
    const batch = await this.payoutBatchesService.cancel(id);
    return { batch: this.serializeBatch(batch) };
  }

  private serializeBatch(batch: PayoutBatch) {
    const lines = (batch.lines ?? []).map((line) => ({
      id: line.id,
      organizerId: line.organizerId,
      orgName: line.organizer?.orgName ?? null,
      amountCents: line.amountCents,
      currency: line.currency,
    }));
    const totalCents = lines.reduce((s, l) => s + l.amountCents, 0);
    return {
      id: batch.id,
      status: batch.status,
      currency: batch.currency,
      notes: batch.notes ?? null,
      externalReference: batch.externalReference ?? null,
      createdByUserId: batch.createdByUserId ?? null,
      approvedAt: batch.approvedAt?.toISOString() ?? null,
      markedPaidAt: batch.markedPaidAt?.toISOString() ?? null,
      createdAt: batch.createdAt.toISOString(),
      updatedAt: batch.updatedAt.toISOString(),
      totalCents,
      lines,
    };
  }
}
