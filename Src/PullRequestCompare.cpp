/**
 * @file  PullRequestCompare.cpp
 *
 * @brief Download the changed files of a GitHub / Gitea pull request into
 *        local "base" and "head" snapshot folders.
 *
 * Only reads from the remote server: the pull request, its file list and the
 * file contents at the base and head commits. Nothing is ever written remotely.
 */

#include "StdAfx.h"
#include "PullRequestCompare.h"
#include "unicoder.h"
#include "paths.h"
#include <winhttp.h>
#include <wincrypt.h>
#include <shlobj.h>
#include <cstdio>

#pragma comment(lib, "winhttp.lib")

// Newer WinHTTP features; guarded because the project targets WINVER 0x0601.
#ifndef WINHTTP_ACCESS_TYPE_AUTOMATIC_PROXY
#define WINHTTP_ACCESS_TYPE_AUTOMATIC_PROXY 4
#endif
#ifndef WINHTTP_OPTION_DECOMPRESSION
#define WINHTTP_OPTION_DECOMPRESSION 118
#endif
#ifndef WINHTTP_DECOMPRESSION_FLAG_ALL
#define WINHTTP_DECOMPRESSION_FLAG_ALL 0x00000003
#endif
#pragma comment(lib, "crypt32.lib")

namespace PullRequest
{

namespace
{

constexpr size_t MAX_JSON_BYTES = 32u * 1024 * 1024;
constexpr size_t MAX_FILE_BYTES = 50u * 1024 * 1024;
constexpr int MAX_FILES = 3000;
constexpr int PAGE_SIZE = 100;

// ---------------------------------------------------------------------------
// Minimal JSON reader (objects, arrays, strings, numbers, true/false/null)

struct Json
{
	enum class Type { Null, Bool, Number, String, Array, Object };
	Type type = Type::Null;
	bool boolean = false;
	double number = 0;
	std::string text;
	std::vector<Json> items;          // array items or object values
	std::vector<std::string> keys;    // object keys, parallel to items

	const Json& operator[](const char* key) const
	{
		static const Json null;
		if (type != Type::Object)
			return null;
		for (size_t i = 0; i < keys.size(); ++i)
			if (keys[i] == key)
				return items[i];
		return null;
	}
	bool IsNull() const { return type == Type::Null; }
	String Str() const { return type == Type::String ? ucr::toTString(text) : String(); }
};

class JsonReader
{
public:
	JsonReader(const std::string& s) : p(s.data()), e(s.data() + s.size()) {}

	bool Read(Json& out)
	{
		if (!Value(out, 0))
			return false;
		Skip();
		return p == e;
	}

private:
	const char* p;
	const char* e;

	void Skip() { while (p < e && (*p == ' ' || *p == '\t' || *p == '\r' || *p == '\n')) ++p; }

	bool Literal(const char* lit)
	{
		const size_t n = strlen(lit);
		if (static_cast<size_t>(e - p) < n || strncmp(p, lit, n) != 0)
			return false;
		p += n;
		return true;
	}

	static void AppendUtf8(std::string& s, unsigned cp)
	{
		if (cp < 0x80) s += static_cast<char>(cp);
		else if (cp < 0x800) { s += static_cast<char>(0xC0 | (cp >> 6)); s += static_cast<char>(0x80 | (cp & 0x3F)); }
		else if (cp < 0x10000) { s += static_cast<char>(0xE0 | (cp >> 12)); s += static_cast<char>(0x80 | ((cp >> 6) & 0x3F)); s += static_cast<char>(0x80 | (cp & 0x3F)); }
		else { s += static_cast<char>(0xF0 | (cp >> 18)); s += static_cast<char>(0x80 | ((cp >> 12) & 0x3F)); s += static_cast<char>(0x80 | ((cp >> 6) & 0x3F)); s += static_cast<char>(0x80 | (cp & 0x3F)); }
	}

