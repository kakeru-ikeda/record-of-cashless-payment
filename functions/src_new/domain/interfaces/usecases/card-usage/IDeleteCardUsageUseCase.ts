import { DeleteCardUsageRequest, DeleteCardUsageResponse } from '../../../../../../shared/domain/dto/CardUsageNotificationDTO';

export interface IDeleteCardUsageUseCase {
  execute(request: DeleteCardUsageRequest): Promise<DeleteCardUsageResponse>;
}
