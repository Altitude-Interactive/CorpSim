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
  try {
    const range = previousTag ? `${previousTag}..HEAD` : "HEAD";
    const output = execFileSync("git", ["log", range, "--format=%H|||%s|||%an|||%ae"], {
      encoding: "utf8",
    }).trim();
    
    if (!output) {
      return [];
    }
    
    return output.split("\n").map((line) => {
      const [hash, subject, authorName, authorEmail] = line.split("|||");
      
      // Extract PR number from subject (e.g., "Fix bug (#123)")
      const prMatch = subject.match(/\(#(\d+)\)/);
      const prNumber = prMatch ? prMatch[1] : null;
      
      return {
        hash,
        subject,
        authorName,
        authorEmail,
        prNumber,
      };
    });
  } catch (error) {
    console.error("Failed to get commits:", error.message);
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
    }).trim();
    
    if (!output) {
      return new Set();
    }
    
    return new Set(output.split("\n"));
  } catch (error) {
    // Tag might not exist
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
  
  // Fallback to email prefix
  return email.split("@")[0];
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
    if (line.match(new RegExp(`^## ${version.replace(/\./g, "\\.")} - `))) {
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
  
  // Build a map of PR numbers to commit info
  const prMap = new Map();
  for (const commit of commits) {
    if (commit.prNumber) {
      if (!prMap.has(commit.prNumber)) {
        prMap.set(commit.prNumber, commit);
      }
    }
  }
  
  // Process changelog entries and enhance them with PR/author info
  if (changelogEntries.length > 0) {
    for (const entry of changelogEntries) {
      // Try to match entry with a commit by looking for similar text
      let matchedCommit = null;
      const entryLower = entry.toLowerCase();
      
      for (const commit of commits) {
        const subjectLower = commit.subject.toLowerCase();
        // Simple matching - if entry text is in subject or vice versa
        if (subjectLower.includes(entryLower.substring(0, 30)) || 
            entryLower.includes(subjectLower.substring(0, 30))) {
          matchedCommit = commit;
          break;
        }
      }
      
      if (matchedCommit && matchedCommit.prNumber) {
        const username = extractUsername(matchedCommit.authorEmail);
        lines.push(
          `* ${entry} by @${username} in [#${matchedCommit.prNumber}](https://github.com/${repoInfo.owner}/${repoInfo.repo}/pull/${matchedCommit.prNumber})`
        );
      } else {
        // No matching commit found, use the entry as-is
        lines.push(`* ${entry}`);
      }
    }
  } else {
    // Fallback to commit-based listing if no changelog entries
    const seen = new Set();
    
    for (const commit of commits) {
      if (commit.prNumber && !seen.has(commit.prNumber)) {
        seen.add(commit.prNumber);
        
        // Clean up the subject - remove PR number and common prefixes
        let cleanSubject = commit.subject.replace(/\s*\(#\d+\)\s*$/, "").trim();
        
        // Add bullet point with PR link
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
  }
  
  lines.push("");
  
  // Determine new contributors
  const previousContributors = getContributorsBeforeTag(previousTag);
  const currentContributors = new Map();
  
  for (const commit of commits) {
    if (!previousContributors.has(commit.authorEmail)) {
      if (!currentContributors.has(commit.authorEmail)) {
        currentContributors.set(commit.authorEmail, {
          name: commit.authorName,
          email: commit.authorEmail,
          prNumber: commit.prNumber,
        });
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
  
  const repoInfo = getRepoInfo();
  const previousTag = previousVersion ? `v${previousVersion}` : null;
  const commits = getCommitsSinceTag(previousTag);
  const changelogEntries = await parseChangelogSection(changelogPath, version);
  
  if (commits.length === 0 && changelogEntries.length === 0) {
    console.log("No commits or changelog entries found for release notes");
    return;
  }
  
  const releaseNotes = buildReleaseNotes(commits, changelogEntries, previousTag, version, repoInfo);
  console.log(releaseNotes);
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : "Release notes generation failed");
  process.exitCode = 1;
});
