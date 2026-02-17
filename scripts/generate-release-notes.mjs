#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

/**
 * Generate enhanced GitHub release notes in Dokploy style
 * - What's Changed section with PR links
 * - New Contributors section (only if there are new contributors)
 * - Full Changelog link
 * 
 * This script combines information from:
 * 1. CHANGELOG.md - for structured change descriptions
 * 2. Git history - for PR numbers and contributor information
 */

function parseArgs(args) {
  const versionIndex = args.indexOf("--version");
  const previousVersionIndex = args.indexOf("--previous-version");
  const changelogIndex = args.indexOf("--changelog");
  
  return {
    version: versionIndex >= 0 ? args[versionIndex + 1] : null,
    previousVersion: previousVersionIndex >= 0 ? args[previousVersionIndex + 1] : null,
    changelogPath: changelogIndex >= 0 ? args[changelogIndex + 1] : "CHANGELOG.md",
  };
}

function getRepoInfo() {
  try {
    const remoteUrl = execFileSync("git", ["config", "--get", "remote.origin.url"], {
      encoding: "utf8",
      stdio: ["inherit", "pipe", "ignore"], // Suppress stderr
    }).trim();
    
    // Parse GitHub URL (https://github.com/owner/repo.git or git@github.com:owner/repo.git)
    const match = remoteUrl.match(/github\.com[:/]([^/]+)\/(.+?)(\.git)?$/);
    if (!match) {
      throw new Error(`Could not parse GitHub repo from remote URL: ${remoteUrl}`);
    }
    
    return {
      owner: match[1],
      repo: match[2],
    };
  } catch (error) {
    console.error("Failed to get repo info:", error.message);
    throw error;
  }
}

