import { Module } from '@nestjs/common';
import { DistanceMatrixService } from './distance-matrix.service';
import { TravelTimesService } from './travel-times.service';

@Module({
  providers: [DistanceMatrixService, TravelTimesService],
  exports: [DistanceMatrixService, TravelTimesService],
})
export class MapsModule {}
