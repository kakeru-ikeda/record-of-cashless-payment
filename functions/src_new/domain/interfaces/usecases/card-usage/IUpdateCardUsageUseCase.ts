import { UpdateCardUsageRequest, UpdateCardUsageResponse } from '../../../../../../shared/domain/dto/CardUsageNotificationDTO';

export interface IUpdateCardUsageUseCase {
  execute(request: UpdateCardUsageRequest): Promise<UpdateCardUsageResponse>;
}