	bool Hex4(unsigned& v)
	{
		if (e - p < 4)
			return false;
		v = 0;
		for (int i = 0; i < 4; ++i, ++p)
		{
			const char c = *p;
			v <<= 4;
			if (c >= '0' && c <= '9') v |= c - '0';
			else if (c >= 'a' && c <= 'f') v |= c - 'a' + 10;
			else if (c >= 'A' && c <= 'F') v |= c - 'A' + 10;
			else return false;
		}
		return true;
	}

	bool StringValue(std::string& s)
	{
		if (p >= e || *p != '"')
			return false;
		++p;
		while (p < e && *p != '"')
		{
			if (*p != '\\')
			{
				s += *p++;
				continue;
			}
			if (++p >= e)
				return false;
			const char c = *p++;
			switch (c)
			{
			case '"': s += '"'; break;
			case '\\': s += '\\'; break;
			case '/': s += '/'; break;
			case 'b': s += '\b'; break;
			case 'f': s += '\f'; break;
			case 'n': s += '\n'; break;
			case 'r': s += '\r'; break;
			case 't': s += '\t'; break;
			case 'u':
			{
				unsigned cp;
				if (!Hex4(cp))
					return false;
				if (cp >= 0xD800 && cp <= 0xDBFF && e - p >= 6 && p[0] == '\\' && p[1] == 'u')
				{
					p += 2;
					unsigned lo;
					if (!Hex4(lo))
						return false;
					if (lo >= 0xDC00 && lo <= 0xDFFF)
						cp = 0x10000 + ((cp - 0xD800) << 10) + (lo - 0xDC00);
				}
				AppendUtf8(s, cp);
				break;
			}
			default:
				return false;
			}
		}
		if (p >= e)
			return false;
		++p;
		return true;
	}

