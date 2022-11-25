import chalk from 'chalk';
import Debug from 'debug';
import Enquirer from 'enquirer';
import got from 'got';
import { request } from 'graphql-request';
import type { Arguments, CommandBuilder } from 'yargs';

import {
  GetWebhookAsyncEventEnum,
  GetWebhookSyncEventEnum,
} from '../../generated/graphql.js';
import { doWebhookCreate } from '../../graphql/doWebhookCreate.js';
import { Config } from '../../lib/config.js';
import { DefaultSaleorEndpoint } from '../../lib/index.js';
import { obfuscateArgv, println, without } from '../../lib/util.js';
import { interactiveSaleorApp } from '../../middleware/index.js';
import { Options, WebhookError } from '../../types.js';

const debug = Debug('saleor-cli:webhook:create');

export const command = 'create';
export const desc = 'Create a new webhook';

export const builder: CommandBuilder = (_) => _;

export const handler = async (argv: Arguments<Options>) => {
  debug('command arguments: %O', obfuscateArgv(argv));

  const { environment, app } = argv;
  const {
    __type: { enumValues: asyncEventsList },
  } = await request(DefaultSaleorEndpoint, GetWebhookAsyncEventEnum);
  const asyncEventsListChoices = asyncEventsList.filter(without('ANY_EVENTS'));

  const {
    __type: { enumValues: syncEventsList },
  } = await request(DefaultSaleorEndpoint, GetWebhookSyncEventEnum);

  println(`Creating a webhook for the ${environment} environment`);

  const {
    name,
    targetUrl,
    secretKey,
    asyncEvents,
    syncEvents,
    isActive,
    query,
  } = await Enquirer.prompt<{
    name: string;
    targetUrl: string;
    secretKey: string;
    asyncEvents: string[];
    syncEvents: string[];
    isActive: boolean;
    query: string;
  }>([
    {
      type: 'input',
      name: 'name',
      message: 'Name',
      initial: argv.name,
      required: true,
      skip: !!argv.name,
    },
    {
      type: 'input',
      name: 'targetUrl',
      message: 'Target URL',
      initial: argv.targetUrl,
      required: true,
      validate: (value) => {
        try {
          const _ = new URL(value);
          return true;
        } catch {
          return false;
        }
      },
      skip: !!argv.targetUrl,
    },
    {
      type: 'input',
      name: 'secretKey',
      message: 'Secret (optional)',
      initial: argv.secretKey,
      skip: !!argv.secretKey,
    },
    {
      type: 'multiselect',
      name: 'asyncEvents',
      message:
        'Select asynchronous events\n  (use the arrows to navigate and the space bar to select)',
      choices: asyncEventsListChoices,
    },
    {
      type: 'multiselect',
      name: 'syncEvents',
      message:
        'Select synchronous events\n  (use the arrows to navigate and the space bar to select)',
      choices: syncEventsList,
    },
    {
      type: 'confirm',
      name: 'isActive',
      message: 'Webhook is active',
      format: (value) => chalk.cyan(value ? 'yes' : 'no'),
      initial: true,
    },
    {
      type: 'input',
      name: 'query',
      message: 'Subscription query (optional)',
    },
  ]);

  const { instance } = argv;
  const endpoint = `${instance}/graphql/`;
  const headers = await Config.getBearerHeader();

  const { data }: any = await got
    .post(endpoint, {
      headers,
      json: {
        query: doWebhookCreate,
        variables: {
          input: {
            name,
            targetUrl,
            secretKey,
            asyncEvents,
            syncEvents,
            isActive,
            app,
            query,
          },
        },
      },
    })
    .json();

  const {
    webhookCreate: { webhook, errors },
  } = data;

  if (errors.length) {
    throw new Error(
      errors.map((e: WebhookError) => `\n ${e.field} - ${e.message}`).join()
    );
  }

  println(chalk('Webhook created with id', chalk.green(webhook?.id)));
};

export const middlewares = [interactiveSaleorApp];
