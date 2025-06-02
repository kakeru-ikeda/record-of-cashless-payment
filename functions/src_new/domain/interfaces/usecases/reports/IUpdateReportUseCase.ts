import { UpdateReportRequest } from '../../../../../../shared/domain/dto/CardUsageNotificationDTO';

export interface IUpdateReportUseCase {
  execute(request: UpdateReportRequest): Promise<void>;
}