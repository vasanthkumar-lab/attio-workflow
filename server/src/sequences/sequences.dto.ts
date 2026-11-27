import { ArrayNotEmpty, IsArray, IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class EnrollDto {
  @IsArray() @ArrayNotEmpty() @IsString({ each: true }) personIds: string[];
}

export class SetEnabledDto {
  @IsBoolean() enabled: boolean;
}
/** Every field is optional: posting nothing still just flags the enrollment, as before. */
export class ReplyDto {
  // Capped because this is held in memory and rendered straight into the thread.
  @IsOptional() @IsString() @MaxLength(100_000) body?: string;
  @IsOptional() @IsString() @MaxLength(320) from?: string;
  @IsOptional() @IsString() @MaxLength(998) subject?: string;
  @IsOptional() @IsString() @MaxLength(998) messageId?: string;
  @IsOptional() @IsString() @MaxLength(998) inReplyTo?: string;
  @IsOptional() @IsString() receivedAt?: string;
}