	bool Value(Json& v, int depth)
	{
		if (depth > 64)
			return false;
		Skip();
		if (p >= e)
			return false;
		switch (*p)
		{
		case '{':
		{
			v.type = Json::Type::Object;
			++p;
			Skip();
			if (p < e && *p == '}') { ++p; return true; }
			for (;;)
			{
				Skip();
				std::string key;
				if (!StringValue(key))
					return false;
				Skip();
				if (p >= e || *p != ':')
					return false;
				++p;
				Json item;
				if (!Value(item, depth + 1))
					return false;
				v.keys.push_back(std::move(key));
				v.items.push_back(std::move(item));
				Skip();
				if (p < e && *p == ',') { ++p; continue; }
				if (p < e && *p == '}') { ++p; return true; }
				return false;
			}
		}
		case '[':
		{
			v.type = Json::Type::Array;
			++p;
			Skip();
			if (p < e && *p == ']') { ++p; return true; }
			for (;;)
			{
				Json item;
				if (!Value(item, depth + 1))
					return false;
				v.items.push_back(std::move(item));
				Skip();
				if (p < e && *p == ',') { ++p; continue; }
				if (p < e && *p == ']') { ++p; return true; }
				return false;
			}
		}
		case '"':
			v.type = Json::Type::String;
			return StringValue(v.text);
		case 't':
			v.type = Json::Type::Bool; v.boolean = true;
			return Literal("true");
		case 'f':
			v.type = Json::Type::Bool; v.boolean = false;
			return Literal("false");
		case 'n':
			v.type = Json::Type::Null;
			return Literal("null");
		default:
		{
			const char* start = p;
			while (p < e && (isdigit(static_cast<unsigned char>(*p)) || *p == '-' || *p == '+' || *p == '.' || *p == 'e' || *p == 'E'))
				++p;
			if (p == start)
				return false;
			v.type = Json::Type::Number;
			v.number = atof(std::string(start, p).c_str());
			return true;
		}
		}
	}
};

// ---------------------------------------------------------------------------
// HTTP (WinHTTP, system proxy, follows redirects)

struct HttpResponse
{
	DWORD status = 0;
	std::string body;
	String error;
	bool truncated = false;
};

class InternetHandle
{
public:
	explicit InternetHandle(HINTERNET h = nullptr) : m_h(h) {}
	~InternetHandle() { if (m_h) WinHttpCloseHandle(m_h); }
	InternetHandle(const InternetHandle&) = delete;
	InternetHandle& operator=(const InternetHandle&) = delete;
	operator HINTERNET() const { return m_h; }
private:
	HINTERNET m_h;
};

String LastErrorText(const tchar_t* what)
{
	const DWORD err = GetLastError();
	tchar_t buf[512] = {};
	DWORD len = FormatMessage(FORMAT_MESSAGE_FROM_HMODULE | FORMAT_MESSAGE_FROM_SYSTEM | FORMAT_MESSAGE_IGNORE_INSERTS,
		GetModuleHandle(_T("winhttp.dll")), err, 0, buf, static_cast<DWORD>(std::size(buf)), nullptr);
	while (len > 0 && (buf[len - 1] == '\r' || buf[len - 1] == '\n' || buf[len - 1] == ' '))
		buf[--len] = 0;
	return strutils::format(_T("%s (%u) %s"), what, err, buf);
}

HttpResponse HttpGet(const String& url, const std::vector<String>& headers, size_t maxBytes)
{
	HttpResponse res;

	URL_COMPONENTS uc = { sizeof(URL_COMPONENTS) };
	uc.dwHostNameLength = static_cast<DWORD>(-1);
	uc.dwUrlPathLength = static_cast<DWORD>(-1);
	uc.dwExtraInfoLength = static_cast<DWORD>(-1);
	if (!WinHttpCrackUrl(url.c_str(), 0, 0, &uc))
	{
		res.error = LastErrorText(_T("Invalid URL"));
		return res;
	}
	const std::wstring host(uc.lpszHostName, uc.dwHostNameLength);
	std::wstring object(uc.lpszUrlPath, uc.dwUrlPathLength);
	if (uc.lpszExtraInfo && uc.dwExtraInfoLength)
		object.append(uc.lpszExtraInfo, uc.dwExtraInfoLength);

	// WINHTTP_ACCESS_TYPE_AUTOMATIC_PROXY needs Windows 8.1+; fall back to the default proxy settings.
	HINTERNET hSession = WinHttpOpen(L"WinMerge", WINHTTP_ACCESS_TYPE_AUTOMATIC_PROXY, WINHTTP_NO_PROXY_NAME, WINHTTP_NO_PROXY_BYPASS, 0);
	if (hSession == nullptr)
		hSession = WinHttpOpen(L"WinMerge", WINHTTP_ACCESS_TYPE_DEFAULT_PROXY, WINHTTP_NO_PROXY_NAME, WINHTTP_NO_PROXY_BYPASS, 0);
	InternetHandle session(hSession);
	if (!session)
	{
		res.error = LastErrorText(_T("WinHttpOpen"));
		return res;
	}
	WinHttpSetTimeouts(session, 10000, 15000, 30000, 60000);

	InternetHandle connection(WinHttpConnect(session, host.c_str(), uc.nPort, 0));
	if (!connection)
	{
		res.error = LastErrorText(_T("WinHttpConnect"));
		return res;
	}
	InternetHandle request(WinHttpOpenRequest(connection, L"GET", object.c_str(), nullptr,
		WINHTTP_NO_REFERER, WINHTTP_DEFAULT_ACCEPT_TYPES, uc.nScheme == INTERNET_SCHEME_HTTPS ? WINHTTP_FLAG_SECURE : 0));
	if (!request)
	{
		res.error = LastErrorText(_T("WinHttpOpenRequest"));
		return res;
	}
	DWORD decompression = WINHTTP_DECOMPRESSION_FLAG_ALL;
	WinHttpSetOption(request, WINHTTP_OPTION_DECOMPRESSION, &decompression, sizeof(decompression));

	String allHeaders;
	for (const auto& h : headers)
		allHeaders += h + _T("\r\n");
	if (!WinHttpSendRequest(request, allHeaders.empty() ? WINHTTP_NO_ADDITIONAL_HEADERS : allHeaders.c_str(),
			allHeaders.empty() ? 0 : static_cast<DWORD>(-1L), WINHTTP_NO_REQUEST_DATA, 0, 0, 0) ||
		!WinHttpReceiveResponse(request, nullptr))
	{
		res.error = LastErrorText(_T("Request failed"));
		return res;
	}

	DWORD statusSize = sizeof(res.status);
	WinHttpQueryHeaders(request, WINHTTP_QUERY_STATUS_CODE | WINHTTP_QUERY_FLAG_NUMBER,
		WINHTTP_HEADER_NAME_BY_INDEX, &res.status, &statusSize, WINHTTP_NO_HEADER_INDEX);

	for (;;)
	{
		DWORD available = 0;
		if (!WinHttpQueryDataAvailable(request, &available))
		{
			res.error = LastErrorText(_T("Read failed"));
			return res;
		}
		if (available == 0)
			break;
		if (res.body.size() + available > maxBytes)
		{
			res.truncated = true;
			break;
		}
		const size_t offset = res.body.size();
		res.body.resize(offset + available);
		DWORD read = 0;
		if (!WinHttpReadData(request, &res.body[offset], available, &read))
		{
			res.error = LastErrorText(_T("Read failed"));
			return res;
		}
		res.body.resize(offset + read);
	}
	return res;
}

/** @brief Percent-encode one path segment or query value (UTF-8). */
String UrlEncode(const String& value, bool keepSlash)
{
	const std::string u8 = ucr::toUTF8(value);
	String out;
	for (unsigned char c : u8)
	{
		if (isalnum(c) || c == '-' || c == '_' || c == '.' || c == '~' || (keepSlash && c == '/'))
			out += static_cast<tchar_t>(c);
		else
			out += strutils::format(_T("%%%02X"), c);
	}
	return out;
}

/** @brief Repository-relative path to a safe local relative path, or empty when unsafe. */
String SafeRelativePath(const String& repoPath)
{
	if (repoPath.empty() || repoPath[0] == '/' || repoPath.find(':') != String::npos)
		return String();
	String result;
	size_t start = 0;
	while (start <= repoPath.size())
	{
		size_t end = repoPath.find('/', start);
		if (end == String::npos)
			end = repoPath.size();
		const String part = repoPath.substr(start, end - start);
		if (part.empty() || part == _T(".") || part == _T("..") ||
			part.find_first_of(_T("<>\"|?*\\")) != String::npos)
			return String();
		for (tchar_t ch : part)
			if (ch < 32)
				return String();
		if (!result.empty())
			result += _T("\\");
		result += part;
		start = end + 1;
	}
	return result;
}

bool WriteFileBytes(const String& path, const std::string& bytes, String& error)
{
	const String dir = paths::GetParentPath(path);
	const int rc = SHCreateDirectoryExW(nullptr, dir.c_str(), nullptr);
	if (rc != ERROR_SUCCESS && rc != ERROR_ALREADY_EXISTS && rc != ERROR_FILE_EXISTS)
	{
		error = strutils::format(_T("Cannot create folder %s"), dir);
		return false;
	}
	FILE* fp = nullptr;
	if (_wfopen_s(&fp, path.c_str(), L"wb") != 0 || fp == nullptr)
	{
		error = strutils::format(_T("Cannot write %s"), path);
		return false;
	}
	const size_t written = bytes.empty() ? 0 : fwrite(bytes.data(), 1, bytes.size(), fp);
	fclose(fp);
	if (written != bytes.size())
	{
		error = strutils::format(_T("Cannot write %s"), path);
		return false;
	}
	return true;
}

String HttpErrorText(const HttpResponse& res, const String& what)
{
	if (!res.error.empty())
		return what + _T(": ") + res.error;
	String message;
	Json json;
	if (JsonReader(res.body).Read(json))
		message = json["message"].Str();
	String hint;
	if (res.status == 401 || res.status == 403)
		hint = _T(" Check the access token, or that it may read this repository.");
	else if (res.status == 404)
		hint = _T(" The pull request was not found, or the repository is private and needs a token.");
	return strutils::format(_T("%s: HTTP %u %s%s"), what, res.status, message, hint);
}

class Client
{
public:
	Client(const Address& address, const String& token) : m_address(address), m_token(token) {}

