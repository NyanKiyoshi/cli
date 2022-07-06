import { CliUx } from '@oclif/core';
import EventEmitter from 'events';
import got from 'got';
import { nanoid } from 'nanoid';
import { ServerApp } from 'retes';
import { Response } from 'retes/response';
import { GET } from 'retes/route';
import type { CommandBuilder } from 'yargs';

import { Config, SaleorCLIPort } from '../../lib/config.js';
import { checkPort } from '../../lib/detectPort.js';
import { delay } from '../../lib/util.js';

const { ux: cli } = CliUx;

const RedirectURI = `http://localhost:${SaleorCLIPort}/vercel/callback`;

export const command = 'login';
export const desc = 'Add integration for Saleor CLI';

export const builder: CommandBuilder = (_) => _;

export const handler = async () => {
  await checkPort(SaleorCLIPort);

  const generatedState = nanoid();
  const emitter = new EventEmitter();

  const { VercelClientID, VercelClientSecret } = await Config.get();

  // const spinner = ora('\nLogging in...').start();
  // await delay(1500);
  // spinner.text = '\nLogging in...\n';

  const QueryParams = new URLSearchParams({ state: generatedState });
  const url = `https://vercel.com/integrations/saleor/new?${QueryParams}`;
  cli.open(url);

  const app = new ServerApp([
    GET('/vercel/callback', async ({ params }) => {
      const { state, code } = params;

      if (state !== generatedState) {
        return Response.BadRequest('Wrong state');
      }

      const Params = {
        client_id: VercelClientID,
        client_secret: VercelClientSecret,
        code,
        redirect_uri: RedirectURI,
      };

      try {
        const data: any = await got
          .post('https://api.vercel.com/v2/oauth/access_token', {
            form: Params,
          })
          .json();

        const { access_token: accessToken, team_id: teamId } = data;

        await Config.set('vercel_token', `Bearer ${accessToken}`);
        await Config.set('vercel_team_id', teamId);
      } catch (error: any) {
        console.log(error.message);
        console.log(
          'Tip: in some cases `saleor logout` followed by `saleor login` may help'
        );
      }

      // spinner.succeed(`You've successfully logged into Saleor Cloud!\n  Your access token has been safely stored, and you're ready to go`)
      emitter.emit('finish');

      return Response.Redirect('https://cloud.saleor.io');
    }),
  ]);
  await app.start(SaleorCLIPort);

  emitter.on('finish', async () => {
    await delay(1500);
    await app.stop();
  });
};
