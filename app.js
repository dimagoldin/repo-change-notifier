const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { Octokit } = require("@octokit/rest");
const moment = require('moment');
const axios = require('axios');
const https = require('https');

const agent = new https.Agent({
  rejectUnauthorized: false,
});

async function checkRepo(repoConfig, octokit, teamsWebhookUrl) {
  const { url, branch, paths, since } = repoConfig;
  const regex = /https?:\/\/([^\/]+)\/([^\/]+)\/([^\/]+)/;
  const match = url.match(regex);

  if (!match) {
    console.error(`Invalid repository URL: ${url}`);
    return;
  }

  const [, , owner, repo] = match;
  const sinceDate = moment().subtract(parseInt(since, 10), 'hours').toISOString();

  for (const path of paths) {
    console.log(`Checking ${owner}/${repo} for changes in ${path}`);
    try {
      const { data } = await octokit.repos.listCommits({
        owner,
        repo,
        sha: branch,
        since: sinceDate,
        path
      });

      if (data.length > 0) {
        const changes = data.map(commit => commit.commit.message).join('\n');
        const time = data[0].commit.author.date;
        await sendNotification(owner, repo, path, changes, time, teamsWebhookUrl);
      }
    } catch (error) {
      console.error(`Error checking ${owner}/${repo} in path ${path}:`, error);
    }
  }
}

async function sendNotification(owner, repo, path, changes, time, teamsWebhookUrl) {
  const message = {
    "@type": "MessageCard",
    "@context": "http://schema.org/extensions",
    "themeColor": "0076D7",
    "summary": "Changes detected",
    "sections": [{
      "activityTitle": `Changes detected in ${owner}/${repo}`,
      "facts": [{
        "name": "Repository:",
        "value": `${owner}/${repo}`
      }, {
        "name": "Date:",
        "value": time
      }, {
        "name": "Path:",
        "value": path
      }, {
        "name": "Changes:",
        "value": changes
      }],
      "markdown": true
    }]
  };

  await axios.post(teamsWebhookUrl, message);
}

function main() {
  const configsDir = process.argv[2] || './configs';

  let combinedConfig = {
    env: {},
    repos: []
  };

  try {
    const files = fs.readdirSync(configsDir);

    files.forEach(file => {
      const filePath = path.join(configsDir, file);
      const fileStats = fs.statSync(filePath);

      if (fileStats.isFile()) {
        const fileContent = yaml.load(fs.readFileSync(filePath, 'utf8'));

        if (fileContent && fileContent.env) {
          combinedConfig.env = { ...combinedConfig.env, ...fileContent.env };
        }

        if (fileContent && fileContent.repos) {
          combinedConfig.repos = combinedConfig.repos.concat(fileContent.repos);
        }
      }
    });

    const teamsWebhookUrl = combinedConfig.env.TEAMS_WEBHOOK_URL || process.env.TEAMS_WEBHOOK_URL;
    console.log('TEAMS_WEBHOOK_URL:', teamsWebhookUrl);
    const githubToken = combinedConfig.env.GITHUB_TOKEN || process.env.GITHUB_TOKEN;
    console.log('GITHUB_TOKEN:', `${githubToken.substring(0, 4)}...${githubToken.slice(-4)}`);
    const githubApiBaseUrl = combinedConfig.env.GITHUB_API_BASE_URL || process.env.GITHUB_API_BASE_URL;
    console.log('GITHUB_API_BASE_URL:', githubApiBaseUrl);

    if (!teamsWebhookUrl || !githubToken || !githubApiBaseUrl) {
      console.error('Missing required configurations. Ensure all environment variables are set.');
      process.exit(1);
    }

    const octokit = new Octokit({
      auth: githubToken,
      baseUrl: githubApiBaseUrl,
      request: {
        agent: agent,
      },
    });

    combinedConfig.repos.forEach(repoConfig => {
      checkRepo(repoConfig, octokit, teamsWebhookUrl).catch(console.error);
    });

  } catch (error) {
    console.error('Error processing configuration files:', error);
  }
}

main();
