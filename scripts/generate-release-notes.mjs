#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

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
    const output = execFileSync(
      "git",
      ["log", "-z", range, "--format=%H%x00%s%x00%an%x00%ae"],
      {
        encoding: "utf8",
        stdio: ["inherit", "pipe", "ignore"], // Suppress stderr
      },
    ).trim();
    
    if (!output) {
      return [];
    }
    
    const fields = output.split("\0");
    const commits = [];
    
    for (let i = 0; i + 3 < fields.length; i += 4) {
      const hash = fields[i];
      const subject = fields[i + 1];
      const authorName = fields[i + 2];
      const authorEmail = fields[i + 3];
      
      // Extract PR number from subject (e.g., "Fix bug (#123)")
      const prMatch = subject?.match(/\(#(\d+)\)/);
      const prNumber = prMatch ? prMatch[1] : null;
      
      commits.push({
        hash: hash || "",
        subject: subject || "",
        authorName: authorName || "",
        authorEmail: authorEmail || "",
        prNumber,
      });
    }
    
    return commits;
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

function escapeMarkdown(text) {
  if (typeof text !== "string") {
    return "";
  }
  // Remove newlines and escape Markdown control characters
  return text
    .replace(/[\r\n]+/g, " ")
    .replace(/\\/g, "\\\\")
    .replace(/`/g, "\\`")
    .replace(/\*/g, "\\*")
    .replace(/_/g, "\\_")
    .replace(/\{/g, "\\{")
    .replace(/\}/g, "\\}")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/#/g, "\\#")
    .replace(/!/g, "\\!")
    .replace(/\|/g, "\\|")
    .trim();
}

function extractUsername(email) {
  if (typeof email !== "string" || !email) {
    // No email provided; signal that we cannot safely generate a username
    return null;
  }

  // Try to extract GitHub username from email
  // Format: username@users.noreply.github.com (optionally with numeric prefix: 123+username@...)
  const githubMatch = email.match(/^(?:\d+\+)?([^@]+)@users\.noreply\.github\.com$/);
  let candidate;

  if (githubMatch) {
    candidate = githubMatch[1];
  } else {
    // Fallback: use the email local-part as a candidate only
    const prefix = email.split("@")[0];
    if (!prefix) {
      return null;
    }
    candidate = prefix;
  }

  // Allow only GitHub-username-safe characters: letters, digits, and hyphen
  const sanitized = candidate.replace(/[^A-Za-z0-9-]/g, "");

  // If sanitization removed characters or results in empty string,
  // do not use this as a mention handle; let the caller fall back to a non-mention display
  if (!sanitized || sanitized !== candidate) {
    return null;
  }

  return sanitized;
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
        const cleanSubject = commit.subject.replace(/\s*\(#\d+\)\s*$/, "").trim();
        const escapedSubject = escapeMarkdown(cleanSubject);
        
        const username = extractUsername(commit.authorEmail);
        if (username) {
          lines.push(
            `* ${escapedSubject} by @${username} in [#${commit.prNumber}](https://github.com/${repoInfo.owner}/${repoInfo.repo}/pull/${commit.prNumber})`
          );
        } else {
          // Fall back to author name if username cannot be safely extracted
          const escapedAuthorName = escapeMarkdown(commit.authorName);
          lines.push(
            `* ${escapedSubject} by ${escapedAuthorName} in [#${commit.prNumber}](https://github.com/${repoInfo.owner}/${repoInfo.repo}/pull/${commit.prNumber})`
          );
        }
      }
    }
    
    // Add commits without PR numbers
    for (const commit of commits) {
      if (!commit.prNumber) {
        const escapedSubject = escapeMarkdown(commit.subject);
        const username = extractUsername(commit.authorEmail);
        if (username) {
          lines.push(`* ${escapedSubject} by @${username}`);
        } else {
          const escapedAuthorName = escapeMarkdown(commit.authorName);
          lines.push(`* ${escapedSubject} by ${escapedAuthorName}`);
        }
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
        if (username) {
          lines.push(
            `* @${username} made their first contribution in [#${contributor.prNumber}](https://github.com/${repoInfo.owner}/${repoInfo.repo}/pull/${contributor.prNumber})`
          );
        } else {
          const escapedName = escapeMarkdown(contributor.name);
          lines.push(
            `* ${escapedName} made their first contribution in [#${contributor.prNumber}](https://github.com/${repoInfo.owner}/${repoInfo.repo}/pull/${contributor.prNumber})`
          );
        }
      } else {
        if (username) {
          lines.push(`* @${username} made their first contribution`);
        } else {
          const escapedName = escapeMarkdown(contributor.name);
          lines.push(`* ${escapedName} made their first contribution`);
        }
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
  const previousTag =
    previousVersion &&
    previousVersion !== "0.0.0" &&
    previousVersion !== version
      ? `v${previousVersion}`
      : null;
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
