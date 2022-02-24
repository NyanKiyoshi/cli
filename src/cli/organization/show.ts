import type { Arguments, CommandBuilder } from "yargs";
import yaml from "yaml";
import { emphasize } from 'emphasize';
import chalk from 'chalk';

import { API, GET } from "../../lib/index.js";
import { Options } from "../../types.js";
import { useOrganization } from "../../middleware/index.js";

export const command = "show [organization]";
export const desc = "Show a specific organization";

export const builder: CommandBuilder = (_) => _

export const handler = async (argv: Arguments<Options>) => {
  const result = await GET(API.Organization, argv) as any; 

  console.log("---")
  console.log(emphasize.highlight("yaml", yaml.stringify(result), {
    'attr': chalk.blue
  }).value);

  process.exit(0);
};


export const middlewares = [
  useOrganization
]