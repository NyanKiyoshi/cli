import chalk from 'chalk';
import Enquirer from 'enquirer';
import got from 'got';
import ora from 'ora';
import { Arguments } from 'yargs';
import { doWebhookUpdate } from '../../graphql/doWebhookUpdate.js';
import { WebhookList } from '../../graphql/WebhookList.js';
import { Config } from '../../lib/config.js';

import { API, GET } from "../../lib/index.js";
import { Options } from '../../types.js';

export const command = "update";
export const desc = "Update webhooks for an environment";

export const handler = async (argv: Arguments<Options>) => {
  const { domain } = await GET(API.Environment, argv) as any;
  const gqlUrl = `https://${domain}/graphql`;
  const { token } = await Config.get();

  const { data, errors }: any = await got.post(gqlUrl, {
    headers: {
      'Authorization-Bearer': token.split(' ').slice(-1),
      'Content-Type': 'application/json',
    },
    json: {
      query: WebhookList
    }
  }).json()

  if (!data.apps) {
    console.warn(chalk.red(" No webhooks found for this environment"))
    process.exit(0);
  }

  if (errors) {
    throw Error("cannot auth")
  }

  const { apps: { edges: apps } } = data;

  const { all } = await Enquirer.prompt<{ all: string }>({
    type: "confirm",
    name: 'all',
    message: 'Would you like to replace domain for all webhooks',
  });

  if (all) {
    const { webhooksDomain } = await Enquirer.prompt<{ webhooksDomain: string }>({
      type: "input",
      name: 'webhooksDomain',
      message: 'Domain',
      initial: 'http://localhost:3000'
    });

    const spinner = ora('Updating...').start();

    for (const { node: { webhooks }} of apps) {
      for (const {id, targetUrl} of webhooks) {
        const url = new URL(targetUrl)
        const newTargetUrl = `${webhooksDomain}${url.pathname}`
        await updateWebhook(token, gqlUrl, id, newTargetUrl)
      }
    }

    spinner.succeed('Yay! Webhooks updated')
  }

  if (!all) {
    for (const { node: { webhooks, name: appName }} of apps) {
      for (const {id, targetUrl, name} of webhooks) {
        const { newTargetUrl } = await Enquirer.prompt<{ newTargetUrl: string }>({
          type: "input",
          name: 'newTargetUrl',
          message: `App: ${appName}, webhook: ${name} - ${targetUrl}`,
          initial: targetUrl
        });

        const spinner = ora('Updating...').start();
        await updateWebhook(token, gqlUrl, id, newTargetUrl)
        spinner.succeed('Updated');
      }
    }
  }
};

const updateWebhook = async (token:string, gqlUrl: string, id: string, targetUrl: string | null) => {
  const { errors }: any = await got.post(gqlUrl, {
    headers: {
      'Authorization-Bearer': token.split(' ').slice(-1),
      'Content-Type': 'application/json',
    },
    json: {
      query: doWebhookUpdate,
      variables: {
        input: {
          targetUrl
        },
        id
      }
    }
  }).json()

  if (errors) {
    throw Error("cannot auth")
  }
}