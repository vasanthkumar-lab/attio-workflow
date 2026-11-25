import { Body, Controller, Delete, Get, Header, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { EnrollDto, SetEnabledDto } from './sequences.dto';
import { EnrollmentStatus } from './sequence.types';
import { SequencesService } from './sequences.service';

@Controller('sequences')
export class SequencesController {
  constructor(private readonly sequences: SequencesService) {}

  @Post() create(@Body() body: any) { return this.sequences.create(body); }
  @Get() list() { return this.sequences.list(); }
  @Get(':id') get(@Param('id') id: string) { return this.sequences.get(id); }
  @Put(':id') update(@Param('id') id: string, @Body() body: any) { return this.sequences.update(id, body); }
  @Patch(':id/enabled') setEnabled(@Param('id') id: string, @Body() dto: SetEnabledDto) { return this.sequences.setEnabled(id, dto.enabled); }
  @Delete(':id') remove(@Param('id') id: string) { return this.sequences.delete(id); }

  @Post(':id/enroll') enroll(@Param('id') id: string, @Body() dto: EnrollDto) { return this.sequences.enrollMany(id, dto.personIds); }
  @Get(':id/enrollments') enrollments(@Param('id') id: string, @Query('status') status?: EnrollmentStatus) {
    return this.sequences.listEnrollments(id, status);
  }
  @Get(':id/stats') stats(@Param('id') id: string) { return this.sequences.stats(id); }
}

@Controller('enrollments')
export class EnrollmentsController {
  constructor(private readonly sequences: SequencesService) {}

  @Get() list(@Query('status') status?: EnrollmentStatus, @Query('personId') personId?: string) {
    return this.sequences.listEnrollments(undefined, status, personId);
  }
  @Get(':id') get(@Param('id') id: string) { return this.sequences.getEnrollment(id); }
  @Post(':id/reply') reply(@Param('id') id: string) { return this.sequences.markReplied(id); }
  @Post(':id/pause') pause(@Param('id') id: string) { return this.sequences.pause(id); }
  @Post(':id/resume') resume(@Param('id') id: string) { return this.sequences.resume(id); }
  @Post(':id/remove') remove(@Param('id') id: string) { return this.sequences.remove(id); }
}

/** The link inside every email. POST supports one-click unsubscribe from Gmail/Outlook. */
@Controller('unsubscribe')
export class UnsubscribeController {
  constructor(private readonly sequences: SequencesService) {}

  @Get(':id') @Header('Content-Type', 'text/html')
  async page(@Param('id') id: string) {
    await this.sequences.unsubscribe(id);
    return '<p style="font-family:sans-serif">You’ve been unsubscribed and won’t receive more emails from us.</p>';
  }

  @Post(':id') async oneClick(@Param('id') id: string) {
    await this.sequences.unsubscribe(id);
    return { ok: true };
  }
}