	std::vector<String> Headers(bool raw) const
	{
		std::vector<String> h;
		h.push_back(_T("User-Agent: WinMerge"));
		if (m_address.provider == Provider::GitHub)
		{
			h.push_back(raw ? _T("Accept: application/vnd.github.raw") : _T("Accept: application/vnd.github+json"));
			h.push_back(_T("X-GitHub-Api-Version: 2022-11-28"));
			if (!m_token.empty())
				h.push_back(_T("Authorization: Bearer ") + m_token);
		}
		else
		{
			h.push_back(raw ? _T("Accept: */*") : _T("Accept: application/json"));
			if (!m_token.empty())
				h.push_back(_T("Authorization: token ") + m_token);
		}
		return h;
	}

	bool GetJson(const String& url, Json& json, String& error, const String& what) const
	{
		const HttpResponse res = HttpGet(url, Headers(false), MAX_JSON_BYTES);
		if (!res.error.empty() || res.status != 200 || res.truncated)
		{
			error = res.truncated ? what + _T(": response too large") : HttpErrorText(res, what);
			return false;
		}
		if (!JsonReader(res.body).Read(json))
		{
			error = what + _T(": the server did not return valid JSON.");
			return false;
		}
		return true;
	}

	/** @brief Raw contents of @p repoPath at commit @p sha in repository @p fullName ("owner/repo"). */
	bool GetFile(const String& fullName, const String& repoPath, const String& sha, std::string& bytes, String& error) const
	{
		const String base = m_address.ApiBase() + _T("/repos/") + UrlEncode(fullName, true);
		const String url = (m_address.provider == Provider::GitHub)
			? base + _T("/contents/") + UrlEncode(repoPath, true) + _T("?ref=") + UrlEncode(sha, false)
			: base + _T("/raw/") + UrlEncode(repoPath, true) + _T("?ref=") + UrlEncode(sha, false);
		HttpResponse res = HttpGet(url, Headers(true), MAX_FILE_BYTES);
		if (res.truncated)
		{
			error = repoPath + _T(": larger than 50 MB, skipped");
			return false;
		}
		if (!res.error.empty() || res.status != 200)
		{
			error = HttpErrorText(res, repoPath);
			return false;
		}
		bytes = std::move(res.body);
		return true;
	}

private:
	const Address& m_address;
	String m_token;
};

std::vector<String> Split(const String& s, tchar_t sep)
{
	std::vector<String> parts;
	size_t start = 0;
	for (;;)
	{
		const size_t pos = s.find(sep, start);
		parts.push_back(s.substr(start, pos == String::npos ? String::npos : pos - start));
		if (pos == String::npos)
			break;
		start = pos + 1;
	}
	return parts;
}

} // namespace

// ---------------------------------------------------------------------------

bool Address::Parse(const String& urlIn, Address& out)
{
	String url = strutils::trim_ws(urlIn);
	const size_t schemeEnd = url.find(_T("://"));
	if (schemeEnd == String::npos)
		return false;
	Address a;
	a.scheme = strutils::makelower(url.substr(0, schemeEnd));
	if (a.scheme != _T("https") && a.scheme != _T("http"))
		return false;
	String rest = url.substr(schemeEnd + 3);
	const size_t cut = rest.find_first_of(_T("?#"));
	if (cut != String::npos)
		rest.resize(cut);
	std::vector<String> parts = Split(rest, '/');
	while (!parts.empty() && parts.back().empty())
		parts.pop_back();
	if (parts.size() < 5 || parts[0].empty() || parts[0].find('@') != String::npos)
		return false;
	a.host = strutils::makelower(parts[0]);
	// Find ".../{owner}/{repo}/pull[s]/{number}" (extra segments such as /files are allowed)
	for (size_t i = 3; i + 1 < parts.size(); ++i)
	{
		const String kind = strutils::makelower(parts[i]);
		if (kind != _T("pull") && kind != _T("pulls"))
			continue;
		const String& num = parts[i + 1];
		if (num.empty() || num.size() > 9 || num.find_first_not_of(_T("0123456789")) != String::npos)
			continue;
		a.owner = parts[i - 2];
		a.repo = parts[i - 1];
		if (a.owner.empty() || a.repo.empty() || i != 3)
			return false; // repositories in sub-paths are not supported
		a.number = _ttoi(num.c_str());
		if (a.number <= 0)
			return false;
		const bool isGitHubHost = a.host == _T("github.com") || a.host == _T("www.github.com");
		a.provider = (kind == _T("pull")) ? Provider::GitHub : Provider::Gitea;
		if (isGitHubHost)
		{
			a.provider = Provider::GitHub;
			a.host = _T("github.com");
		}
		if (strutils::makelower(a.repo).size() > 4 && strutils::makelower(a.repo).substr(a.repo.size() - 4) == _T(".git"))
			a.repo.resize(a.repo.size() - 4);
		out = a;
		return true;
	}
	return false;
}

String Address::ApiBase() const
{
	if (provider == Provider::GitHub)
		return host == _T("github.com") ? String(_T("https://api.github.com")) : scheme + _T("://") + host + _T("/api/v3");
	return scheme + _T("://") + host + _T("/api/v1");
}

String Address::WebUrl() const
{
	return strutils::format(_T("%s://%s/%s/%s/%s/%d"), scheme, host, owner, repo,
		provider == Provider::GitHub ? _T("pull") : _T("pulls"), number);
}

bool Download(const Address& address, const String& token, const String& targetRoot,
	Snapshot& snapshot, String& error, const ProgressCallback& progress)
{
	auto report = [&progress](const String& msg) { if (progress) progress(msg); };
	Client client(address, token);
	const String prUrl = strutils::format(_T("%s/repos/%s/%s/pulls/%d"), address.ApiBase(),
		UrlEncode(address.owner, false), UrlEncode(address.repo, false), address.number);

	report(_T("Reading pull request..."));
	Json pr;
	if (!client.GetJson(prUrl, pr, error, strutils::format(_T("Pull request #%d"), address.number)))
		return false;

	const Json& base = pr["base"];
	const Json& head = pr["head"];
	snapshot.title = pr["title"].Str();
	snapshot.baseRef = base["ref"].Str();
	snapshot.baseSha = base["sha"].Str();
	snapshot.headRef = head["ref"].Str();
	snapshot.headSha = head["sha"].Str();
	const String defaultRepo = address.owner + _T("/") + address.repo;
	String baseRepo = base["repo"]["full_name"].Str();
	String headRepo = head["repo"]["full_name"].Str();
	if (baseRepo.empty())
		baseRepo = defaultRepo;
	if (headRepo.empty())
		headRepo = baseRepo; // fork deleted: the head commit is still reachable from the base repository
	if (snapshot.baseSha.empty() || snapshot.headSha.empty())
	{
		error = _T("The server response does not contain the base and head commits.");
		return false;
	}

	struct ChangedFile { String path, previousPath, status; };
	std::vector<ChangedFile> files;
	for (int page = 1; static_cast<int>(files.size()) < MAX_FILES; ++page)
	{
		report(strutils::format(_T("Reading changed files (page %d)..."), page));
		const String url = prUrl + strutils::format(
			address.provider == Provider::GitHub ? _T("/files?per_page=%d&page=%d") : _T("/files?limit=%d&page=%d"), PAGE_SIZE, page);
		Json list;
		if (!client.GetJson(url, list, error, _T("Changed files")))
			return false;
		if (list.type != Json::Type::Array)
		{
			error = _T("Changed files: unexpected server response.");
			return false;
		}
		for (const Json& f : list.items)
			files.push_back({ f["filename"].Str(), f["previous_filename"].Str(), f["status"].Str() });
		if (list.items.size() < static_cast<size_t>(PAGE_SIZE))
			break;
	}
	if (static_cast<int>(files.size()) >= MAX_FILES)
		snapshot.warnings.push_back(strutils::format(_T("Only the first %d changed files were downloaded."), MAX_FILES));

	snapshot.basePath = paths::ConcatPath(targetRoot, _T("base"));
	snapshot.headPath = paths::ConcatPath(targetRoot, _T("head"));
	SHCreateDirectoryExW(nullptr, snapshot.basePath.c_str(), nullptr);
	SHCreateDirectoryExW(nullptr, snapshot.headPath.c_str(), nullptr);

	auto fetchTo = [&](const String& repoFullName, const String& repoPath, const String& sha, const String& folder)
	{
		const String rel = SafeRelativePath(repoPath);
		if (rel.empty())
		{
			snapshot.warnings.push_back(repoPath + _T(": unsupported path, skipped"));
			return;
		}
		std::string bytes;
		String fileError;
		if (!client.GetFile(repoFullName, repoPath, sha, bytes, fileError) ||
			!WriteFileBytes(paths::ConcatPath(folder, rel), bytes, fileError))
		{
			snapshot.warnings.push_back(fileError);
		}
	};

	int index = 0;
	for (const ChangedFile& f : files)
	{
		++index;
		report(strutils::format(_T("Downloading %d/%d: %s"), index, static_cast<int>(files.size()), f.path));
		const String status = strutils::makelower(f.status);
		const bool added = status == _T("added");
		const bool removed = status == _T("removed") || status == _T("deleted");
		const String oldPath = (status == _T("renamed") && !f.previousPath.empty()) ? f.previousPath : f.path;
		if (!added)
			fetchTo(baseRepo, oldPath, snapshot.baseSha, snapshot.basePath);
		if (!removed)
			fetchTo(headRepo, f.path, snapshot.headSha, snapshot.headPath);
	}
	snapshot.fileCount = static_cast<int>(files.size());
	return true;
}

String TokenFromEnvironment(Provider provider)
{
	const tchar_t* names[2] = { nullptr, nullptr };
	if (provider == Provider::GitHub)
	{
		names[0] = _T("GITHUB_TOKEN");
		names[1] = _T("GH_TOKEN");
	}
	else
	{
		names[0] = _T("GITEA_TOKEN");
	}
	for (const tchar_t* name : names)
	{
		if (name == nullptr)
			continue;
		tchar_t buf[1024];
		const DWORD len = GetEnvironmentVariable(name, buf, static_cast<DWORD>(std::size(buf)));
		if (len > 0 && len < std::size(buf))
			return strutils::trim_ws(String(buf, len));
	}
	return String();
}

String ProtectToken(const String& token)
{
	if (token.empty())
		return String();
	DATA_BLOB in{ static_cast<DWORD>(token.size() * sizeof(tchar_t)), reinterpret_cast<BYTE*>(const_cast<tchar_t*>(token.data())) };
	DATA_BLOB out{};
	if (!CryptProtectData(&in, L"WinMerge pull request token", nullptr, nullptr, nullptr, CRYPTPROTECT_UI_FORBIDDEN, &out))
		return String();
	DWORD chars = 0;
	CryptBinaryToString(out.pbData, out.cbData, CRYPT_STRING_BASE64 | CRYPT_STRING_NOCRLF, nullptr, &chars);
	String encoded(chars, 0);
	CryptBinaryToString(out.pbData, out.cbData, CRYPT_STRING_BASE64 | CRYPT_STRING_NOCRLF, encoded.data(), &chars);
	encoded.resize(chars);
	LocalFree(out.pbData);
	return encoded;
}

String UnprotectToken(const String& stored)
{
	if (stored.empty())
		return String();
	DWORD size = 0;
	if (!CryptStringToBinary(stored.c_str(), 0, CRYPT_STRING_BASE64, nullptr, &size, nullptr, nullptr) || size == 0)
		return String();
	std::vector<BYTE> blob(size);
	if (!CryptStringToBinary(stored.c_str(), 0, CRYPT_STRING_BASE64, blob.data(), &size, nullptr, nullptr))
		return String();
	DATA_BLOB in{ size, blob.data() };
	DATA_BLOB out{};
	if (!CryptUnprotectData(&in, nullptr, nullptr, nullptr, nullptr, CRYPTPROTECT_UI_FORBIDDEN, &out))
		return String();
	String token(reinterpret_cast<const tchar_t*>(out.pbData), out.cbData / sizeof(tchar_t));
	SecureZeroMemory(out.pbData, out.cbData);
	LocalFree(out.pbData);
	return token;
}

}
