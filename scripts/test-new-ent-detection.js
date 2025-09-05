import { makeClient, checkOrganizationIsEnterprise } from './dist/chunk-X7TNMRPR.js';

const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
if (!token) {
  console.error('No token found');
  process.exit(1);
}

const client = makeClient(token);
const result = await checkOrganizationIsEnterprise(client, 'altx-labs');
console.log('Is altx-labs enterprise?', result);
