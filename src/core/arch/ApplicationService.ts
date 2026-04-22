/* eslint-disable-next-line */
export type ApplicationServiceArgs = Record<string, any>;
/* eslint-disable-next-line */
export type ApplicationServiceResponse = Record<string, any> | undefined | void;

export abstract class ApplicationService {
  protected abstract _doExec(
    args: ApplicationServiceArgs
  ): Promise<ApplicationServiceResponse>;
  public async exec(
    args: ApplicationServiceArgs
  ): Promise<ApplicationServiceResponse> {
    return await this._doExec(args);
  }
}
