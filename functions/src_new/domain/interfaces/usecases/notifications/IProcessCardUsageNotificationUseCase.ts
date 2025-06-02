import { ProcessCardUsageNotificationRequest } from '../../../../../../shared/domain/dto/CardUsageNotificationDTO';

export interface IProcessCardUsageNotificationUseCase {
    execute(request: ProcessCardUsageNotificationRequest): Promise<void>;
}
