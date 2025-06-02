import { CreateCardUsageRequest, CreateCardUsageResponse } from '../../../../../../shared/domain/dto/CardUsageNotificationDTO';

export interface ICreateCardUsageUseCase {
  execute(request: CreateCardUsageRequest): Promise<CreateCardUsageResponse>;
}
