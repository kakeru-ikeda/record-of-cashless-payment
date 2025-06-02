import { SendReportNotificationRequest } from '../../../../../../shared/domain/dto/CardUsageNotificationDTO';

export interface ISendReportNotificationUseCase {
  execute(request: SendReportNotificationRequest): Promise<void>;
}
