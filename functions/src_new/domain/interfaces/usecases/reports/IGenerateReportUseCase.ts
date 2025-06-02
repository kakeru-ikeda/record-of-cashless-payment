import { GenerateReportRequest } from '../../../../../../shared/domain/dto/CardUsageNotificationDTO';

export interface IGenerateReportUseCase {
  execute(request: GenerateReportRequest): Promise<void>;
}
