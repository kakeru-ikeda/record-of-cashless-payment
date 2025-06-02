import { GetCardUsageRequest, GetCardUsageResponse } from '../../../../../../shared/domain/dto/CardUsageNotificationDTO';

export interface IGetCardUsageUseCase {
  execute(request: GetCardUsageRequest): Promise<GetCardUsageResponse>;
}
