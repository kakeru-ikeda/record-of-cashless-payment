import { Response } from '../../../../shared/presentation/responses/ResponseHelper';
import * as functions from 'firebase-functions';

/**
 * Firebase Functions関連の型定義
 */

/**
 * Firestore Document Created Event (Firebase Functions v2形式)
 * 実際のFirebase Functions v2のFirestoreEventに合わせた型定義
 */
export type FirestoreDocumentCreatedEvent = functions.firestore.FirestoreEvent<
    functions.firestore.QueryDocumentSnapshot | undefined,
    Record<string, string>
>;

/**
 * Firebase Scheduler Context (Firebase Functions v2形式)
 */
export type ScheduleContext = functions.scheduler.ScheduledEvent;

/**
 * Firebase Functions Response
 */
export type FunctionResponse = Response | void | null;

/**
 * Event Handler Result
 */
export interface EventHandlerResult {
    success: boolean;
    message: string;
    data?: Record<string, unknown>;
    timestamp: string;
}