function getCommitsSinceTag(previousTag) {
  // If no previous tag, don't process git history
  // This prevents scanning the entire repository history
  if (!previousTag) {
    return [];
  }
  
  try {
    const range = `${previousTag}..HEAD`;
    const output = execFileSync("git", ["log", range, "--format=%H%x00%s%x00%an%x00%ae"], {
      encoding: "utf8",
      stdio: ["inherit", "pipe", "ignore"], // Suppress stderr
    }).trim();
    
    if (!output) {
      return [];
    }
    
    return output.split("\n").map((line) => {
      const parts = line.split("\0");
      const [hash, subject, authorName, authorEmail] = parts;
      
      // Extract PR number from subject (e.g., "Fix bug (#123)")
      const prMatch = subject?.match(/\(#(\d+)\)/);
      const prNumber = prMatch ? prMatch[1] : null;
      
      return {
        hash: hash || "",
        subject: subject || "",
        authorName: authorName || "",
        authorEmail: authorEmail || "",
        prNumber,
      };
    });
  } catch (error) {
    // Tag might not exist or git command failed - that's okay, we'll fall back to CHANGELOG.md
    return [];
  }
}

function getContributorsBeforeTag(tag) {
  if (!tag) {
    return new Set();
  }
  
  try {
    const output = execFileSync("git", ["log", tag, "--format=%ae"], {
      encoding: "utf8",
      stdio: ["inherit", "pipe", "ignore"], // Suppress stderr
    }).trim();
    
    if (!output) {
      return new Set();
    }
    
    return new Set(output.split("\n"));
  } catch (error) {
    // Tag might not exist - that's okay
    return new Set();
  }
}

function extractUsername(email) {
  // Try to extract GitHub username from email
  // Format: username@users.noreply.github.com or just use email prefix
  const githubMatch = email.match(/^(?:\d+\+)?([^@]+)@users\.noreply\.github\.com$/);
  if (githubMatch) {
    return githubMatch[1];
  }
  
  // Fallback to email prefix with safety check
  return email.split("@")[0] ?? email;
}

async function parseChangelogSection(changelogPath, version) {
  if (!existsSync(changelogPath)) {
    return [];
  }
  
  const content = await readFile(changelogPath, "utf8");
  const lines = content.split("\n");
  
  let inVersionSection = false;
  const entries = [];
  
  for (const line of lines) {
    // Start of version section
    if (line.startsWith(`## ${version} - `)) {
      inVersionSection = true;
      continue;
    }
    
    // End of version section
    if (inVersionSection && line.startsWith("## ")) {
      break;
    }
    
    // Skip subsection headers
    if (inVersionSection && line.startsWith("### ")) {
      continue;
    }
    
    // Parse entries
    if (inVersionSection && line.startsWith("- ")) {
      entries.push(line.substring(2).trim());
    }
  }
  
  return entries;
}

function buildReleaseNotes(commits, changelogEntries, previousTag, currentVersion, repoInfo) {
  const lines = ["## What's Changed", ""];
  
  // Filter commits with PR numbers
  const prCommits = commits.filter((c) => c.prNumber);
  
  if (prCommits.length > 0) {
    // We have commits with PR numbers - use them
    const seen = new Set();
    
    for (const commit of commits) {
      if (commit.prNumber && !seen.has(commit.prNumber)) {
        seen.add(commit.prNumber);
        
        // Clean up the subject - remove PR number
        let cleanSubject = commit.subject.replace(/\s*\(#\d+\)\s*$/, "").trim();
        
        const username = extractUsername(commit.authorEmail);
        lines.push(
          `* ${cleanSubject} by @${username} in [#${commit.prNumber}](https://github.com/${repoInfo.owner}/${repoInfo.repo}/pull/${commit.prNumber})`
        );
      }
    }
    
    // Add commits without PR numbers
    for (const commit of commits) {
      if (!commit.prNumber) {
        const username = extractUsername(commit.authorEmail);
        lines.push(`* ${commit.subject} by @${username}`);
      }
    }
  } else if (changelogEntries.length > 0) {
    // No commits with PR numbers - fall back to CHANGELOG.md
    for (const entry of changelogEntries) {
      // Strip the [area] prefix for consistency with Dokploy-style format
      const cleanEntry = entry.replace(/^\[[^\]]+\]\s*/, "");
      lines.push(`* ${cleanEntry}`);
    }
  } else {
    // No commits and no changelog entries
    lines.push("* No changes");
  }
  
  lines.push("");
  
  // Determine new contributors
  const previousContributors = getContributorsBeforeTag(previousTag);
  const currentContributors = new Map();
  
  for (const commit of commits) {
    if (!previousContributors.has(commit.authorEmail)) {
      const existing = currentContributors.get(commit.authorEmail);
      if (!existing) {
        currentContributors.set(commit.authorEmail, {
          name: commit.authorName,
          email: commit.authorEmail,
          prNumber: commit.prNumber || null,
        });
      } else if (!existing.prNumber && commit.prNumber) {
        // Update contributor to include a PR number from a later commit
        existing.prNumber = commit.prNumber;
      }
    }
  }
  
  // Add New Contributors section only if there are new contributors
  if (currentContributors.size > 0) {
    lines.push("## New Contributors", "");
    
    for (const [email, contributor] of currentContributors) {
      const username = extractUsername(email);
      if (contributor.prNumber) {
        lines.push(
          `* @${username} made their first contribution in [#${contributor.prNumber}](https://github.com/${repoInfo.owner}/${repoInfo.repo}/pull/${contributor.prNumber})`
        );
      } else {
        lines.push(`* @${username} made their first contribution`);
      }
    }
    
    lines.push("");
  }
  
  // Add Full Changelog link
  if (previousTag) {
    const currentTag = `v${currentVersion}`;
    lines.push(
      `**Full Changelog**: https://github.com/${repoInfo.owner}/${repoInfo.repo}/compare/${previousTag}...${currentTag}`
    );
  } else {
    // If no previous tag, just link to the repo commits
    const currentTag = `v${currentVersion}`;
    lines.push(
      `**Full Changelog**: https://github.com/${repoInfo.owner}/${repoInfo.repo}/commits/${currentTag}`
    );
  }
  
  return lines.join("\n");
}

async function run() {
  const { version, previousVersion, changelogPath } = parseArgs(process.argv.slice(2));
  
  if (!version) {
    throw new Error("Missing required --version argument");
  }
  
  // Validate version format
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error(`Invalid version format "${version}". Expected semantic version (e.g., 1.0.0)`);
  }
  
  const repoInfo = getRepoInfo();
  const previousTag = (previousVersion && previousVersion !== "0.0.0") ? `v${previousVersion}` : null;
  const commits = getCommitsSinceTag(previousTag);
  const changelogEntries = await parseChangelogSection(changelogPath, version);
  
  if (commits.length === 0 && changelogEntries.length === 0) {
    console.error(`No commits or changelog entries found for version ${version}. Ensure the version exists in CHANGELOG.md or commits exist since the previous tag.`);
    process.exitCode = 1;
    return;
  }
  
  const releaseNotes = buildReleaseNotes(commits, changelogEntries, previousTag, version, repoInfo);
  console.log(releaseNotes);
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : "Release notes generation failed");
  process.exitCode = 1;
});
