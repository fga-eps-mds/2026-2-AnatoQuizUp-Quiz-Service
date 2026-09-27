import type { NextFunction, Request, Response } from 'express';

import { STATUS } from '@/shared/constants/status';
import { CodigoDeErro } from '@/shared/errors/codigos-de-erro';
import { ErroAplicacao } from '@/shared/errors/erro-aplicacao';
import type { PayloadAutenticacao } from '@/shared/types/autenticacao.types';
import { verificarTokenJwt } from '@/shared/utils/jwt';
import { middlewareAutenticacao } from '../../../../src/shared/middlewares/autenticacao.middleware';

jest.mock('@/shared/utils/jwt', () => ({
  verificarTokenJwt: jest.fn(),
}));

const mockedVerificarTokenJwt = jest.mocked(verificarTokenJwt);

describe('middlewareAutenticacao', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {
      headers: {},
    };
    mockResponse = {};
    mockNext = jest.fn();
    jest.clearAllMocks();
  });

  it('deve autenticar com sucesso e inserir o usuario no request', () => {
    mockRequest.headers = {
      authorization: 'Bearer token-valido',
      'x-user-id': 'usuario-forjado',
    };

    const payloadMock: PayloadAutenticacao = {
      id: 'usr-1',
      email: 'teste@email.com',
      papel: 'PROFESSOR',
      status: STATUS.ATIVO,
    };

    mockedVerificarTokenJwt.mockReturnValue(payloadMock);

    middlewareAutenticacao(mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockedVerificarTokenJwt).toHaveBeenCalledWith('token-valido');
    expect(mockRequest.usuario).toEqual({
      id: 'usr-1',
      email: 'teste@email.com',
      papel: 'PROFESSOR',
      status: STATUS.ATIVO,
    });
    expect(mockRequest.usuario?.id).not.toBe('usuario-forjado');
    expect(mockNext).toHaveBeenCalledTimes(1);
  });

  it('deve lançar erro se o token não for fornecido', () => {
    
    expect(() => {
      middlewareAutenticacao(mockRequest as Request, mockResponse as Response, mockNext);
    }).toThrow(ErroAplicacao);

    try {
      middlewareAutenticacao(mockRequest as Request, mockResponse as Response, mockNext);
    } catch (erro) {
      expect((erro as ErroAplicacao).codigo).toBe(CodigoDeErro.NENHUM_TOKEN_FORNECIDO);
      expect((erro as ErroAplicacao).codigoStatus).toBe(401);
    }
  });

  it('deve lançar erro se o token for inválido (sem prefixo Bearer)', () => {
    mockRequest.headers = { authorization: 'Basic token-invalido-formato' };

    expect(() => {
      middlewareAutenticacao(mockRequest as Request, mockResponse as Response, mockNext);
    }).toThrow(ErroAplicacao);

    try {
      middlewareAutenticacao(mockRequest as Request, mockResponse as Response, mockNext);
    } catch (erro) {
      expect((erro as ErroAplicacao).codigo).toBe(CodigoDeErro.TOKEN_INVALIDO);
      expect((erro as ErroAplicacao).codigoStatus).toBe(401);
    }
  });

  it('deve lançar erro se o usuário não estiver com status ativo', () => {
    mockRequest.headers = { authorization: 'Bearer token-valido' };

    const payloadMock: PayloadAutenticacao = {
      id: 'usr-2',
      email: 'inativo@email.com',
      papel: 'ALUNO',
      status: 'INATIVO', // Status diferente de ATIVO
    };

    mockedVerificarTokenJwt.mockReturnValue(payloadMock);

    expect(() => {
      middlewareAutenticacao(mockRequest as Request, mockResponse as Response, mockNext);
    }).toThrow(ErroAplicacao);

    try {
      middlewareAutenticacao(mockRequest as Request, mockResponse as Response, mockNext);
    } catch (erro) {
      expect((erro as ErroAplicacao).codigo).toBe(CodigoDeErro.PROIBIDO);
      expect((erro as ErroAplicacao).codigoStatus).toBe(403);
    }
  });
});