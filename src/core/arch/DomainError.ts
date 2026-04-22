import { Scalar } from '@/types/scalar';

export class DomainError extends Error {
  constructor(
    private readonly _code: string,
    private readonly _args: Record<string, Scalar>,
    private readonly _message?: string
  ) {
    super(_code);
  }

  getCode(): string {
    return this._code;
  }

  getArgs(): Record<string, Scalar> {
    return this._args;
  }
}
