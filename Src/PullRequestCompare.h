/**
 * @file  PullRequestCompare.h
 *
 * @brief Download the changed files of a GitHub / Gitea pull request into
 *        local "base" and "head" snapshot folders so they can be compared.
 */
#pragma once

#include "UnicodeString.h"
#include <functional>
#include <vector>

namespace PullRequest
{

enum class Provider { GitHub, Gitea };

/** @brief Parsed pull request address, e.g. https://github.com/owner/repo/pull/12 */
struct Address
{
	Provider provider = Provider::GitHub;
	String scheme;   /**< "https" or "http" */
	String host;     /**< host[:port] */
	String owner;
	String repo;
	int number = 0;

	/** @brief Parse a pull request URL. GitHub uses ".../pull/N", Gitea ".../pulls/N". */
	static bool Parse(const String& url, Address& out);
	String ApiBase() const;
	String WebUrl() const;
};

/** @brief Result of a successful download. */
struct Snapshot
{
	String title;
	String baseRef, baseSha;
	String headRef, headSha;
	String basePath;   /**< Folder with the files as they are in the base commit */
	String headPath;   /**< Folder with the files as they are in the head commit */
	int fileCount = 0;
	std::vector<String> warnings; /**< Files that could not be downloaded */
};

using ProgressCallback = std::function<void(const String& message)>;

/**
 * @brief Fetch the pull request metadata and changed files.
 * @param [in] address Parsed pull request address.
 * @param [in] token Access token (may be empty for public repositories).
 * @param [in] targetRoot Folder that receives the "base" and "head" subfolders.
 * @param [out] snapshot Downloaded snapshot.
 * @param [out] error Error description when the function returns false.
 * @param [in] progress Optional progress callback.
 */
bool Download(const Address& address, const String& token, const String& targetRoot,
	Snapshot& snapshot, String& error, const ProgressCallback& progress = nullptr);

/** @brief Token from GITHUB_TOKEN/GH_TOKEN or GITEA_TOKEN when none is given. */
String TokenFromEnvironment(Provider provider);

/** @brief Protect a token with DPAPI for storage in the options (current user only). */
String ProtectToken(const String& token);
/** @brief Reverse of ProtectToken(); returns an empty string on failure. */
String UnprotectToken(const String& stored);

}
