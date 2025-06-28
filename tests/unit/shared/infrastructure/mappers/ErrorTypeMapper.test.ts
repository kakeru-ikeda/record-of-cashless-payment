import { ErrorTypeMapper } from '../../../../../shared/infrastructure/mappers/ErrorTypeMapper';
import { ErrorType } from '../../../../../shared/errors/AppError';

describe('ErrorTypeMapper', () => {
    describe('toHttpStatusCode', () => {
        it('NOT_FOUNDエラーを404にマッピングすること', () => {
            // Act
            const result = ErrorTypeMapper.toHttpStatusCode(ErrorType.NOT_FOUND);

            // Assert
            expect(result).toBe(404);
        });

        it('VALIDATIONエラーを400にマッピングすること', () => {
            // Act
            const result = ErrorTypeMapper.toHttpStatusCode(ErrorType.VALIDATION);

            // Assert
            expect(result).toBe(400);
        });

        it('AUTHENTICATIONエラーを401にマッピングすること', () => {
            // Act
            const result = ErrorTypeMapper.toHttpStatusCode(ErrorType.AUTHENTICATION);

            // Assert
            expect(result).toBe(401);
        });

        it('AUTHORIZATIONエラーを403にマッピングすること', () => {
            // Act
            const result = ErrorTypeMapper.toHttpStatusCode(ErrorType.AUTHORIZATION);

            // Assert
            expect(result).toBe(403);
        });

        it('DUPLICATEエラーを409にマッピングすること', () => {
            // Act
            const result = ErrorTypeMapper.toHttpStatusCode(ErrorType.DUPLICATE);

            // Assert
            expect(result).toBe(409);
        });

        it('NETWORKエラーを503にマッピングすること', () => {
            // Act
            const result = ErrorTypeMapper.toHttpStatusCode(ErrorType.NETWORK);

            // Assert
            expect(result).toBe(503);
        });

        it('EMAILエラーを500にマッピングすること', () => {
            // Act
            const result = ErrorTypeMapper.toHttpStatusCode(ErrorType.EMAIL);

            // Assert
            expect(result).toBe(500);
        });

        it('DISCORDエラーを500にマッピングすること', () => {
            // Act
            const result = ErrorTypeMapper.toHttpStatusCode(ErrorType.DISCORD);

            // Assert
            expect(result).toBe(500);
        });

        it('FIREBASEエラーを500にマッピングすること', () => {
            // Act
            const result = ErrorTypeMapper.toHttpStatusCode(ErrorType.FIREBASE);

            // Assert
            expect(result).toBe(500);
        });

        it('DATA_ACCESSエラーを500にマッピングすること', () => {
            // Act
            const result = ErrorTypeMapper.toHttpStatusCode(ErrorType.DATA_ACCESS);

            // Assert
            expect(result).toBe(500);
        });

        it('CONFIGURATIONエラーを500にマッピングすること', () => {
            // Act
            const result = ErrorTypeMapper.toHttpStatusCode(ErrorType.CONFIGURATION);

            // Assert
            expect(result).toBe(500);
        });

        it('ENVIRONMENTエラーを500にマッピングすること', () => {
            // Act
            const result = ErrorTypeMapper.toHttpStatusCode(ErrorType.ENVIRONMENT);

            // Assert
            expect(result).toBe(500);
        });

        it('GENERALエラーを500にマッピングすること', () => {
            // Act
            const result = ErrorTypeMapper.toHttpStatusCode(ErrorType.GENERAL);

            // Assert
            expect(result).toBe(500);
        });

        it('未知のエラータイプでも500にマッピングすること', () => {
            // Arrange
            const unknownErrorType = 'UNKNOWN_ERROR' as ErrorType;

            // Act
            const result = ErrorTypeMapper.toHttpStatusCode(unknownErrorType);

            // Assert
            expect(result).toBe(500);
        });
    });
});
