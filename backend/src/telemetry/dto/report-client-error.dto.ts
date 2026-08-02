import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ReportClientErrorDto {
  @IsString()
  @MaxLength(500)
  message!: string;

  // React's componentStack and a JS error's .stack can both get long -
  // capped well above what's normally useful (a few dozen frames) but
  // well below "someone POSTing a novel at this endpoint".
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  stack?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  componentStack?: string;

  @IsString()
  @MaxLength(500)
  url!: string;
}
